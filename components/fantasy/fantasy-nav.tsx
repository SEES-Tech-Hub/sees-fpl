"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/fantasy/team", label: "My team" },
  { href: "/fantasy/transfers", label: "Transfers" },
  { href: "/fantasy/points", label: "Points" },
  { href: "/fantasy/rankings", label: "Rankings" },
  { href: "/fantasy/leagues", label: "Leagues" },
  { href: "/fantasy/rules", label: "Rules" },
] as const;

export function FantasyNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Fantasy" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
      <ul className="flex min-w-max gap-1">
        {LINKS.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center rounded-lg px-3 text-sm font-medium text-brand-foreground/80 transition-colors hover:bg-brand-foreground/10",
                  active && "bg-brand-foreground text-brand hover:bg-brand-foreground",
                )}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function FantasyNavFallback() {
  return <div className="h-11" aria-hidden />;
}
