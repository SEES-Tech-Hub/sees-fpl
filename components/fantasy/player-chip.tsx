import { ArrowLeftRight, Plus } from "lucide-react";
import { Kit } from "@/components/fantasy/team-badge";
import { POSITION_LABEL } from "@/lib/fantasy/format";
import type { PlayerStatus, Position } from "@/lib/fantasy/types";
import { cn } from "@/lib/utils";

// Design system §11.3 PlayerChip: a shirt in the team colour, the name on a
// label, and the price or points on a dark tag.

export type ChipPlayer = {
  displayName: string;
  position: Position;
  teamYear: number;
  status?: PlayerStatus;
};

const FLAG: Record<Exclude<PlayerStatus, "available">, { cls: string; label: string }> = {
  injured: { cls: "bg-warning text-highlight-foreground", label: "injured" },
  suspended: { cls: "bg-destructive text-background", label: "suspended" },
  left: { cls: "bg-muted-foreground text-background", label: "left the squad" },
};

export function PlayerChip({
  player,
  tag,
  tagLabel,
  captain,
  vice,
  selected,
  target,
  dimmed,
  autoSub,
  onClick,
}: {
  player: ChipPlayer;
  /** Text on the dark tag: a price or a points number. */
  tag?: string;
  /** Spoken version of the tag, e.g. "₦7.5m" or "12 points". */
  tagLabel?: string;
  captain?: boolean;
  vice?: boolean;
  selected?: boolean;
  /** A valid swap target (mint glow). */
  target?: boolean;
  dimmed?: boolean;
  autoSub?: boolean;
  onClick?: () => void;
}) {
  const status = player.status ?? "available";
  const flag = status === "available" ? null : FLAG[status];
  const label = [
    player.displayName,
    `Year ${player.teamYear}`,
    POSITION_LABEL[player.position].toLowerCase(),
    tagLabel ?? tag,
    captain ? "captain" : vice ? "vice-captain" : null,
    flag ? flag.label : null,
    autoSub ? "auto-sub" : null,
  ]
    .filter(Boolean)
    .join(", ");

  const body = (
    <>
      <span className="relative">
        <Kit year={player.teamYear} className={cn(status === "left" && "opacity-50")} />
        {captain && (
          <span className="absolute -top-1 -right-2.5 flex size-5 -rotate-8 items-center justify-center rounded-full bg-highlight font-heading text-[0.65rem] font-bold text-highlight-foreground shadow-sm">
            C
          </span>
        )}
        {vice && (
          <span className="absolute -top-1 -right-2.5 flex size-5 items-center justify-center rounded-full border-2 border-brand-light bg-brand-foreground font-heading text-[0.65rem] font-bold text-brand">
            V
          </span>
        )}
        {flag && (
          <span
            className={cn(
              "absolute -top-1 -left-2 flex size-4 items-center justify-center rounded-full text-[0.65rem] font-bold",
              flag.cls,
            )}
          >
            !
          </span>
        )}
        {autoSub && (
          <span className="absolute -bottom-0.5 -left-2 flex size-4 items-center justify-center rounded-full bg-background text-foreground">
            <ArrowLeftRight className="size-3" />
          </span>
        )}
      </span>
      <span
        className={cn(
          "-mt-0.5 w-full truncate rounded-t-sm bg-card px-0.5 text-[0.65rem] leading-4 font-semibold text-card-foreground",
          status === "left" && "line-through",
        )}
      >
        {player.displayName}
      </span>
      {tag !== undefined && (
        <span className="w-full rounded-b-sm bg-foreground px-0.5 text-[0.65rem] leading-4 font-semibold text-background tabular-nums">
          {tag}
        </span>
      )}
    </>
  );

  const cls = cn(
    "flex min-h-11 w-full min-w-0 flex-col items-center rounded-md p-0.5 text-center transition-[transform,box-shadow,opacity] duration-(--dur-fast)",
    selected && "shadow-glow motion-safe:scale-104",
    target && "shadow-glow",
    dimmed && "opacity-40",
  );

  if (!onClick) return <div className={cls} aria-label={label} role="img">{body}</div>;
  return (
    <button type="button" onClick={onClick} className={cls} aria-label={label} aria-pressed={selected || undefined}>
      {body}
    </button>
  );
}

/** Dashed empty shirt with a + and the position. */
export function EmptyChip({ position, onClick }: { position: Position; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Add a ${POSITION_LABEL[position].toLowerCase()}`}
      className="flex min-h-11 w-full min-w-0 flex-col items-center gap-1 rounded-md p-0.5 text-brand-foreground/80 dark:text-foreground/80"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-dashed border-current">
        <Plus className="size-4" />
      </span>
      <span className="text-[0.65rem] font-semibold">{position}</span>
    </button>
  );
}
