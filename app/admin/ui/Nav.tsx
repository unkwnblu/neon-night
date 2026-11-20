"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconOverview, IconReceipt, IconScan, IconTicket, IconWallet } from "./Icons";

const ITEMS = [
  { href: "/admin", label: "Overview", Icon: IconOverview },
  { href: "/admin/sales", label: "Sales", Icon: IconReceipt },
  { href: "/admin/tiers", label: "Tiers", Icon: IconTicket },
  { href: "/admin/scan", label: "Check-in", Icon: IconScan },
] as const;

const OWNER_ITEMS = [{ href: "/admin/publicity", label: "Publicity", Icon: IconWallet }] as const;

/** `owner` adds the owner-only pages; admins never see those links. */
export function Nav({ owner = false }: { owner?: boolean }) {
  const path = usePathname();
  const items = owner ? [...ITEMS, ...OWNER_ITEMS] : ITEMS;
  return (
    <nav className="ad-nav" aria-label="Admin">
      {items.map(({ href, label, Icon }) => {
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
