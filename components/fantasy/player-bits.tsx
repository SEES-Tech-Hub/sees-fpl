import type { ReactNode } from "react";
import { TeamDot } from "@/components/fantasy/team-badge";
import { formatMoney } from "@/lib/fantasy/format";
import type { Player, PlayerStatus, Position } from "@/lib/fantasy/types";
import { cn } from "@/lib/utils";

/** Positions are neutral: never team-coloured, never status-coloured (design system §3.1). */
export function PositionTag({ position, className }: { position: Position; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-[0.7rem] font-semibold text-muted-foreground",
        className,
      )}
    >
      {position}
    </span>
  );
}

const STATUS: Record<Exclude<PlayerStatus, "available">, { label: string; cls: string }> = {
  injured: { label: "Injured", cls: "bg-warning text-highlight-foreground" },
  suspended: { label: "Suspended", cls: "bg-destructive/15 text-destructive" },
  left: { label: "Left squad", cls: "bg-muted text-muted-foreground" },
};

export function StatusFlag({ status }: { status: PlayerStatus }) {
  if (status === "available") return null;
  const s = STATUS[status];
  return (
    <span className={cn("inline-flex h-5 shrink-0 items-center rounded-full px-1.5 text-[0.7rem] font-semibold", s.cls)}>
      {s.label}
    </span>
  );
}

/**
 * Design system §11.3 PlayerRow: team dot, name, neutral position tag, price,
 * points and "picked by", with the action on the right. A disabled action
 * shows its reason under the name.
 */
export function PlayerRow({
  player,
  reason,
  action,
  highlight,
  as: Tag = "li",
}: {
  player: Player;
  reason?: ReactNode;
  action?: ReactNode;
  highlight?: boolean;
  as?: "li" | "div";
}) {
  return (
    <Tag
      className={cn(
        "flex min-h-16 items-center gap-3 border-b border-border px-2 py-2 last:border-b-0",
        highlight && "bg-secondary",
      )}
    >
      <TeamDot year={player.teamYear} className="size-7 text-xs" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className={cn("truncate text-[0.9375rem] font-semibold", player.status === "left" && "line-through")}>
            {player.displayName}
          </p>
          <StatusFlag status={player.status} />
        </div>
        <p className="flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground">
          <PositionTag position={player.position} />
          <span className="truncate tabular-nums">picked by {Math.round(player.selectedByPct)}%</span>
        </p>
        {reason ? <p className="mt-0.5 text-xs font-medium text-destructive">{reason}</p> : null}
      </div>
      <div className="w-14 text-right">
        <p className="font-heading text-base font-semibold tabular-nums">{formatMoney(player.priceTenths)}</p>
        <p className="text-xs text-muted-foreground tabular-nums">{player.totalPoints} pts</p>
      </div>
      {action}
    </Tag>
  );
}
