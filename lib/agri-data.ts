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

declare global {
  var agriIsokoPool: Pool | undefined;
}

export function getPool() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  global.agriIsokoPool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 2500, idleTimeoutMillis: 10000 });
  return global.agriIsokoPool;
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
    const message = error instanceof Error ? error.message : "The database could not be reached.";
    return {
      status: "unavailable",
      message: message.includes("DATABASE_URL") ? "DATABASE_URL is missing." : "PostgreSQL could not be reached or the AgriIsoko schema is not installed.",
      harvestTonnes: 0,
      harvestReports: 0,
      availableTonnes: 0,
      openListings: 0,
      pendingReports: 0,
      recentReports: [],
    };
  }
}
