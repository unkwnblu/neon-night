"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconOverview, IconReceipt, IconScan, IconTicket } from "./Icons";

const ITEMS = [
  { href: "/admin", label: "Overview", Icon: IconOverview },
  { href: "/admin/sales", label: "Sales", Icon: IconReceipt },
  { href: "/admin/tiers", label: "Tiers", Icon: IconTicket },
  { href: "/admin/scan", label: "Check-in", Icon: IconScan },
] as const;

export function Nav() {
  const path = usePathname();
  return (
    <nav className="ad-nav" aria-label="Admin">
      {ITEMS.map(({ href, label, Icon }) => {
        const active = href === "/admin" ? path === "/admin" : path.startsWith(href);
        return (
          <Link key={href} href={href} className="ad-nav-item" aria-current={active ? "page" : undefined}>
            <Icon />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
