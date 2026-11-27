"use client";

import Link from "next/link";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// The rows of the rankings table: they rise in one after another, light up
// on hover, and the row you tap presses in. Your own row is highlighted.

export type RankingRowView = {
  managerId: string;
  teamName: string;
  yearGroup: number | null;
  rank: string;
  lastMatchdayPoints: number;
  totalPoints: number;
};

const STAGGER = 0.03;
const MAX_DELAY = 0.45;

export function RankingRows({
  rows,
  pinned,
  meId,
  linkToPoints,
}: {
  rows: RankingRowView[];
  pinned: RankingRowView | null;
  meId: string | null;
  linkToPoints: boolean;
}) {
  const row = (r: RankingRowView, i: number, isPinned = false) => {
    const mine = r.managerId === meId;
    const name = (
      <>
        <span className="block truncate text-[0.9375rem] font-semibold">{r.teamName}</span>
        {r.yearGroup ? <span className="block truncate text-[0.8125rem] text-muted-foreground">Year {r.yearGroup}</span> : null}
      </>
    );
    return (
      <motion.tr
        key={isPinned ? `pinned-${r.managerId}` : r.managerId}
        layout="position"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0, transition: { type: "spring", stiffness: 420, damping: 34, delay: Math.min(i * STAGGER, MAX_DELAY) } }}
        exit={{ opacity: 0, transition: { duration: 0.12 } }}
        whileTap={linkToPoints ? { scale: 0.985 } : undefined}
        className={cn(
          "group border-t border-border transition-colors duration-150",
          linkToPoints && "cursor-pointer hover:bg-muted/70",
          mine && "bg-secondary hover:bg-secondary",
          isPinned && "sticky bottom-0 border-t-2 border-primary shadow-raised",
        )}
        aria-current={mine ? "true" : undefined}
      >
        <td className="px-3 py-2 font-heading text-lg font-bold tabular-nums">{r.rank}</td>
        <td className="max-w-0 px-2 py-1">
          {linkToPoints ? (
            <Link
              href={mine ? "/fantasy/points" : `/fantasy/points?manager=${r.managerId}`}
              className="flex min-h-11 items-center gap-1 py-1 outline-none focus-visible:underline"
            >
              <span className="min-w-0 flex-1">{name}</span>
              <ChevronRight
                className="size-4 shrink-0 -translate-x-1 text-muted-foreground opacity-0 transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100"
                aria-hidden
              />
            </Link>
          ) : (
            <div className="flex min-h-11 flex-col justify-center py-1">{name}</div>
          )}
        </td>
        <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{r.lastMatchdayPoints}</td>
        <td className="px-3 py-2 text-right font-heading text-lg font-bold tabular-nums">{r.totalPoints}</td>
      </motion.tr>
    );
  };

  return (
    <MotionConfig reducedMotion="user">
      <tbody>
        <AnimatePresence initial mode="popLayout">
          {rows.map((r, i) => row(r, i))}
          {pinned && row(pinned, rows.length, true)}
        </AnimatePresence>
      </tbody>
    </MotionConfig>
  );
}
