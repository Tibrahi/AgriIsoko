import "server-only";
import type { SessionUser } from "@/lib/auth";
import { connectionMessage, getPool } from "@/lib/agri-data";

export async function getPersonalWorkspace(user: SessionUser) {
  try {
    const [counts, reports] = await Promise.all([
      getPool().query<{ farms: string; harvests: string; inventory: string; listings: string; orders: string }>(
        `SELECT
          (SELECT count(*) FROM farms WHERE submitted_by = $1)::text AS farms,
          (SELECT count(*) FROM harvest_reports WHERE submitted_by = $1)::text AS harvests,
          (SELECT count(*) FROM inventory_balances WHERE submitted_by = $1)::text AS inventory,
          (SELECT count(*) FROM marketplace_listings WHERE created_by = $1)::text AS listings,
          (SELECT count(*) FROM marketplace_orders WHERE created_by = $1)::text AS orders`, [user.id],
      ),
      getPool().query<{ id: string; crop: string; quantity: string; district: string; status: string; report_date: string }>(
        `SELECT h.id, c.name AS crop, h.quantity_kg::text AS quantity, g.district_name AS district,
                h.verification_status AS status, h.report_date::text
         FROM harvest_reports h JOIN crops c ON c.id=h.crop_id JOIN geographies g ON g.id=h.geography_id
         WHERE h.submitted_by=$1 ORDER BY h.created_at DESC LIMIT 5`, [user.id],
      ),
    ]);
    return { available: true as const, message: "", ...counts.rows[0], reports: reports.rows };
  } catch (error) {
    return { available: false as const, message: connectionMessage(error), farms: "0", harvests: "0", inventory: "0", listings: "0", orders: "0", reports: [] as { id: string; crop: string; quantity: string; district: string; status: string; report_date: string }[] };
  }
}
