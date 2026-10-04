"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const pageNames: Record<string, string> = {
  "/dashboard": "Overview",
  "/dashboard/my-records": "My records",
  "/dashboard/marketplace": "Marketplace",
  "/dashboard/harvest-reports": "Harvest reports",
  "/dashboard/availability": "Availability",
  "/dashboard/analytics": "Analytics",
  "/dashboard/accounts": "Account requests",
  "/dashboard/data": "Manage data",
};

export default function DashboardBreadcrumbs() {
  const pathname = usePathname();
  return <div className="breadcrumbs"><Link href="/dashboard">AgriIsoko</Link><span>/</span><strong>{pageNames[pathname] ?? "Overview"}</strong></div>;
}
