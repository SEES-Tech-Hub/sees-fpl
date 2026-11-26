import { Crown } from "lucide-react";
import { YearCrest } from "@/components/brand/year-crest";
import { CREST_CLASS } from "@/lib/design/crest";
import type { MedalTableRow } from "@/lib/live/types";
import { MEDAL_FILL } from "./championship-strip";

// Medal towers: every medal a year has won, stacked gold on top, silver, then
// bronze, in ranking order. The number on top is the total. Shown above the
// medal table once the first medal is won.

export function MedalTowers({ rows }: { rows: MedalTableRow[] }) {
  const most = Math.max(0, ...rows.map((r) => r.total));
  if (most === 0) return null;
  // 220px for the tallest tower, at most 18px a medal.
  const unit = Math.min(18, 220 / most);

  return (
    <section aria-label="Medal towers" className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-card">
      <div className="grid grid-cols-5 items-end gap-2 border-b-2 border-foreground px-1" style={{ minHeight: `${most * unit + 96}px` }}>
        {rows.map((r) => (
          <div
            key={r.team.id}
            className="flex flex-col items-center justify-end gap-1.5"
            role="img"
            aria-label={`${r.team.name}: ${r.gold} gold, ${r.silver} silver, ${r.bronze} bronze`}
          >
            {r.position === 1 && <Crown aria-hidden className="size-4 fill-highlight text-highlight" />}
            <YearCrest year={r.team.year} size={38} label="" />
            <span className="font-heading text-lg leading-none font-bold tabular-nums" aria-hidden>
              {r.total}
            </span>
            <div className="flex w-full max-w-12 flex-col gap-0.5" aria-hidden>
              {(["gold", "silver", "bronze"] as const).map((m, k) =>
                r[m] > 0 ? (
                  <span
                    key={m}
                    className="block motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-500"
                    style={{
                      height: `${r[m] * unit}px`,
                      background: MEDAL_FILL[m],
                      borderRadius: k === 0 || (k === 1 && r.gold === 0) || (k === 2 && r.gold + r.silver === 0) ? "6px 6px 2px 2px" : "2px",
                    }}
                  />
                ) : null,
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="-mt-1 grid grid-cols-5 gap-2 px-1" aria-hidden>
        {rows.map((r) => (
          <span key={r.team.id} className="text-center text-xs font-semibold text-muted-foreground">
            {r.team.year ? CREST_CLASS[r.team.year] : r.team.shortName}
          </span>
        ))}
      </div>
      <p className="flex gap-4 text-xs text-muted-foreground" aria-hidden>
        {(["gold", "silver", "bronze"] as const).map((m) => (
          <span key={m} className="inline-flex items-center gap-1.5 capitalize">
            <span className="size-2.5 rounded-[3px]" style={{ background: MEDAL_FILL[m] }} />
            {m}
          </span>
        ))}
      </p>
    </section>
  );
}
