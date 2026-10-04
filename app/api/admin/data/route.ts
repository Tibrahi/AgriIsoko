import { adminEntities, type AdminField } from "@/lib/admin-data-config";
import { connectionMessage, getPool, isDatabaseConnectionError } from "@/lib/agri-data";
import { getSession, isAdmin, verifySameOrigin } from "@/lib/auth";
import type { PoolClient } from "pg";

export const runtime = "nodejs";

const references: Record<string, (pool: ReturnType<typeof getPool>) => Promise<{ id: string; label: string }[]>> = {
  crops: async (pool) => (await pool.query("SELECT id, name AS label FROM crops WHERE active ORDER BY name")).rows,
  organizations: async (pool) => (await pool.query("SELECT id, name AS label FROM organizations ORDER BY name LIMIT 500")).rows,
  geographies: async (pool) => (await pool.query("SELECT id, concat_ws(' · ', district_name, sector_name, cell_name, village_name) AS label FROM geographies ORDER BY district_name, sector_name NULLS FIRST LIMIT 1000")).rows,
  seasons: async (pool) => (await pool.query("SELECT id, name || ' (' || starts_on::text || ')' AS label FROM seasons ORDER BY starts_on DESC LIMIT 200")).rows,
  farms: async (pool) => (await pool.query("SELECT f.id, o.name || ' · ' || g.district_name AS label FROM farms f JOIN organizations o ON o.id=f.organization_id JOIN geographies g ON g.id=f.geography_id ORDER BY f.created_at DESC LIMIT 500")).rows,
  marketplace_listings: async (pool) => (await pool.query("SELECT l.id, c.name || ' · ' || o.name || ' · ' || l.available_quantity::text || ' ' || l.unit AS label FROM marketplace_listings l JOIN crops c ON c.id=l.crop_id JOIN organizations o ON o.id=l.seller_organization_id ORDER BY l.created_at DESC LIMIT 500")).rows,
};

async function requireAdmin() {
  try {
    const user = await getSession();
    return user && isAdmin(user) ? user : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Administrator access is required." }, { status: 403 });
  const entity = new URL(request.url).searchParams.get("entity") ?? "crops";
  const requestedPage = Math.max(1, Number.parseInt(new URL(request.url).searchParams.get("page") ?? "1", 10) || 1);
  const config = adminEntities[entity];
  if (!config) return Response.json({ error: "Choose a supported data type." }, { status: 400 });
  try {
    const pool = getPool();
    const pageSize = 25;
    const count = await pool.query<{ total: string }>(`SELECT count(*)::text AS total FROM ${config.table}`);
    const total = Number(count.rows[0].total);
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(requestedPage, pages);
    const order = ["crops", "geographies", "seasons"].includes(entity) ? "id ASC" : "created_at DESC, id DESC";
    const [records, options] = await Promise.all([
      pool.query(`SELECT * FROM ${config.table} ORDER BY ${order} LIMIT $1 OFFSET $2`, [pageSize, (page - 1) * pageSize]),
      Promise.all([...new Set(config.fields.map((field) => field.reference).filter((v): v is string => Boolean(v)))].map(async (key) => [key, await references[key](pool)] as const)),
    ]);
    return Response.json({ records: records.rows, options: Object.fromEntries(options), page, pages, total, pageSize }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: connectionMessage(error) }, { status: 503 });
  }
}

function validateValues(entity: string, raw: unknown, fields: readonly AdminField[], action: "create" | "update") {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Enter the record details.");
  const body = raw as Record<string, unknown>;
  const values: Record<string, unknown> = {};
  for (const field of fields) {
    const rawValue = body[field.name];
    if (field.type === "checkbox") {
      if (rawValue !== undefined && typeof rawValue !== "boolean") throw new Error(`${field.label} must be checked or unchecked.`);
      if (rawValue !== undefined) values[field.name] = rawValue;
      continue;
    }
    if (rawValue === undefined) continue;
    if (rawValue === null || rawValue === "") {
      if (field.required) throw new Error(`${field.label} is required.`);
      if (action === "update") values[field.name] = null;
      continue;
    }
    if (field.type === "number") {
      const number = Number(rawValue);
      if (!Number.isFinite(number) || number < 0) throw new Error(`${field.label} must be a non-negative number.`);
      values[field.name] = number;
    } else {
      if (typeof rawValue !== "string") throw new Error(`${field.label} is invalid.`);
      let value = rawValue.trim();
      if (field.name === "country_code") value = value.toUpperCase();
      if (field.name === "currency") value = value.toUpperCase();
      if (!value && field.required) throw new Error(`${field.label} is required.`);
      if (field.name === "country_code" && !/^[A-Za-z]{2}$/.test(value)) throw new Error("Country code must be two letters, such as RW.");
      if (field.type === "date" && value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${field.label} must be a valid date.`);
      if (field.reference && value && !/^[0-9a-f-]{36}$/i.test(value)) throw new Error(`${field.label} selection is invalid.`);
      const matchedOption = field.options?.find((option) => option.value.toLocaleLowerCase() === value.toLocaleLowerCase() || option.label.toLocaleLowerCase() === value.toLocaleLowerCase());
      if (field.options && value && !matchedOption) throw new Error(`${field.label} must be one of: ${field.options.map((option) => option.label).join(", ")}.`);
      values[field.name] = (matchedOption?.value ?? value) || null;
    }
  }
  if (entity === "inventory_balances" && Number(values.available_kg) > Number(values.quantity_kg)) throw new Error("Available quantity cannot exceed total quantity.");
  if (entity === "seasons" && String(values.ends_on) < String(values.starts_on)) throw new Error("Season end date must be on or after its start date.");
  return values;
}

function systemColumns(entity: string, actorId: string, values: Record<string, unknown>) {
  const columns: Record<string, unknown> = { ...values };
  if (["farms", "harvest_reports", "inventory_balances"].includes(entity)) columns.submitted_by = actorId;
  if (entity === "marketplace_listings" || entity === "marketplace_orders") columns.created_by = actorId;
  if (adminEntities[entity].verification && values.verification_status === "verified") {
    columns.verified_by = actorId;
    columns.verified_at = new Date();
  } else if (adminEntities[entity].verification) {
    columns.verified_by = null;
    columns.verified_at = null;
  }
  return columns;
}

async function audit(client: PoolClient, actor: string, entity: string, id: string, action: string, before: unknown, after: unknown) {
  await client.query(
    "INSERT INTO audit_events (actor_user_id, entity_type, entity_id, action, before_state, after_state) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb)",
    [actor, entity, id, action, before === null ? null : JSON.stringify(before), after === null ? null : JSON.stringify(after)],
  );
}

export async function POST(request: Request) {
  if (!verifySameOrigin(request)) return Response.json({ error: "Request origin could not be verified." }, { status: 403 });
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Administrator access is required." }, { status: 403 });
  let entity: string;
  let values: Record<string, unknown>;
  try {
    const body = await request.json();
    entity = String(body.entity ?? "");
    const config = adminEntities[entity];
    if (!config) return Response.json({ error: "Choose a supported data type." }, { status: 400 });
    values = systemColumns(entity, admin.id, validateValues(entity, body.values, config.fields, "create"));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Record details are invalid." }, { status: 400 });
  }
  return mutate(request, admin.id, entity, values, "create");
}

export async function PATCH(request: Request) {
  if (!verifySameOrigin(request)) return Response.json({ error: "Request origin could not be verified." }, { status: 403 });
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Administrator access is required." }, { status: 403 });
  try {
    const body = await request.json();
    const entity = String(body.entity ?? "");
    const config = adminEntities[entity];
    const id = String(body.id ?? "");
    if (!config || !/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Choose a valid record." }, { status: 400 });
    const values = validateValues(entity, body.values, config.fields, "update");
    if (values.verification_status === "verified") {
      values.verified_by = admin.id;
      values.verified_at = new Date();
    } else if (config.verification) {
      values.verified_by = null;
      values.verified_at = null;
    }
    return mutate(request, admin.id, entity, values, "update", id);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Record details are invalid." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  if (!verifySameOrigin(request)) return Response.json({ error: "Request origin could not be verified." }, { status: 403 });
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Administrator access is required." }, { status: 403 });
  try {
    const body = await request.json();
    const entity = String(body.entity ?? "");
    const id = String(body.id ?? "");
    if (!adminEntities[entity] || !/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Choose a valid record." }, { status: 400 });
    return mutate(request, admin.id, entity, {}, "delete", id);
  } catch {
    return Response.json({ error: "Could not remove this record." }, { status: 400 });
  }
}

async function mutate(_request: Request, actor: string, entity: string, values: Record<string, unknown>, action: "create" | "update" | "delete", id?: string) {
  const config = adminEntities[entity];
  let client: PoolClient;
  try { client = await getPool().connect(); }
  catch (error) { return Response.json({ error: connectionMessage(error) }, { status: 503 }); }
  try {
    await client.query("BEGIN");
    let previous: Record<string, unknown> | null = null;
    if (id) {
      const old = await client.query(`SELECT * FROM ${config.table} WHERE id = $1 FOR UPDATE`, [id]);
      if (!old.rows[0]) { await client.query("ROLLBACK"); return Response.json({ error: "Record was not found." }, { status: 404 }); }
      previous = old.rows[0];
    }
    let result;
    if (action === "create") {
      const columns = Object.keys(values);
      const placeholders = columns.map((_, index) => `$${index + 1}`);
      result = await client.query(`INSERT INTO ${config.table} (${columns.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING *`, columns.map((column) => values[column]));
    } else if (action === "update") {
      const columns = Object.keys(values);
      if (entity === "marketplace_orders") { columns.push("updated_at"); values.updated_at = new Date(); }
      result = await client.query(`UPDATE ${config.table} SET ${columns.map((column, index) => `${column} = $${index + 1}`).join(", ")} WHERE id = $${columns.length + 1} RETURNING *`, [...columns.map((column) => values[column]), id]);
    } else {
      await client.query(`DELETE FROM ${config.table} WHERE id = $1`, [id]);
      result = { rows: [] };
    }
    const recordId = id ?? result.rows[0].id;
    await audit(client, actor, entity, recordId, `admin_${action}`, previous, result.rows[0] ?? null);
    await client.query("COMMIT");
    return Response.json({ ok: true, record: result.rows[0] ?? null });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (isDatabaseConnectionError(error)) return Response.json({ error: connectionMessage(error) }, { status: 503 });
    if (error && typeof error === "object" && "code" in error && error.code === "23503") return Response.json({ error: "This record is linked to other records and cannot be removed or changed in this way." }, { status: 409 });
    if (error && typeof error === "object" && "code" in error && error.code === "23505") return Response.json({ error: "A record with these unique details already exists." }, { status: 409 });
    if (error && typeof error === "object" && "code" in error && error.code === "23514") return Response.json({ error: "One or more values are outside the allowed range. Review the field guidance and try again." }, { status: 400 });
    if (error && typeof error === "object" && "code" in error && error.code === "23502") return Response.json({ error: "A required database field is missing. Reopen this form and enter all required details." }, { status: 400 });
    return Response.json({ error: "The database could not save this record. Check required links and values." }, { status: 400 });
  } finally {
    client.release();
  }
}
