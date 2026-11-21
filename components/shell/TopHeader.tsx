"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Megaphone, CloudOff, X } from "lucide-react";
import { SeesMark } from '@/components/ui/shared/SeesMark'

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/sports", label: "Sports" },
  { href: "/fantasy", label: "Fantasy" },
  { href: "/tables", label: "Tables" },
];

interface TopHeaderProps {
  user?: { name?: string | null; avatarUrl?: string | null } | null;
  announcement?: { id: string; message: string } | null;
}

export function TopHeader({ user, announcement }: TopHeaderProps) {
  const pathname = usePathname();
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    setIsOffline(!navigator.onLine);
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  const showAnnouncement = announcement && dismissedId !== announcement.id;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <img src="/icons/icon.svg" alt="" className="h-6 w-6" />
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
          <div className="mx-auto flex max-w-300 flex-1 items-center gap-2">
            <Megaphone className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{announcement.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setDismissedId(announcement.id)}
            aria-label="Dismiss announcement"
            className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-black/10"
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
