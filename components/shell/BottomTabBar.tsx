"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Trophy, Shirt, ListOrdered, Menu, X } from "lucide-react";
import { signOut } from "@/app/login/actions";
import { showsTabBar } from "./routes";

const TABS = [
  { href: "/", label: "Home", icon: House },
  { href: "/sports", label: "Sports", icon: Trophy },
  { href: "/fantasy", label: "Fantasy", icon: Shirt },
  { href: "/tables", label: "Tables", icon: ListOrdered },
];

interface BottomTabBarProps {
  hasLiveMatch?: boolean;
  role?: "user" | "official" | "admin";
  user?: { name?: string | null; avatarUrl?: string | null } | null;
}

export function BottomTabBar({
  hasLiveMatch = false,
  role = "user",
  user,
}: BottomTabBarProps) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  if (!showsTabBar(pathname)) return null;

  return (
    <>
      {/* Keeps the end of every page clear of the fixed bar. */}
      <div aria-hidden className="h-[calc(4rem+env(safe-area-inset-bottom))] shrink-0 lg:hidden" />
      <nav
        aria-label="Bottom tabs"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        <div className="grid h-16 grid-cols-5 items-center">
          {TABS.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className="flex min-h-[44px] flex-col items-center justify-center gap-1 text-[11px] font-medium"
              >
                <span
                  className={`relative flex h-8 w-12 items-center justify-center rounded-full transition-colors ${
                    active ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  }`}
                >
                  <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
                  {href === "/" && hasLiveMatch && (
                    <span className="absolute top-1.5 right-3 h-2 w-2 rounded-full bg-destructive" />
                  )}
                </span>
                <span className={active ? "font-semibold text-foreground" : "text-muted-foreground"}>
                  {label}
                </span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex min-h-[44px] flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground"
          >
            <span className="flex h-8 w-12 items-center justify-center">
              <Menu size={22} strokeWidth={1.75} aria-hidden="true" />
            </span>
            <span>More</span>
          </button>
        </div>
      </nav>

      {moreOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-scrim lg:hidden"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="rounded-t-xl bg-card p-5 pb-8 shadow-raised"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="font-heading text-lg font-semibold">More</span>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label="Close menu"
                className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col gap-1.5 text-sm font-medium">
              <Link
                href="/fantasy/rules"
                onClick={() => setMoreOpen(false)}
                className="flex min-h-[44px] items-center rounded-lg px-3 hover:bg-muted"
              >
                Fantasy rules
              </Link>
              {role === "admin" && (
                <Link
                  href="/admin"
                  onClick={() => setMoreOpen(false)}
                  className="flex min-h-[44px] items-center rounded-lg px-3 text-primary hover:bg-muted"
                >
                  Admin portal
                </Link>
              )}
              {user && (
                <form action={signOut} className="mt-2 border-t border-border pt-2">
                  <button
                    type="submit"
                    className="flex min-h-[44px] w-full items-center rounded-lg px-3 text-left text-destructive hover:bg-muted"
                  >
                    Sign out
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
