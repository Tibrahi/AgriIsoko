"use client";

import Link from "next/link";

export default function PageControls({ page, pages, href, onPageChange }: { page: number; pages: number; href?: string; onPageChange?: (page: number) => void }) {
  if (pages < 2) return null;
  const separator = href?.includes("?") ? "&" : "?";
  const control = (label: string, target: number, disabled: boolean) => onPageChange
    ? <button type="button" disabled={disabled} onClick={() => onPageChange(target)}>{label}</button>
    : disabled ? <span className="disabled">{label}</span> : <Link href={`${href}${separator}page=${target}`}>{label}</Link>;
  return <nav className="page-controls" aria-label="Pages">
    {control("Previous", page - 1, page <= 1)}
    <span>Page {page} of {pages}</span>
    {control("Next", page + 1, page >= pages)}
  </nav>;
}
