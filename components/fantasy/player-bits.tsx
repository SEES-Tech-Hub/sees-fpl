import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/fantasy/format";
import type { Player, PlayerStatus, Position } from "@/lib/fantasy/types";
import { cn } from "@/lib/utils";

const POSITION_STYLE: Record<Position, string> = {
  GK: "bg-highlight text-highlight-foreground",
  DEF: "bg-brand text-brand-foreground",
  MID: "bg-info text-brand-foreground",
  FWD: "bg-live text-brand-foreground",
};

export function PositionTag({ position, className }: { position: Position; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 w-9 shrink-0 items-center justify-center rounded text-[0.65rem] font-semibold",
        POSITION_STYLE[position],
        className,
      )}
    >
      {position}
    </span>
  );
}

const STATUS_LABEL: Record<Exclude<PlayerStatus, "available">, string> = {
  injured: "Injured",
  suspended: "Suspended",
  left: "Left squad",
};

export function StatusFlag({ status }: { status: PlayerStatus }) {
  if (status === "available") return null;
  return (
    <Badge variant="destructive" className="h-5 px-1.5 text-[0.65rem]">
      {STATUS_LABEL[status]}
    </Badge>
  );
}

/** One tappable player line used by the squad builder and transfers. */
export function PlayerRow({
  player,
  note,
  action,
  highlight,
}: {
  player: Player;
  note?: ReactNode;
  action?: ReactNode;
  highlight?: boolean;
}) {
  return (
    <li
      className={cn(
        "flex min-h-14 items-center gap-3 border-b border-border px-1 py-2 last:border-b-0",
        highlight && "bg-secondary",
      )}
    >
      <PositionTag position={player.position} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-medium">{player.displayName}</p>
          <StatusFlag status={player.status} />
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {player.teamShort} · {player.totalPoints} pts · {player.selectedByPct}% picked
          {note ? <> · {note}</> : null}
        </p>
      </div>
      <p className="w-14 text-right text-sm font-medium tabular-nums">{formatMoney(player.priceTenths)}</p>
      {action}
    </li>
  );
}
