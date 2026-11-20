import Link from "next/link";
import type { RankingRow } from "@/lib/fantasy/types";
import { cn } from "@/lib/utils";

/**
 * Design system §11.3 RankCard and LeagueRow. Ranks come from the backend;
 * equal points show a shared rank ("=12"). Your own row is highlighted, and
 * pinned at the bottom when it isn't on this page.
 */
export function RankingTable({
  rows,
  me,
  linkToPoints,
}: {
  rows: RankingRow[];
  me: RankingRow | null;
  linkToPoints: boolean;
}) {
  const counts = new Map<number, number>();
  for (const r of rows) counts.set(r.rank, (counts.get(r.rank) ?? 0) + 1);
  const rankLabel = (r: RankingRow) => ((counts.get(r.rank) ?? 0) > 1 ? `=${r.rank}` : String(r.rank));
  const meOnPage = me ? rows.some((r) => r.managerId === me.managerId) : false;

  const row = (r: RankingRow, pinned = false) => {
    const mine = r.managerId === me?.managerId;
    const name = (
      <>
        <span className="block truncate text-[0.9375rem] font-semibold">{r.teamName}</span>
        <span className="block truncate text-[0.8125rem] text-muted-foreground">
          {r.managerName}
          {r.yearGroup ? ` · Year ${r.yearGroup}` : ""}
        </span>
      </>
    );
    return (
      <tr
        key={pinned ? `pinned-${r.managerId}` : r.managerId}
        className={cn("border-t border-border", mine && "bg-secondary", pinned && "sticky bottom-0 border-t-2 border-primary shadow-raised")}
        aria-current={mine ? "true" : undefined}
      >
        <td className="px-3 py-2 font-heading text-lg font-bold tabular-nums">{pinned ? r.rank : rankLabel(r)}</td>
        <td className="max-w-0 px-2 py-1">
          {linkToPoints ? (
            <Link
              href={mine ? "/fantasy/points" : `/fantasy/points?manager=${r.managerId}`}
              className="block min-h-11 py-1"
            >
              {name}
            </Link>
          ) : (
            name
          )}
        </td>
        <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{r.lastMatchdayPoints}</td>
        <td className="px-3 py-2 text-right font-heading text-lg font-bold tabular-nums">{r.totalPoints}</td>
      </tr>
    );
  };

  return (
    <div className="overflow-hidden rounded-xl bg-card shadow-card">
      <table className="w-full">
        <thead className="bg-muted text-[0.8125rem] font-medium text-muted-foreground">
          <tr>
            <th scope="col" className="w-14 px-3 py-2 text-left font-medium">Rank</th>
            <th scope="col" className="px-2 py-2 text-left font-medium">Team</th>
            <th scope="col" className="w-12 px-2 py-2 text-right font-medium">
              <abbr title="Latest matchday points" className="no-underline">MD</abbr>
            </th>
            <th scope="col" className="w-16 px-3 py-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => row(r))}
          {me && !meOnPage && row(me, true)}
        </tbody>
      </table>
    </div>
  );
}
