"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = readonly [string, string, string];
export default function DashboardNavigation({ items, admin }: { items: readonly Item[]; admin: boolean }) {
  const pathname = usePathname();
  const links: Item[] = admin ? [...items, ["/dashboard/data", "Manage data", "▦"], ["/dashboard/accounts", "Account requests", "♙"]] : [...items];
  return <nav aria-label="Main navigation">{links.map(([href, label, icon]) => <Link className={`nav-link${pathname === href ? " active" : ""}`} href={href} key={href} aria-current={pathname === href ? "page" : undefined}><span className="nav-icon">{icon}</span>{label}</Link>)}</nav>;
}
