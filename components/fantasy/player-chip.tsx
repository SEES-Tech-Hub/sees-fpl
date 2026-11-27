import Image from "next/image";
import { ArrowLeftRight, Plus } from "lucide-react";
import { Kit } from "@/components/fantasy/team-badge";
import { teamColour } from "@/lib/design/team-colour";
import { POSITION_LABEL } from "@/lib/fantasy/format";
import type { PlayerStatus, Position } from "@/lib/fantasy/types";
import { cn } from "@/lib/utils";

// Design system §11.3 PlayerChip: the player's face in a ring of their year's
// colour (the shirt in that colour when there's no photo yet), the name on a
// label, and the price, next match or points on a dark tag. A small year tag
// sits on the face's corner. Players with no match this matchday are greyed
// (resting); players in a match right now get a pulsing live dot.

export type ChipPlayer = {
  displayName: string;
  position: Position;
  teamYear: number;
  status?: PlayerStatus;
  /** public/players/<id>.webp, or null for the shirt. */
  photoUrl?: string | null;
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
  resting,
  live,
  fresh,
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
  /** No match this matchday: greyed out. */
  resting?: boolean;
  /** Playing right now: a pulsing live dot. */
  live?: boolean;
  /** Just came off the bench (formation change): a mint "IN" tag for a moment. */
  fresh?: boolean;
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
    resting ? "no match this matchday" : null,
    live ? "playing now" : null,
  ]
    .filter(Boolean)
    .join(", ");

  const body = (
    <>
      <span className="relative">
        {player.photoUrl ? (
          <span className="relative block size-11">
            <Image
              src={player.photoUrl}
              alt=""
              width={44}
              height={44}
              sizes="44px"
              className={cn("size-11 rounded-full bg-muted object-cover", (status === "left" || resting) && "grayscale", status === "left" && "opacity-50")}
              style={{ boxShadow: `0 0 0 2px var(--pitch), 0 0 0 4px ${resting ? "var(--highlight)" : teamColour(player.teamYear)}` }}
            />
            <span
              className="absolute -right-2 -bottom-1 rounded-full px-1 text-[0.55rem] leading-3.5 font-bold text-highlight-foreground shadow-sm"
              style={{ background: teamColour(player.teamYear) }}
              aria-hidden
            >
              Y{player.teamYear}
            </span>
          </span>
        ) : (
          <Kit year={player.teamYear} className={cn((status === "left" || resting) && "opacity-50")} />
        )}
        {live && (
          <span className="absolute -top-0.5 -left-1 flex size-3 items-center justify-center" aria-hidden>
            <span className="absolute size-3 rounded-full bg-live opacity-60 motion-safe:animate-ping" />
            <span className="relative size-2.5 rounded-full border-2 border-pitch bg-live" />
          </span>
        )}
        {fresh && (
          <span className="absolute -top-1.5 -left-2.5 rounded-full bg-brand-light px-1 text-[0.55rem] leading-3.5 font-bold text-brand motion-safe:animate-in motion-safe:zoom-in-50" aria-hidden>
            IN
          </span>
        )}
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
          "mt-1 w-full truncate rounded-t-sm bg-card px-0.5 text-[0.65rem] leading-4 font-semibold text-card-foreground",
          status === "left" && "line-through",
        )}
      >
        {player.displayName}
      </span>
      {tag !== undefined && (
        <span
          className={cn(
            "w-full rounded-b-sm px-0.5 text-[0.65rem] leading-4 font-semibold tabular-nums",
            resting ? "bg-highlight text-highlight-foreground" : "bg-foreground text-background",
          )}
        >
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
