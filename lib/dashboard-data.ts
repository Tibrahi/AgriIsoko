import "server-only";
import { getPool } from "@/lib/agri-data";
import type { QueryResultRow } from "pg";

export type DataResult<T> = { available: true; rows: T[] } | { available: false; rows: []; message: string };

async function queryRows<T extends QueryResultRow>(sql: string, values: unknown[] = []): Promise<DataResult<T>> {
  try {
    const result = await getPool().query<T>(sql, values);
    return { available: true, rows: result.rows };
  } catch {
    return { available: false, rows: [], message: process.env.DATABASE_URL ? "Could not load records. Check the database connection and schema." : "Database connection is not configured." };
  }
}

export function getHarvestReports() {
  return queryRows<{ id: string; crop: string; district: string; quantity: string; type: string; status: string; date: string; source: string }>(
    `SELECT h.id, c.name AS crop, g.district_name AS district, h.quantity_kg::text AS quantity,
            h.report_type AS type, h.verification_status AS status, h.report_date::text AS date, h.source
     FROM harvest_reports h JOIN crops c ON c.id = h.crop_id JOIN geographies g ON g.id = h.geography_id
     ORDER BY h.report_date DESC, h.created_at DESC LIMIT 100`,
  );
}

export function getAvailability() {
  return queryRows<{ id: string; crop: string; district: string; quantity: string; asOf: string; source: string }>(
    `SELECT i.id, c.name AS crop, g.district_name AS district, i.available_kg::text AS quantity,
            i.as_of::date::text AS "asOf", i.source
     FROM inventory_balances i JOIN crops c ON c.id = i.crop_id JOIN geographies g ON g.id = i.geography_id
     WHERE i.verification_status = 'verified' AND i.available_kg > 0
     ORDER BY i.as_of DESC LIMIT 100`,
  );
}

export function getAnalytics() {
  return Promise.all([
    queryRows<{ crop: string; tonnes: string; reports: string }>(
      `SELECT c.name AS crop, (SUM(h.quantity_kg) / 1000)::numeric(14,1)::text AS tonnes,
              COUNT(*)::text AS reports
       FROM harvest_reports h JOIN crops c ON c.id = h.crop_id
       WHERE h.report_type = 'actual' AND h.verification_status = 'verified'
       GROUP BY c.name ORDER BY SUM(h.quantity_kg) DESC LIMIT 12`,
    ),
    queryRows<{ district: string; tonnes: string; reports: string }>(
      `SELECT g.district_name AS district, (SUM(h.quantity_kg) / 1000)::numeric(14,1)::text AS tonnes,
              COUNT(*)::text AS reports
       FROM harvest_reports h JOIN geographies g ON g.id = h.geography_id
       WHERE h.report_type = 'actual' AND h.verification_status = 'verified'
       GROUP BY g.district_name ORDER BY SUM(h.quantity_kg) DESC LIMIT 12`,
    ),
  ]);
}
