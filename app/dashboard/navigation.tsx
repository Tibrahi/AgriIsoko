"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { faBoxesStacked, faChartLine, faClipboardList, faDatabase, faHouse, faStore, faUsers, faWheatAwn } from "@fortawesome/free-solid-svg-icons";
import AppIcon from "@/app/fontawesome-icon";

type Item = readonly [string, string, string];
const icons = { overview: faHouse, records: faClipboardList, marketplace: faStore, harvest: faWheatAwn, availability: faBoxesStacked, analytics: faChartLine, data: faDatabase, accounts: faUsers };
export default function DashboardNavigation({ items, admin }: { items: readonly Item[]; admin: boolean }) {
  const pathname = usePathname();
  const links: Item[] = admin ? [...items, ["/dashboard/data", "Manage data", "data"], ["/dashboard/accounts", "Account requests", "accounts"]] : [...items];
  return <nav aria-label="Main navigation">{links.map(([href, label, icon]) => <Link className={`nav-link${pathname === href ? " active" : ""}`} href={href} key={href} aria-current={pathname === href ? "page" : undefined}><span className="nav-icon"><AppIcon icon={icons[icon as keyof typeof icons]} className="icon3d"/></span>{label}</Link>)}</nav>;
}
