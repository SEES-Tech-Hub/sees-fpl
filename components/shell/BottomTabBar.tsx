"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, MotionConfig, type Transition } from "motion/react";
import {
  BookOpen,
  ChevronRight,
  Gauge,
  House,
  ListOrdered,
  LogIn,
  LogOut,
  Radio,
  Shield,
  Shirt,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { signOut } from "@/app/login/actions";
import { SeesMark } from "@/components/brand/sees-mark";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { showsTabBar } from "./routes";
import { ThemeToggle } from "./theme";

// The phone navigation: a floating dock. The active tab is a mint pill that
// slides between tabs and opens out to show its name; the rest are icons.
// It tucks away while you scroll down a page and comes back when you scroll
// up. "More" opens a sheet from the bottom. Hidden from lg up, where the top
// header has the links.

const TABS = [
  { href: "/", label: "Home", icon: House },
  { href: "/sports", label: "Sports", icon: Trophy },
  { href: "/fantasy", label: "Fantasy", icon: Shirt },
  { href: "/tables", label: "Tables", icon: ListOrdered },
];

const SPRING: Transition = { type: "spring", stiffness: 520, damping: 40, mass: 0.9 };

interface BottomTabBarProps {
  hasLiveMatch?: boolean;
  role?: "user" | "official" | "admin";
  user?: { name?: string | null; avatarUrl?: string | null } | null;
}

/** True while the page is being scrolled down (past the first screenful). */
function useScrollingDown() {
  const [down, setDown] = useState(false);
  const last = useRef(0);
  useEffect(() => {
    last.current = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - last.current;
      if (Math.abs(delta) < 8) return;
      setDown(delta > 0 && y > 160);
      last.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return down;
}

export function BottomTabBar({ hasLiveMatch = false, role = "user", user }: BottomTabBarProps) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const scrollingDown = useScrollingDown();

  if (!showsTabBar(pathname)) return null;

  const activeHref = TABS.find((t) => (t.href === "/" ? pathname === "/" : pathname.startsWith(t.href)))?.href;
  const hidden = scrollingDown && !moreOpen;

  return (
    <MotionConfig reducedMotion="user">
      {/* Keeps the end of every page clear of the dock. */}
      <div aria-hidden className="h-[calc(5.75rem+env(safe-area-inset-bottom))] shrink-0 lg:hidden" />

      <motion.nav
        aria-label="Main"
        initial={false}
        animate={{ y: hidden ? "calc(100% + 2rem)" : 0 }}
        transition={SPRING}
        className="fixed inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex justify-center px-4 lg:hidden"
      >
        <div className="flex h-16 w-full max-w-sm items-center justify-between gap-1 rounded-full bg-pitch/95 p-2 shadow-[0_12px_32px_-8px_rgb(1_20_15/0.55)] ring-1 ring-brand-light/15 backdrop-blur-md">
          {TABS.map(({ href, label, icon: Icon }) => {
            const active = href === activeHref;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                aria-label={label}
                className={cn(
                  "relative flex h-12 min-w-12 items-center justify-center rounded-full transition-[flex-grow] duration-300 ease-out outline-none focus-visible:ring-2 focus-visible:ring-brand-light",
                  active ? "grow-[2.4]" : "grow",
                )}
                style={{ flexBasis: 0 }}
              >
                {active && <motion.span layoutId="dock-pill" transition={SPRING} className="absolute inset-0 rounded-full bg-brand-light" />}
                <motion.span
                  whileTap={{ scale: 0.86 }}
                  className={cn(
                    "relative flex items-center gap-1.5 px-2 transition-colors duration-200",
                    active ? "text-brand" : "text-brand-foreground/70",
                  )}
                >
                  <Icon size={21} strokeWidth={active ? 2.25 : 1.75} aria-hidden="true" />
                  <AnimatePresence initial={false}>
                    {active && (
                      <motion.span
                        key="label"
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: "auto", opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ ...SPRING, opacity: { duration: 0.15 } }}
                        className="overflow-hidden font-heading text-sm font-semibold whitespace-nowrap"
                      >
                        {label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {href === "/" && hasLiveMatch && (
                    <span className="absolute -top-0.5 right-0.5 flex size-2.5">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-live opacity-75" />
                      <span className="relative inline-flex size-2.5 rounded-full bg-live ring-2 ring-pitch" />
                    </span>
                  )}
                </motion.span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label="More"
            aria-expanded={moreOpen}
            className="relative flex size-12 shrink-0 items-center justify-center rounded-full text-brand-foreground/70 outline-none focus-visible:ring-2 focus-visible:ring-brand-light"
          >
            <motion.span whileTap={{ scale: 0.86 }} className="flex flex-col items-center gap-[5px]" aria-hidden>
              {/* Three dots that become a column while the sheet is open. */}
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  animate={moreOpen ? { width: 18, height: 2.5, borderRadius: 2 } : { width: 4.5, height: 4.5, borderRadius: 999 }}
                  transition={{ ...SPRING, delay: i * 0.03 }}
                  className="block bg-current"
                />
              ))}
            </motion.span>
          </button>
        </div>
      </motion.nav>

      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} role={role} user={user} />
    </MotionConfig>
  );
}

type SheetLink = { href: string; label: string; sub: string; icon: LucideIcon; tone?: "brand" };

function MoreSheet({
  open,
  onOpenChange,
  role,
  user,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: BottomTabBarProps["role"];
  user: BottomTabBarProps["user"];
}) {
  const links: SheetLink[] = [
    { href: "/fantasy/rules", label: "Fantasy rules", sub: "Squads, transfers and points", icon: BookOpen },
    { href: "/privacy", label: "Privacy", sub: "What we keep and why", icon: Shield },
    ...(role === "official" || role === "admin"
      ? [{ href: "/console", label: "Match console", sub: "Score your matches", icon: Radio, tone: "brand" as const }]
      : []),
    ...(role === "admin" ? [{ href: "/admin", label: "Admin portal", sub: "Fixtures, players and results", icon: Gauge, tone: "brand" as const }] : []),
  ];
  const close = () => onOpenChange(false);

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
      <DrawerContent className="rounded-t-3xl bg-background pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-3 px-5 pt-4 pb-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-pitch text-brand-light">
            <SeesMark className="size-7" />
          </span>
          <div className="min-w-0 flex-1">
            <DrawerTitle className="font-heading text-lg font-bold">{user?.name ? `Hi, ${user.name.split(" ")[0]}` : "SEES Games Hub"}</DrawerTitle>
            <DrawerDescription className="truncate">{user ? "Signed in" : "Sign in to play SEES Fantasy"}</DrawerDescription>
          </div>
        </div>

        <ul className="flex flex-col gap-2 px-4">
          {links.map((l, i) => (
            <motion.li
              key={l.href}
              initial={{ opacity: 0, y: 12 }}
              animate={open ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
              transition={{ ...SPRING, delay: open ? 0.06 + i * 0.04 : 0 }}
            >
              <Link
                href={l.href}
                onClick={close}
                className="flex min-h-16 items-center gap-3 rounded-2xl bg-card px-3 py-2.5 shadow-card transition-transform active:scale-[0.98]"
              >
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-xl",
                    l.tone === "brand" ? "bg-pitch text-brand-light" : "bg-secondary text-brand",
                  )}
                >
                  <l.icon className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.9375rem] font-semibold">{l.label}</span>
                  <span className="block truncate text-[0.8125rem] text-muted-foreground">{l.sub}</span>
                </span>
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
              </Link>
            </motion.li>
          ))}
        </ul>

        <motion.div
          className="px-4 pt-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: open ? 1 : 0 }}
          transition={{ duration: 0.2, delay: open ? 0.06 + links.length * 0.04 : 0 }}
        >
          <ThemeToggle withLabel className="mb-3 h-12 w-full rounded-2xl bg-muted text-sm font-semibold text-foreground" />
          {user ? (
            <form action={signOut}>
              <button
                type="submit"
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border text-sm font-semibold text-destructive transition-colors hover:bg-destructive/5"
              >
                <LogOut className="size-4" aria-hidden /> Sign out
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              onClick={close}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-gradient text-sm font-semibold text-brand-foreground"
            >
              <LogIn className="size-4" aria-hidden /> Sign in with Google
            </Link>
          )}
        </motion.div>
      </DrawerContent>
    </Drawer>
  );
}
