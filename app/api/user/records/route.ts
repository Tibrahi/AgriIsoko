import { connectionMessage, getPool } from "@/lib/agri-data";
import { getSession, verifySameOrigin } from "@/lib/auth";
import type { PoolClient } from "pg";

export const runtime = "nodejs";
const uuid = /^[0-9a-f-]{36}$/i;

function databaseUnavailable(error: unknown) {
  return connectionMessage(error);
}

async function activeProducer() {
  const user = await getSession();
  if (!user || user.status !== "active" || !user.organizationId) return null;
  if (!user.roles.some((role) => role === "farmer" || role === "buyer")) return null;
  return user;
}

export async function GET(request: Request) {
  const user = await activeProducer();
  if (!user) return Response.json({ error: "An approved farmer or buyer account is required." }, { status: 403 });
  try {
    const pool = getPool();
    const params = new URL(request.url).searchParams;
    const selectedKind = params.get("kind") ?? "";
    const requestedPage = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
    const pageSize = 25;
    const pagination: Record<string, { page: number; pages: number; total: number }> = {};
    const queries: Record<string, Promise<{ rows: unknown[] }>> = {
      farms: user.roles.includes("farmer") ? pool.query("SELECT f.id,f.geography_id,g.district_name AS district,f.cultivated_area_ha::text AS area,f.verification_status AS status,f.created_at::date::text AS date FROM farms f JOIN geographies g ON g.id=f.geography_id WHERE f.submitted_by=$1 ORDER BY f.created_at DESC LIMIT 100", [user.id]) : Promise.resolve({ rows: [] }),
      harvests: user.roles.includes("farmer") ? pool.query("SELECT h.id,h.farm_id,h.crop_id,h.season_id,h.geography_id,c.name AS crop,g.district_name AS district,h.quantity_kg::text AS quantity,h.report_type AS type,h.report_date::text AS date,h.expected_harvest_on::text AS expected_harvest_on,h.verification_status AS status,h.notes FROM harvest_reports h JOIN crops c ON c.id=h.crop_id JOIN geographies g ON g.id=h.geography_id WHERE h.submitted_by=$1 ORDER BY h.created_at DESC LIMIT 100", [user.id]) : Promise.resolve({ rows: [] }),
      inventory: user.roles.includes("farmer") ? pool.query("SELECT i.id,i.crop_id,i.geography_id,c.name AS crop,g.district_name AS district,i.quantity_kg::text AS quantity,i.available_kg::text AS available,i.as_of::date::text AS date,i.verification_status AS status FROM inventory_balances i JOIN crops c ON c.id=i.crop_id JOIN geographies g ON g.id=i.geography_id WHERE i.submitted_by=$1 ORDER BY i.created_at DESC LIMIT 100", [user.id]) : Promise.resolve({ rows: [] }),
      listings: user.roles.includes("farmer") ? pool.query("SELECT l.id,l.crop_id,l.geography_id,c.name AS crop,g.district_name AS district,l.available_quantity::text AS quantity,l.unit,l.price_per_unit::text AS price,l.currency,l.available_from::text AS available_from,l.status AS listing_status,l.verification_status AS status FROM marketplace_listings l JOIN crops c ON c.id=l.crop_id JOIN geographies g ON g.id=l.geography_id WHERE l.created_by=$1 ORDER BY l.created_at DESC LIMIT 100", [user.id]) : Promise.resolve({ rows: [] }),
      orders: pool.query("SELECT mo.id,mo.listing_id,mo.agreed_price_per_unit::text AS agreed_price_per_unit,c.name AS crop,mo.quantity::text AS quantity,mo.status,CASE WHEN mo.created_by=$1 THEN 'buyer' ELSE 'seller' END AS view_as,mo.created_at::date::text AS date,o.name AS other_party FROM marketplace_orders mo JOIN marketplace_listings l ON l.id=mo.listing_id JOIN crops c ON c.id=l.crop_id JOIN organizations buyer ON buyer.id=mo.buyer_organization_id JOIN organizations seller ON seller.id=l.seller_organization_id JOIN organizations o ON o.id=CASE WHEN mo.created_by=$1 THEN seller.id ELSE buyer.id END WHERE mo.created_by=$1 OR l.seller_organization_id=$2 ORDER BY mo.created_at DESC LIMIT 100", [user.id,user.organizationId]),
      crops: pool.query("SELECT id,name AS label FROM crops WHERE active ORDER BY name"),
      locations: pool.query("SELECT id,concat_ws(' · ',district_name,sector_name,cell_name,village_name) AS label FROM geographies ORDER BY district_name,sector_name NULLS FIRST LIMIT 1000"),
      seasons: pool.query("SELECT id,name || ' (' || starts_on::text || ')' AS label FROM seasons ORDER BY starts_on DESC LIMIT 200"),
      farmsOptions: user.roles.includes("farmer") ? pool.query("SELECT id,g.district_name || ' · ' || coalesce(f.cultivated_area_ha::text,'') || ' ha' AS label FROM farms f JOIN geographies g ON g.id=f.geography_id WHERE f.submitted_by=$1 ORDER BY f.created_at DESC", [user.id]) : Promise.resolve({ rows: [] }),
      listingsOptions: user.roles.includes("buyer") ? pool.query("SELECT l.id,c.name || ' · ' || o.name || ' · ' || l.available_quantity::text || ' ' || l.unit AS label FROM marketplace_listings l JOIN crops c ON c.id=l.crop_id JOIN organizations o ON o.id=l.seller_organization_id WHERE l.seller_organization_id<>$1 AND l.status='open' AND l.verification_status='verified' AND l.available_quantity>0 AND (l.available_from IS NULL OR l.available_from<=CURRENT_DATE) ORDER BY l.created_at DESC LIMIT 100",[user.organizationId]) : Promise.resolve({ rows: [] }),
    };
    const entries = await Promise.all(Object.entries(queries).map(async ([key, promise]) => [key, (await promise).rows] as const));
    const result: Record<string, unknown> = Object.fromEntries(entries);
    const pagedKinds: Record<string, { key: string; countSql: string; querySql: string; values: unknown[] }> = {
      farms: { key: "farms", countSql: "SELECT count(*)::text AS total FROM farms WHERE submitted_by=$1", querySql: "SELECT f.id,f.geography_id,g.district_name AS district,f.cultivated_area_ha::text AS area,f.verification_status AS status,f.created_at::date::text AS date FROM farms f JOIN geographies g ON g.id=f.geography_id WHERE f.submitted_by=$1 ORDER BY f.created_at DESC LIMIT $2 OFFSET $3", values: [user.id] },
      harvest_reports: { key: "harvests", countSql: "SELECT count(*)::text AS total FROM harvest_reports WHERE submitted_by=$1", querySql: "SELECT h.id,h.farm_id,h.crop_id,h.season_id,h.geography_id,c.name AS crop,g.district_name AS district,h.quantity_kg::text AS quantity,h.report_type AS type,h.report_date::text AS date,h.expected_harvest_on::text AS expected_harvest_on,h.verification_status AS status,h.notes FROM harvest_reports h JOIN crops c ON c.id=h.crop_id JOIN geographies g ON g.id=h.geography_id WHERE h.submitted_by=$1 ORDER BY h.created_at DESC LIMIT $2 OFFSET $3", values: [user.id] },
      inventory_balances: { key: "inventory", countSql: "SELECT count(*)::text AS total FROM inventory_balances WHERE submitted_by=$1", querySql: "SELECT i.id,i.crop_id,i.geography_id,c.name AS crop,g.district_name AS district,i.quantity_kg::text AS quantity,i.available_kg::text AS available,i.as_of::date::text AS date,i.verification_status AS status FROM inventory_balances i JOIN crops c ON c.id=i.crop_id JOIN geographies g ON g.id=i.geography_id WHERE i.submitted_by=$1 ORDER BY i.created_at DESC LIMIT $2 OFFSET $3", values: [user.id] },
      marketplace_listings: { key: "listings", countSql: "SELECT count(*)::text AS total FROM marketplace_listings WHERE created_by=$1", querySql: "SELECT l.id,l.crop_id,l.geography_id,c.name AS crop,g.district_name AS district,l.available_quantity::text AS quantity,l.unit,l.price_per_unit::text AS price,l.currency,l.available_from::text AS available_from,l.status AS listing_status,l.verification_status AS status FROM marketplace_listings l JOIN crops c ON c.id=l.crop_id JOIN geographies g ON g.id=l.geography_id WHERE l.created_by=$1 ORDER BY l.created_at DESC LIMIT $2 OFFSET $3", values: [user.id] },
      marketplace_orders: { key: "orders", countSql: "SELECT count(*)::text AS total FROM marketplace_orders mo JOIN marketplace_listings l ON l.id=mo.listing_id WHERE mo.created_by=$1 OR l.seller_organization_id=$2", querySql: "SELECT mo.id,mo.listing_id,mo.agreed_price_per_unit::text AS agreed_price_per_unit,c.name AS crop,mo.quantity::text AS quantity,mo.status,CASE WHEN mo.created_by=$1 THEN 'buyer' ELSE 'seller' END AS view_as,mo.created_at::date::text AS date,o.name AS other_party FROM marketplace_orders mo JOIN marketplace_listings l ON l.id=mo.listing_id JOIN crops c ON c.id=l.crop_id JOIN organizations buyer ON buyer.id=mo.buyer_organization_id JOIN organizations seller ON seller.id=l.seller_organization_id JOIN organizations o ON o.id=CASE WHEN mo.created_by=$1 THEN seller.id ELSE buyer.id END WHERE mo.created_by=$1 OR l.seller_organization_id=$2 ORDER BY mo.created_at DESC LIMIT $3 OFFSET $4", values: [user.id,user.organizationId] },
    };
    const descriptor = pagedKinds[selectedKind];
    if (descriptor) {
      const count = await pool.query<{ total: string }>(descriptor.countSql, descriptor.values);
      const total = Number(count.rows[0]?.total ?? 0);
      const pages = Math.max(1, Math.ceil(total / pageSize));
      const page = Math.min(requestedPage, pages);
      const resultPage = await pool.query(descriptor.querySql, [...descriptor.values, pageSize, (page - 1) * pageSize]);
      result[descriptor.key] = resultPage.rows;
      pagination[selectedKind] = { page, pages, total };
    }
    return Response.json({ ...result, pagination }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: databaseUnavailable(error) }, { status: 503 });
  }
}

function text(value: unknown, label: string, required = true): string | null {
  if (typeof value !== "string") { if (!required) return null; throw new Error(`${label} is required.`); }
  const result = value.trim();
  if (!result && required) throw new Error(`${label} is required.`);
  return result || null;
}
function id(value: unknown, label: string, required = true): string | null {
  const result = text(value, label, required);
  if (result && !uuid.test(result)) throw new Error(`Choose a valid ${label.toLowerCase()}.`);
  return result;
}
function number(value: unknown, label: string, required = true): number | null {
  if ((value === "" || value === null || value === undefined) && !required) return null;
  const result = Number(value);
  if (!Number.isFinite(result) || result < 0 || (required && value === "")) throw new Error(`${label} must be a non-negative number.`);
  return result;
}
function date(value: unknown, label: string, required = true): string | null {
  const result = text(value, label, required);
  if (result && !/^\d{4}-\d{2}-\d{2}$/.test(result)) throw new Error(`Enter a valid ${label.toLowerCase()}.`);
  return result;
}
function object(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Enter valid record details.");
  return value as Record<string, unknown>;
}
async function actor(request: Request) {
  if (!verifySameOrigin(request)) return { response: Response.json({ error: "Request origin could not be verified." }, { status: 403 }) };
  const user = await activeProducer();
  if (!user) return { response: Response.json({ error: "An approved farmer or buyer account is required." }, { status: 403 }) };
  return { user };
}

async function writeAudit(client: PoolClient, userId: string, type: string, recordId: string, action: string, before: unknown, after: unknown) {
  await client.query("INSERT INTO audit_events(actor_user_id,entity_type,entity_id,action,before_state,after_state) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb)", [userId,type,recordId,action,before ? JSON.stringify(before) : null,after ? JSON.stringify(after) : null]);
}

export async function POST(request: Request) {
  const auth = await actor(request); if (!auth.user) return auth.response;
  const user = auth.user;
  let body: Record<string, unknown>;
  try { body = object(await request.json()); } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Enter valid record details." }, { status: 400 }); }
  const kind = String(body.kind ?? "");
  const values = (() => { try { return object(body.values); } catch { return {}; } })();
  const farmer = user.roles.includes("farmer");
  if ((!farmer && kind !== "marketplace_orders") || (farmer && !["farms","harvest_reports","inventory_balances","marketplace_listings","marketplace_orders"].includes(kind))) return Response.json({ error: "This record type is not enabled for your role." }, { status: 403 });
  if (!values) return Response.json({ error: "Enter record details." }, { status: 400 });
  let client: PoolClient;
  try { client = await getPool().connect(); }
  catch (error) { return Response.json({ error: databaseUnavailable(error) }, { status: 503 }); }
  try {
    await client.query("BEGIN");
    let result;
    if (kind === "farms") {
      const geographyId = id(values.geography_id,"location")!;
      const area = number(values.cultivated_area_ha,"cultivated area",false);
      result = await client.query("INSERT INTO farms(organization_id,geography_id,cultivated_area_ha,verification_status,submitted_by) VALUES($1,$2,$3,'submitted',$4) RETURNING *", [user.organizationId,geographyId,area,user.id]);
    } else if (kind === "harvest_reports") {
      const cropId=id(values.crop_id,"crop")!, geographyId=id(values.geography_id,"location")!;
      const farmId=id(values.farm_id,"farm",false), seasonId=id(values.season_id,"season",false);
      if (farmId) { const farm = await client.query("SELECT 1 FROM farms WHERE id=$1 AND submitted_by=$2",[farmId,user.id]); if (!farm.rowCount) throw new Error("Choose one of your own farms."); }
      const type=String(text(values.report_type,"report type")); if (!["intention","progress","actual"].includes(type)) throw new Error("Choose a supported report type.");
      const quantity=number(values.quantity_kg,"quantity")!, reportDate=date(values.report_date,"report date")!, expected=date(values.expected_harvest_on,"expected harvest date",false);
      result=await client.query("INSERT INTO harvest_reports(farm_id,organization_id,crop_id,season_id,geography_id,report_type,quantity_kg,expected_harvest_on,report_date,source,notes,verification_status,submitted_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'farmer_portal',$10,'submitted',$11) RETURNING *",[farmId,user.organizationId,cropId,seasonId,geographyId,type,quantity,expected,reportDate,text(values.notes,"notes",false),user.id]);
    } else if (kind === "inventory_balances") {
      const cropId=id(values.crop_id,"crop")!, geographyId=id(values.geography_id,"location")!;
      const quantity=number(values.quantity_kg,"total quantity")!, available=number(values.available_kg,"available quantity")!;
      if (available>quantity) throw new Error("Available quantity cannot exceed total quantity.");
      const asOf=date(values.as_of,"date")!;
      result=await client.query("INSERT INTO inventory_balances(organization_id,crop_id,geography_id,quantity_kg,available_kg,as_of,source,verification_status,submitted_by) VALUES($1,$2,$3,$4,$5,$6,'farmer_portal','submitted',$7) RETURNING *",[user.organizationId,cropId,geographyId,quantity,available,asOf,user.id]);
    } else if (kind === "marketplace_listings") {
      const cropId=id(values.crop_id,"crop")!, geographyId=id(values.geography_id,"location")!;
      const quantity=number(values.available_quantity,"available quantity")!; if (quantity<=0) throw new Error("A listing quantity must be greater than zero.");
      const unit=String(text(values.unit,"unit")); if (unit.length>12) throw new Error("Unit must be 12 characters or fewer.");
      const currency=String(text(values.currency,"currency")??"RWF").toUpperCase(); if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Currency must be a three-letter code.");
      result=await client.query("INSERT INTO marketplace_listings(seller_organization_id,crop_id,geography_id,available_quantity,unit,price_per_unit,currency,available_from,status,verification_status,source,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'open','submitted','farmer_portal',$9) RETURNING *",[user.organizationId,cropId,geographyId,quantity,unit,number(values.price_per_unit,"price",false),currency,date(values.available_from,"available date",false),user.id]);
    } else {
      if (!user.roles.includes("buyer")) throw new Error("Only buyers can create purchase requests.");
      const listingId=id(values.listing_id,"listing")!, quantity=number(values.quantity,"order quantity")!;
      if (quantity<=0) throw new Error("Order quantity must be greater than zero.");
      const listing=await client.query("SELECT * FROM marketplace_listings WHERE id=$1 AND status='open' AND verification_status='verified' AND (available_from IS NULL OR available_from<=CURRENT_DATE) FOR UPDATE",[listingId]);
      if (!listing.rows[0]) throw new Error("That verified listing is no longer available.");
      if (listing.rows[0].seller_organization_id === user.organizationId) throw new Error("You cannot place a purchase request with your own organization.");
      const reserved=await client.query("SELECT coalesce(sum(quantity),0)::numeric AS quantity FROM marketplace_orders WHERE listing_id=$1 AND status IN ('requested','accepted','in_delivery')",[listingId]);
      const remaining=Number(listing.rows[0].available_quantity)-Number(reserved.rows[0].quantity);
      if (quantity>remaining) throw new Error("The requested amount exceeds the remaining listed quantity.");
      const price=number(values.agreed_price_per_unit,"offer price",false);
      result=await client.query("INSERT INTO marketplace_orders(listing_id,buyer_organization_id,quantity,agreed_price_per_unit,currency,status,created_by) VALUES($1,$2,$3,$4,$5,'requested',$6) RETURNING *",[listingId,user.organizationId,quantity,price,listing.rows[0].currency,user.id]);
    }
    const recordId=result.rows[0].id;
    await writeAudit(client,user.id,kind,recordId,"user_created",null,result.rows[0]);
    await client.query("COMMIT");
    return Response.json({ ok:true,record:result.rows[0] },{status:201});
  } catch(error) {
    await client.query("ROLLBACK").catch(()=>undefined);
    if (error && typeof error === "object" && "code" in error && error.code === "23503") return Response.json({error:"Choose a linked record that exists and is available."},{status:400});
    return Response.json({error:error instanceof Error?error.message:"Could not save your record."},{status:400});
  } finally { client.release(); }
}

export async function PATCH(request: Request) {
  const auth=await actor(request); if(!auth.user)return auth.response;
  const user=auth.user;
  let body:Record<string,unknown>; try{body=object(await request.json());}catch{return Response.json({error:"Enter a valid update."},{status:400});}
  const kind=String(body.kind??""); let recordId:string; try{recordId=id(body.id,"record")!;}catch(error){return Response.json({error:error instanceof Error?error.message:"Choose a valid record."},{status:400});}
  const values=(()=>{try{return object(body.values);}catch{return {};}})();
  let client:PoolClient;try{client=await getPool().connect();}catch(error){return Response.json({error:databaseUnavailable(error)},{status:503});}
  try{
    await client.query("BEGIN");
    let old;
    if(kind==="farms"&&user.roles.includes("farmer")) old=await client.query("SELECT * FROM farms WHERE id=$1 AND submitted_by=$2 FOR UPDATE",[recordId,user.id]);
    else if(kind==="harvest_reports"&&user.roles.includes("farmer")) old=await client.query("SELECT * FROM harvest_reports WHERE id=$1 AND submitted_by=$2 FOR UPDATE",[recordId,user.id]);
    else if(kind==="inventory_balances"&&user.roles.includes("farmer")) old=await client.query("SELECT * FROM inventory_balances WHERE id=$1 AND submitted_by=$2 FOR UPDATE",[recordId,user.id]);
    else if(kind==="marketplace_listings"&&user.roles.includes("farmer")) old=await client.query("SELECT * FROM marketplace_listings WHERE id=$1 AND created_by=$2 FOR UPDATE",[recordId,user.id]);
    else if(kind==="marketplace_orders") old=await client.query("SELECT mo.*, l.seller_organization_id FROM marketplace_orders mo JOIN marketplace_listings l ON l.id=mo.listing_id WHERE mo.id=$1 FOR UPDATE OF mo",[recordId]);
    else return Response.json({error:"This record type cannot be edited by your account."},{status:403});
    const previous=old.rows[0]; if(!previous){await client.query("ROLLBACK");return Response.json({error:"Record not found in your workspace."},{status:404});}
    let result;
    if(kind==="farms"||kind==="harvest_reports"||kind==="inventory_balances"||kind==="marketplace_listings"){
      if(previous.verification_status==="verified") throw new Error("Verified records are locked; contact an administrator to request a correction.");
      if(kind==="farms") result=await client.query("UPDATE farms SET geography_id=$1,cultivated_area_ha=$2,verification_status='submitted',verified_by=NULL,verified_at=NULL WHERE id=$3 RETURNING *",[id(values.geography_id,"location")!,number(values.cultivated_area_ha,"cultivated area",false),recordId]);
      else if(kind==="harvest_reports"){
        const farmId=id(values.farm_id,"farm",false); if(farmId){const f=await client.query("SELECT 1 FROM farms WHERE id=$1 AND submitted_by=$2",[farmId,user.id]);if(!f.rowCount)throw new Error("Choose one of your own farms.");}
        const type=String(text(values.report_type,"report type"));if(!["intention","progress","actual"].includes(type))throw new Error("Choose a supported report type.");
        result=await client.query("UPDATE harvest_reports SET farm_id=$1,crop_id=$2,season_id=$3,geography_id=$4,report_type=$5,quantity_kg=$6,expected_harvest_on=$7,report_date=$8,notes=$9,verification_status='submitted',verified_by=NULL,verified_at=NULL WHERE id=$10 RETURNING *",[farmId,id(values.crop_id,"crop")!,id(values.season_id,"season",false),id(values.geography_id,"location")!,type,number(values.quantity_kg,"quantity")!,date(values.expected_harvest_on,"expected harvest date",false),date(values.report_date,"report date")!,text(values.notes,"notes",false),recordId]);
      } else if(kind==="inventory_balances"){
        const quantity=number(values.quantity_kg,"total quantity")!,available=number(values.available_kg,"available quantity")!;if(available>quantity)throw new Error("Available quantity cannot exceed total quantity.");
        result=await client.query("UPDATE inventory_balances SET crop_id=$1,geography_id=$2,quantity_kg=$3,available_kg=$4,as_of=$5,verification_status='submitted',verified_by=NULL,verified_at=NULL WHERE id=$6 RETURNING *",[id(values.crop_id,"crop")!,id(values.geography_id,"location")!,quantity,available,date(values.as_of,"date")!,recordId]);
      } else {
        const quantity=number(values.available_quantity,"available quantity")!;if(quantity<=0)throw new Error("A listing quantity must be greater than zero.");
        const currency=String(text(values.currency,"currency")??"RWF").toUpperCase();if(!/^[A-Z]{3}$/.test(currency))throw new Error("Currency must be a three-letter code.");
        result=await client.query("UPDATE marketplace_listings SET crop_id=$1,geography_id=$2,available_quantity=$3,unit=$4,price_per_unit=$5,currency=$6,available_from=$7,verification_status='submitted' WHERE id=$8 RETURNING *",[id(values.crop_id,"crop")!,id(values.geography_id,"location")!,quantity,text(values.unit,"unit")!,number(values.price_per_unit,"price",false),currency,date(values.available_from,"available date",false),recordId]);
      }
    } else {
      const next=String(body.status??"");
      const isBuyer=previous.created_by===user.id && previous.buyer_organization_id===user.organizationId;
      const isSeller=previous.seller_organization_id===user.organizationId && user.roles.includes("farmer");
      const allowed=isBuyer && previous.status==="requested" && next==="cancelled" || isSeller && (previous.status==="requested"&&["accepted","rejected"].includes(next)||previous.status==="accepted"&&next==="in_delivery"||previous.status==="in_delivery"&&next==="completed");
      if(!allowed)throw new Error("That order can no longer be changed by your account.");
      result=await client.query("UPDATE marketplace_orders SET status=$1,updated_at=now() WHERE id=$2 RETURNING *",[next,recordId]);
      if(next==="completed") await client.query("UPDATE marketplace_listings SET available_quantity=greatest(available_quantity-$1,0), status=CASE WHEN available_quantity<=$1 THEN 'fulfilled' ELSE status END WHERE id=$2",[previous.quantity,previous.listing_id]);
    }
    await writeAudit(client,user.id,kind,recordId,"user_updated",previous,result.rows[0]);await client.query("COMMIT");return Response.json({ok:true,record:result.rows[0]});
  }catch(error){await client.query("ROLLBACK").catch(()=>undefined);return Response.json({error:error instanceof Error?error.message:"Could not update your record."},{status:400});}finally{client.release();}
}

export async function DELETE(request: Request) {
  const auth=await actor(request);if(!auth.user)return auth.response;
  const user=auth.user;let body:Record<string,unknown>;try{body=object(await request.json());}catch{return Response.json({error:"Choose a record to remove."},{status:400});}
  const kind=String(body.kind??"");let recordId:string;try{recordId=id(body.id,"record")!;}catch(error){return Response.json({error:error instanceof Error?error.message:"Choose a valid record."},{status:400});}
  const ownership:Record<string,string>={farms:"submitted_by",harvest_reports:"submitted_by",inventory_balances:"submitted_by",marketplace_listings:"created_by"};
  if(!Object.hasOwn(ownership,kind)||!user.roles.includes("farmer"))return Response.json({error:"This record cannot be deleted from your account."},{status:403});
  let client:PoolClient;try{client=await getPool().connect();}catch(error){return Response.json({error:databaseUnavailable(error)},{status:503});}
  try{await client.query("BEGIN");const old=await client.query(`SELECT * FROM ${kind} WHERE id=$1 AND ${ownership[kind]}=$2 FOR UPDATE`,[recordId,user.id]);if(!old.rows[0]){await client.query("ROLLBACK");return Response.json({error:"Record not found in your workspace."},{status:404});}if(old.rows[0].verification_status==="verified")throw new Error("Verified records cannot be deleted. Contact an administrator to request a correction.");await client.query(`DELETE FROM ${kind} WHERE id=$1`,[recordId]);await writeAudit(client,user.id,kind,recordId,"user_deleted",old.rows[0],null);await client.query("COMMIT");return Response.json({ok:true});}catch(error){await client.query("ROLLBACK").catch(()=>undefined);if(error&&typeof error==="object"&&"code"in error&&error.code==="23503")return Response.json({error:"This record is linked to other records and cannot be deleted."},{status:409});return Response.json({error:error instanceof Error?error.message:"Could not delete record."},{status:400});}finally{client.release();}
}
