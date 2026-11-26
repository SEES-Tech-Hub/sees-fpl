"use client";

import { motion } from "motion/react";
import { Crown } from "lucide-react";
import { YearCrest } from "@/components/brand/year-crest";
import { EmptyState } from "@/components/brand/empty-state";
import type { MedalTableRow, TeamSummary } from "@/lib/live/types";

// The medal table (Tables → Medals and /championship) and the medal dot used
// by the event tables. In its own file so pages can import it without the
// whole tables view (tables-view and sports-views import each other).

function TeamCell({ team }: { team: TeamSummary }) {
  return (
    <span className="flex items-center gap-2">
      <YearCrest year={team.year} size={28} label="" />
      <span className="truncate font-semibold">{team.name}</span>
    </span>
  );
}

export function MedalTable({ rows }: { rows: MedalTableRow[] }) {
  if (rows.length === 0) return <EmptyState art="trophy" title="No medals yet" description="The race for the championship starts with the first results." />;
  const byPoints = rows[0].rankBy === "points";
  return (
    <section className="overflow-x-auto rounded-xl bg-card shadow-card">
      <table className="w-full min-w-[20rem] text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="w-8 py-2 pl-3 text-left font-semibold">#</th>
            <th className="py-2 text-left font-semibold">Year</th>
            <th className="w-10 py-2 text-center" aria-label="Gold">
              <Medal tone="gold" />
            </th>
            <th className="w-10 py-2 text-center" aria-label="Silver">
              <Medal tone="silver" />
            </th>
            <th className="w-10 py-2 text-center" aria-label="Bronze">
              <Medal tone="bronze" />
            </th>
            <th className="w-12 py-2 pr-3 text-center font-semibold">{byPoints ? "Pts" : "Total"}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <motion.tr layout key={r.team.id} className="border-b border-border last:border-b-0">
              <td className="py-2.5 pl-3 font-heading font-bold">
                <span className="flex items-center gap-1">
                  {r.position}
                  {r.position === 1 && r.total > 0 && <Crown className="size-3.5 text-highlight" aria-label="Leader" />}
                </span>
              </td>
              <td className="max-w-0 py-2.5">
                <TeamCell team={r.team} />
              </td>
              <td className="text-center tabular-nums">{r.gold}</td>
              <td className="text-center tabular-nums">{r.silver}</td>
              <td className="text-center tabular-nums">{r.bronze}</td>
              <td className="pr-3 text-center font-heading text-base font-bold tabular-nums">{byPoints ? r.points : r.total}</td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function Medal({ tone }: { tone: "gold" | "silver" | "bronze" }) {
  const fill = { gold: "var(--highlight)", silver: "var(--muted-foreground)", bronze: "var(--team-y2)" }[tone];
  return (
    <span aria-hidden className="mx-auto block size-4 rounded-full ring-2 ring-background" style={{ background: fill, boxShadow: `0 0 0 1px ${fill}` }} />
  );
}
