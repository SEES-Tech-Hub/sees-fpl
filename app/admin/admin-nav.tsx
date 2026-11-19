"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarClock,
  CalendarDays,
  LayoutDashboard,
  Megaphone,
  Menu,
  ScrollText,
  Shirt,
  Trophy,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon };

// The order organisers work in on a matchday.
const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/fixtures", label: "Fixtures", icon: CalendarDays },
  { href: "/admin/officials", label: "Officials", icon: UserCheck },
  { href: "/admin/matchdays", label: "Matchdays", icon: CalendarClock },
  { href: "/admin/players", label: "Players", icon: Shirt },
  { href: "/admin/teams", label: "Teams", icon: Users },
  { href: "/admin/sports", label: "Sports and events", icon: Trophy },
  { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
  { href: "/admin/audit", label: "Audit log", icon: ScrollText },
];

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ onNavigate }: { onNavigate?: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="flex flex-col gap-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        const link = (
          <Link
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {label}
          </Link>
        );
        return onNavigate ? (
          <SheetClose key={href} asChild>
            {link}
          </SheetClose>
        ) : (
          <div key={href}>{link}</div>
        );
      })}
    </nav>
  );
}

export function AdminNav({ adminName }: { adminName: string }) {
  return (
    <>
      {/* Phones: top bar with a menu sheet */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-sidebar-border bg-sidebar px-4 md:hidden">
        <Link href="/admin" className="font-heading text-lg font-semibold text-sidebar-primary">
          SEES Admin
        </Link>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon-lg" aria-label="Open admin menu">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="bg-sidebar p-4">
            <SheetHeader className="p-0">
              <SheetTitle className="font-heading text-lg text-sidebar-primary">SEES Admin</SheetTitle>
              <SheetDescription>Signed in as {adminName}</SheetDescription>
            </SheetHeader>
            <NavLinks onNavigate />
          </SheetContent>
        </Sheet>
      </header>

      {/* Desktop: fixed sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 border-r border-sidebar-border bg-sidebar p-4 md:flex">
        <div>
          <Link href="/admin" className="font-heading text-xl font-semibold text-sidebar-primary">
            SEES Admin
          </Link>
          <p className="mt-1 truncate text-xs text-muted-foreground">Signed in as {adminName}</p>
        </div>
        <NavLinks />
      </aside>
    </>
  );
}
