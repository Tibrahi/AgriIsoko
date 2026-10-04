import "server-only";

import { Pool } from "pg";

export type DashboardData = {
  status: "connected" | "unavailable";
  message: string;
  harvestTonnes: number;
  harvestReports: number;
  availableTonnes: number;
  openListings: number;
  pendingReports: number;
  recentReports: Array<{ id: string; crop: string; location: string; quantity: number; unit: string; status: string; reportDate: string }>;
};

export type MarketplaceData = {
  status: "connected" | "unavailable";
  message: string;
  listings: Array<{ id: string; crop: string; seller: string; district: string; quantity: number; unit: string; price: number | null; currency: string; availableFrom: string | null }>;
};

declare global {
  var agriIsokoPool: Pool | undefined;
  var agriIsokoPoolUrl: string | undefined;
}

export function getPool() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("DATABASE_URL is not configured.");
  let parsed: URL;
  try { parsed = new URL(connectionString); }
  catch { throw new Error("DATABASE_URL is not a valid PostgreSQL URI."); }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol) || !parsed.hostname || parsed.pathname.length < 2) {
    throw new Error("DATABASE_URL must be a PostgreSQL URI with a host and database name.");
  }
  if (global.agriIsokoPool && global.agriIsokoPoolUrl !== connectionString) {
    void global.agriIsokoPool.end().catch(() => undefined);
    global.agriIsokoPool = undefined;
  }
  if (!global.agriIsokoPool) {
    global.agriIsokoPool = new Pool({
      connectionString,
      max: 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 10000,
      query_timeout: 10000,
      statement_timeout: 10000,
    });
    global.agriIsokoPool.on("error", () => {
      console.error("AgriIsoko PostgreSQL pool reported an idle connection error.");
    });
    global.agriIsokoPoolUrl = connectionString;
  }
  return global.agriIsokoPool;
}

export function connectionMessage(error?: unknown) {
  if (!process.env.DATABASE_URL?.trim()) return "DATABASE_URL is missing.";
  if (error instanceof Error && error.message.includes("DATABASE_URL")) return "DATABASE_URL must be a valid PostgreSQL URI with a host and database name.";
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  const detail = error instanceof Error ? error.message : "";
  if (code === "EAI_AGAIN" || code === "ENOTFOUND" || /getaddrinfo.*EAI_AGAIN|ENOTFOUND/i.test(detail)) return "The Neon hostname could not be resolved. Check the host in DATABASE_URL and the device's DNS or internet connection.";
  if (code === "ETIMEDOUT" || code === "ECONNREFUSED" || code === "ECONNRESET") return "The Neon server did not respond. Check internet access, Neon project availability, and the connection URI.";
  if (code === "28P01") return "Neon rejected the database credentials. Check the username and password in DATABASE_URL.";
  if (code === "3D000") return "The database in DATABASE_URL was not found. Copy the connection URI for the correct Neon database.";
  if (code === "42501") return "The Neon database user lacks permissions required by AgriIsoko.";
  if (code === "42P01" || code === "42703") return "Neon is reachable, but the AgriIsoko schema is incomplete. Apply the latest migrations.";
  return "PostgreSQL could not be reached or the AgriIsoko schema is not installed.";
}

export async function getDatabaseStatus(): Promise<{ status: "connected" | "unavailable"; message: string; version?: string }> {
  try {
    const result = await getPool().query<{ version: string; schema_ready: boolean; write_ready: boolean }>(`
      SELECT current_setting('server_version') AS version,
        (to_regclass('public.users') IS NOT NULL AND to_regclass('public.auth_sessions') IS NOT NULL AND
         to_regclass('public.user_roles') IS NOT NULL AND to_regclass('public.harvest_reports') IS NOT NULL AND
         to_regclass('public.inventory_balances') IS NOT NULL AND to_regclass('public.marketplace_listings') IS NOT NULL AND
         to_regclass('public.marketplace_orders') IS NOT NULL AND to_regclass('public.audit_events') IS NOT NULL AND
         to_regclass('public.crops') IS NOT NULL AND to_regclass('public.geographies') IS NOT NULL AND
         to_regclass('public.organizations') IS NOT NULL AND to_regclass('public.seasons') IS NOT NULL AND
         to_regclass('public.farms') IS NOT NULL AND to_regclass('public.roles') IS NOT NULL) AS schema_ready,
        (has_table_privilege(current_user, to_regclass('public.users'), 'SELECT,INSERT,UPDATE') AND
         has_table_privilege(current_user, to_regclass('public.auth_sessions'), 'SELECT,INSERT,DELETE') AND
         has_table_privilege(current_user, to_regclass('public.user_roles'), 'SELECT,INSERT,DELETE') AND
         has_table_privilege(current_user, to_regclass('public.roles'), 'SELECT') AND
         has_table_privilege(current_user, to_regclass('public.audit_events'), 'INSERT') AND
         has_table_privilege(current_user, to_regclass('public.organizations'), 'SELECT,INSERT,UPDATE,DELETE') AND
         has_table_privilege(current_user, to_regclass('public.crops'), 'SELECT,INSERT,UPDATE,DELETE') AND
         has_table_privilege(current_user, to_regclass('public.geographies'), 'SELECT,INSERT,UPDATE,DELETE') AND
         has_table_privilege(current_user, to_regclass('public.seasons'), 'SELECT,INSERT,UPDATE,DELETE') AND
         has_table_privilege(current_user, to_regclass('public.farms'), 'SELECT,INSERT,UPDATE,DELETE') AND
         has_table_privilege(current_user, to_regclass('public.harvest_reports'), 'SELECT,INSERT,UPDATE,DELETE') AND
         has_table_privilege(current_user, to_regclass('public.inventory_balances'), 'SELECT,INSERT,UPDATE,DELETE') AND
         has_table_privilege(current_user, to_regclass('public.marketplace_listings'), 'SELECT,INSERT,UPDATE,DELETE') AND
         has_table_privilege(current_user, to_regclass('public.marketplace_orders'), 'SELECT,INSERT,UPDATE,DELETE')) AS write_ready
    `);
    const row = result.rows[0];
    if (!row.schema_ready) return { status: "unavailable", message: "Neon is reachable, but the AgriIsoko tables are incomplete. Apply the database migrations." };
    if (!row.write_ready) return { status: "unavailable", message: "Neon is reachable, but its database role lacks the read/write permissions required by AgriIsoko." };
    return { status: "connected", message: "Database schema and application read/write access are available.", version: row.version };
  } catch (error) {
    return { status: "unavailable", message: connectionMessage(error) };
  }
}

export async function getDashboardData(): Promise<DashboardData> {
  try {
    const pool = getPool();
    const [summary, reports] = await Promise.all([
      pool.query<{
        harvest_tonnes: string | null;
        harvest_reports: string;
        available_tonnes: string | null;
        open_listings: string;
        pending_reports: string;
      }>(`
        SELECT
          (SELECT SUM(quantity_kg) / 1000.0 FROM harvest_reports WHERE report_type = 'actual' AND verification_status = 'verified') AS harvest_tonnes,
          (SELECT COUNT(*) FROM harvest_reports WHERE report_type = 'actual' AND verification_status = 'verified')::text AS harvest_reports,
          (SELECT SUM(available_kg) / 1000.0 FROM inventory_balances WHERE verification_status = 'verified' AND available_kg > 0) AS available_tonnes,
          (SELECT COUNT(*) FROM marketplace_listings WHERE status = 'open' AND verification_status = 'verified' AND available_quantity > 0)::text AS open_listings,
          (SELECT COUNT(*) FROM harvest_reports WHERE verification_status = 'submitted')::text AS pending_reports
      `),
      pool.query<{
        id: string;
        crop_name: string;
        district_name: string;
        quantity_kg: string;
        verification_status: string;
        report_date: string;
      }>(`
        SELECT h.id, c.name AS crop_name, g.district_name,
               h.quantity_kg::text, h.verification_status, h.report_date::text
        FROM harvest_reports h
        JOIN crops c ON c.id = h.crop_id
        JOIN geographies g ON g.id = h.geography_id
        WHERE h.report_type = 'actual'
        ORDER BY h.report_date DESC, h.created_at DESC
        LIMIT 5
      `),
    ]);
    const row = summary.rows[0];
    return {
      status: "connected",
      message: "",
      harvestTonnes: Number(row.harvest_tonnes ?? 0),
      harvestReports: Number(row.harvest_reports),
      availableTonnes: Number(row.available_tonnes ?? 0),
      openListings: Number(row.open_listings),
      pendingReports: Number(row.pending_reports),
      recentReports: reports.rows.map((item) => ({
        id: item.id,
        crop: item.crop_name,
        location: item.district_name,
        quantity: Number(item.quantity_kg),
        unit: "kg",
        status: item.verification_status,
        reportDate: item.report_date,
      })),
    };
  } catch (error) {
    return {
      status: "unavailable",
      message: connectionMessage(error),
      harvestTonnes: 0,
      harvestReports: 0,
      availableTonnes: 0,
      openListings: 0,
      pendingReports: 0,
      recentReports: [],
    };
  }
}

export async function getMarketplaceData(): Promise<MarketplaceData> {
  try {
    const result = await getPool().query<{
      id: string; crop: string; seller: string; district: string; quantity: string;
      unit: string; price: string | null; currency: string; available_from: string | null;
    }>(`
      SELECT l.id, c.name AS crop, o.name AS seller, g.district_name AS district,
             greatest(l.available_quantity - coalesce((SELECT sum(mo.quantity) FROM marketplace_orders mo WHERE mo.listing_id=l.id AND mo.status IN ('requested','accepted','in_delivery')),0),0)::text AS quantity, l.unit,
             l.price_per_unit::text AS price, l.currency, l.available_from::text
      FROM marketplace_listings l
      JOIN crops c ON c.id = l.crop_id
      JOIN organizations o ON o.id = l.seller_organization_id
      JOIN geographies g ON g.id = l.geography_id
      WHERE l.status = 'open' AND l.verification_status = 'verified'
        AND l.available_quantity > coalesce((SELECT sum(mo.quantity) FROM marketplace_orders mo WHERE mo.listing_id=l.id AND mo.status IN ('requested','accepted','in_delivery')),0)
        AND (l.available_from IS NULL OR l.available_from <= CURRENT_DATE)
      ORDER BY l.created_at DESC
      LIMIT 40
    `);
    return { status: "connected", message: "", listings: result.rows.map((row) => ({
      id: row.id, crop: row.crop, seller: row.seller, district: row.district,
      quantity: Number(row.quantity), unit: row.unit, price: row.price === null ? null : Number(row.price),
      currency: row.currency, availableFrom: row.available_from,
    })) };
  } catch (error) {
    return { status: "unavailable", message: connectionMessage(error), listings: [] };
  }
}
