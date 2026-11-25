"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { SeesMark } from "@/components/brand/sees-mark";
import { usePathname } from "next/navigation";
import { Megaphone, CloudOff, X, ChevronDown, BookOpen, Shield, Gauge, LogOut, Radio } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/app/login/actions";
import { showsHeader } from "./routes";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/sports", label: "Sports" },
  { href: "/fantasy", label: "Fantasy" },
  { href: "/tables", label: "Tables" },
];

interface TopHeaderProps {
  user?: { name?: string | null; avatarUrl?: string | null } | null;
  announcement?: { id: string; message: string } | null;
  role?: "user" | "official" | "admin";
}

export function TopHeader({ user, announcement, role = "user" }: TopHeaderProps) {
  const pathname = usePathname();
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    (() => setIsOffline(!navigator.onLine))();
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!showsHeader(pathname)) return null;

  const showAnnouncement = announcement && dismissedId !== announcement.id;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <SeesMark className="size-7 text-brand dark:text-brand-light" />
          <span className="font-heading text-lg font-semibold tracking-tight text-foreground">
            SEES Games
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-6 lg:flex">
          {NAV_LINKS.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-medium transition-colors ${
                  active ? "font-semibold text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            );
          })}

          <DropdownMenu modal={false}>
            <DropdownMenuTrigger className="group inline-flex items-center gap-1 rounded-md text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:text-foreground">
              More
              <ChevronDown className="size-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={10} className="w-56 rounded-xl p-1.5">
              <DropdownMenuItem asChild className="h-10 rounded-lg">
                <Link href="/fantasy/rules">
                  <BookOpen /> Fantasy rules
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="h-10 rounded-lg">
                <Link href="/privacy">
                  <Shield /> Privacy
                </Link>
              </DropdownMenuItem>
              {(role === "official" || role === "admin") && (
                <DropdownMenuItem asChild className="h-10 rounded-lg text-primary">
                  <Link href="/console">
                    <Radio /> Match console
                  </Link>
                </DropdownMenuItem>
              )}
              {role === "admin" && (
                <DropdownMenuItem asChild className="h-10 rounded-lg text-primary">
                  <Link href="/admin">
                    <Gauge /> Admin portal
                  </Link>
                </DropdownMenuItem>
              )}
              {user && (
                <>
                  <DropdownMenuSeparator />
                  <form action={signOut}>
                    <DropdownMenuItem asChild variant="destructive" className="h-10 w-full rounded-lg">
                      <button type="submit">
                        <LogOut /> Sign out
                      </button>
                    </DropdownMenuItem>
                  </form>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <Link
              href="/fantasy"
              aria-label="Account"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary font-heading text-xs font-semibold text-primary"
            >
              {user.name?.slice(0, 2).toUpperCase() || "ME"}
            </Link>
          ) : (
            <Link
              href="/login"
              className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>

      {showAnnouncement && (
        <div className="flex items-center justify-between gap-2 bg-highlight px-4 py-2 text-xs font-semibold text-team-foreground">
          <div className="mx-auto flex max-w-[1200px] flex-1 items-center gap-2">
            <Megaphone className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{announcement.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setDismissedId(announcement.id)}
            aria-label="Dismiss announcement"
            className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-team-foreground/10"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {isOffline && (
        <div className="flex items-center justify-center gap-2 bg-muted px-4 py-1.5 text-xs font-medium text-muted-foreground">
          <CloudOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>You&apos;re offline. Showing the last scores we had.</span>
        </div>
      )}
    </header>
  );
}
