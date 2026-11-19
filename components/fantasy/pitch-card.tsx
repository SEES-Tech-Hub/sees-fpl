import type { ReactNode } from "react";
import { PositionTag } from "@/components/fantasy/player-bits";
import type { Player } from "@/lib/fantasy/types";
import { cn } from "@/lib/utils";

/** A player on the pitch view (My team, Points). Tappable when onClick is set. */
export function PitchCard({
  player,
  sub,
  badge,
  selected,
  target,
  dimmed,
  flagged,
  onClick,
}: {
  player: Pick<Player, "displayName" | "position" | "teamShort">;
  sub?: ReactNode;
  badge?: "C" | "V" | null;
  selected?: boolean;
  target?: boolean;
  dimmed?: boolean;
  flagged?: boolean;
  onClick?: () => void;
}) {
  const body = (
    <>
      {badge && (
        <span
          className={cn(
            "absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full text-[0.65rem] font-bold",
            badge === "C" ? "bg-highlight text-highlight-foreground" : "bg-foreground text-background",
          )}
          aria-label={badge === "C" ? "Captain" : "Vice-captain"}
        >
          {badge}
        </span>
      )}
      <PositionTag position={player.position} className="h-4 w-8 text-[0.6rem]" />
      <span className="mt-1 w-full truncate text-xs font-medium">{player.displayName}</span>
      <span className="w-full truncate text-[0.65rem] text-muted-foreground">{sub ?? player.teamShort}</span>
    </>
  );
  const className = cn(
    "relative flex min-h-[4.5rem] min-w-0 flex-col items-center justify-center rounded-lg bg-card px-1 py-1.5 text-center text-card-foreground",
    selected && "ring-3 ring-highlight",
    target && "ring-2 ring-brand-light outline-2 outline-dashed outline-offset-2 outline-highlight",
    dimmed && "opacity-50",
    flagged && "ring-2 ring-destructive",
  );
  if (!onClick) return <div className={className}>{body}</div>;
  return (
    <button type="button" onClick={onClick} className={className} aria-pressed={selected}>
      {body}
    </button>
  );
}

/** Lays out one row of the pitch so 5 cards fit at 360 px. */
export function PitchRow({ count, children }: { count: number; children: ReactNode }) {
  return (
    <div
      className="grid justify-center gap-1.5"
      style={{ gridTemplateColumns: `repeat(${Math.max(count, 1)}, minmax(0, 4.5rem))` }}
    >
      {children}
    </div>
  );
}
