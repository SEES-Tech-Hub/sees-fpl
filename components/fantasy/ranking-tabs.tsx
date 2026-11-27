"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, MotionConfig } from "motion/react";
import { cn } from "@/lib/utils";

// Rankings tabs (design system §12.9): Overall · My year · Leagues, and the
// year chips under My year. The white pill slides to the tab you tap at once,
// before the next page arrives; hover lifts the label, a tap presses it in.

const spring = { type: "spring", stiffness: 520, damping: 38 } as const;

export function RankingTabs({ active, myYear }: { active: "overall" | "year" | "leagues"; myYear: number | null }) {
  const tabs = [
    { key: "overall", label: "Overall", href: "/fantasy/rankings" },
    { key: "year", label: "My year", href: `/fantasy/rankings?year=${myYear ?? 1}` },
    { key: "leagues", label: "Leagues", href: "/fantasy/leagues" },
  ] as const;
  const [picked, setPicked] = useState<string>(active);
  const [shownFor, setShownFor] = useState(active);
  // A new page arrived with a different tab: follow it.
  if (shownFor !== active) {
    setShownFor(active);
    setPicked(active);
  }

  return (
    <MotionConfig reducedMotion="user" transition={spring}>
      <nav aria-label="Rankings" className="grid grid-cols-3 rounded-lg bg-muted p-1">
        {tabs.map((t) => {
          const on = picked === t.key;
          return (
            <Link
              key={t.key}
              href={t.href}
              onClick={() => setPicked(t.key)}
              aria-current={active === t.key ? "page" : undefined}
              className={cn(
                "group relative flex h-10 items-center justify-center rounded-md text-[0.9375rem] font-medium text-muted-foreground transition-colors duration-200 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring",
                on && "text-foreground",
              )}
            >
              {on && <motion.span layoutId="ranking-tab-pill" className="absolute inset-0 rounded-md bg-background shadow-card" />}
              {!on && <span className="absolute inset-0.5 rounded-md bg-background/0 transition-colors duration-200 group-hover:bg-background/50" aria-hidden />}
              <motion.span className="relative" whileTap={{ scale: 0.94 }}>
                {t.label}
              </motion.span>
            </Link>
          );
        })}
      </nav>
    </MotionConfig>
  );
}

export function YearChips({ active, href }: { active: number; href: Record<number, string> }) {
  const [picked, setPicked] = useState(active);
  const [shownFor, setShownFor] = useState(active);
  if (shownFor !== active) {
    setShownFor(active);
    setPicked(active);
  }
  return (
    <MotionConfig reducedMotion="user" transition={spring}>
      <nav aria-label="Year" className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5].map((y, i) => {
          const on = picked === y;
          return (
            <motion.div key={y} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: i * 0.035 }}>
              <Link
                href={href[y]}
                onClick={() => setPicked(y)}
                aria-current={active === y ? "page" : undefined}
                className={cn(
                  "relative flex h-11 min-w-11 items-center justify-center rounded-full border border-border px-3 text-[0.9375rem] font-medium transition-colors duration-200 outline-none hover:border-primary/60 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring",
                  on && "border-primary text-primary-foreground hover:bg-transparent",
                )}
              >
                {on && <motion.span layoutId="ranking-year-pill" className="absolute -inset-px rounded-full bg-primary" />}
                <motion.span className="relative" whileTap={{ scale: 0.9 }}>
                  Y{y}
                </motion.span>
              </Link>
            </motion.div>
          );
        })}
      </nav>
    </MotionConfig>
  );
}
