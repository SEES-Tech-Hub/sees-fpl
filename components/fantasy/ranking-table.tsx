import type { RankingRow } from "@/lib/fantasy/types";
import { RankingRows, type RankingRowView } from "./ranking-rows";

/**
 * Design system §11.3 RankCard and LeagueRow. Ranks come from the backend;
 * equal points show a shared rank ("=12"). Your own row is highlighted, and
 * pinned at the bottom when it isn't on this page.
 *
 * Rankings show the fantasy team and its year, never the manager's own
 * account name: only those fields are passed to the browser.
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
  const view = (r: RankingRow, pinned = false): RankingRowView => ({
    managerId: r.managerId,
    teamName: r.teamName,
    yearGroup: r.yearGroup,
    rank: pinned || (counts.get(r.rank) ?? 0) <= 1 ? String(r.rank) : `=${r.rank}`,
    lastMatchdayPoints: r.lastMatchdayPoints,
    totalPoints: r.totalPoints,
  });
  const meOnPage = me ? rows.some((r) => r.managerId === me.managerId) : false;

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
        <RankingRows
          rows={rows.map((r) => view(r))}
          pinned={me && !meOnPage ? view(me, true) : null}
          meId={me?.managerId ?? null}
          linkToPoints={linkToPoints}
        />
      </table>
    </div>
  );
}
