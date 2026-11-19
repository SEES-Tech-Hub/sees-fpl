import Link from "next/link";
import type { RankingRow } from "@/lib/fantasy/types";
import { cn } from "@/lib/utils";

/** Standings for rankings and mini-leagues. Ranks come from the backend (ties shared). */
export function RankingTable({
  rows,
  meId,
  linkToPoints,
}: {
  rows: RankingRow[];
  meId: string | null;
  linkToPoints: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="w-12 px-2 py-2 text-left font-medium">#</th>
            <th scope="col" className="px-2 py-2 text-left font-medium">Team</th>
            <th scope="col" className="w-12 px-2 py-2 text-right font-medium">MD</th>
            <th scope="col" className="w-14 px-2 py-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const me = r.managerId === meId;
            const name = (
              <>
                <span className="block truncate font-medium">{r.teamName}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {r.managerName}
                  {r.yearGroup ? ` · Y${r.yearGroup}` : ""}
                </span>
              </>
            );
            return (
              <tr key={r.managerId} className={cn("border-t border-border", me && "bg-secondary")}>
                <td className="px-2 py-2 font-heading font-semibold tabular-nums">{r.rank}</td>
                <td className="max-w-0 px-2 py-1">
                  {linkToPoints ? (
                    <Link href={me ? "/fantasy/points" : `/fantasy/points?manager=${r.managerId}`} className="block min-h-11 py-1">
                      {name}
                    </Link>
                  ) : (
                    name
                  )}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{r.lastMatchdayPoints}</td>
                <td className="px-2 py-2 text-right font-semibold tabular-nums">{r.totalPoints}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
