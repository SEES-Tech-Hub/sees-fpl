"use client";

import { Plus } from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { CREST_CLASS } from "@/lib/design/crest";
import { formatMoney, POSITION_LABEL } from "@/lib/fantasy/format";
import type { Player } from "@/lib/fantasy/types";
import { formatWAT } from "@/lib/utils";
import { PlayerFace } from "./player-face";

// Tap a face: the player up close. Big photo (or crest), position and year,
// price, points and how many managers picked them, the team's next match,
// and the picker's own action ("Add", "Bring in"), or why it can't be done.

const opponent = (short: string | null) => (short && /^Y\d$/.test(short) ? `Year ${short.slice(1)}` : short ?? "TBC");

export function PlayerCard({
  player,
  open,
  onOpenChange,
  verb,
  reason,
  onChoose,
}: {
  player: Player | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The picker's action, e.g. "Add" or "Bring in". */
  verb: string;
  /** Why the player can't be chosen right now (budget, year full). */
  reason: string | null;
  onChoose: (p: Player) => void;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-md">
        {player && (
          <div className="flex flex-col items-center gap-5 px-5 pt-4 pb-7">
            <PlayerFace player={player} size={168} badge={false} className="mt-2" />
            <div className="flex flex-col items-center gap-1 text-center">
              <DrawerTitle className="font-heading text-[2.1rem] leading-none font-bold uppercase">{player.displayName}</DrawerTitle>
              <DrawerDescription className="text-sm text-secondary-foreground">
                {POSITION_LABEL[player.position]} · Year {player.teamYear}
                {CREST_CLASS[player.teamYear] ? ` (${CREST_CLASS[player.teamYear]})` : ""}
              </DrawerDescription>
              {player.fullName !== player.displayName && <p className="text-xs text-muted-foreground">{player.fullName}</p>}
            </div>

            <dl className="grid w-full grid-cols-3 gap-2">
              {[
                [formatMoney(player.priceTenths), "Price"],
                [String(player.totalPoints), "Points"],
                [`${Math.round(player.selectedByPct)}%`, "Picked by"],
              ].map(([value, label]) => (
                <div key={label} className="flex flex-col items-center gap-0.5 rounded-xl bg-muted px-2 py-3">
                  <dd className="font-heading text-xl font-bold tabular-nums">{value}</dd>
                  <dt className="order-last text-xs text-muted-foreground">{label}</dt>
                </div>
              ))}
            </dl>

            {player.nextMatch && (
              <p className="flex w-full items-center gap-3 rounded-xl border border-border px-4 py-3 text-sm">
                <span className="text-[0.6875rem] font-bold tracking-[0.08em] text-secondary-foreground uppercase">Next match</span>
                <span className="font-semibold">
                  v {opponent(player.nextMatch.opponentShort)} · {formatWAT(player.nextMatch.kickoffAt, "datetime")}
                </span>
              </p>
            )}

            <div className="flex w-full flex-col gap-2">
              {reason && <p className="text-center text-sm font-medium text-destructive">{reason}</p>}
              <button
                type="button"
                disabled={Boolean(reason)}
                onClick={() => onChoose(player)}
                className="flex h-13 items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-primary-foreground transition-transform outline-none focus-visible:ring-3 focus-visible:ring-ring active:scale-[0.98] disabled:opacity-45"
              >
                <Plus className="size-5" aria-hidden />
                {verb} {player.displayName} · {formatMoney(player.priceTenths)}
              </button>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="h-11 rounded-xl text-[0.9375rem] font-semibold text-primary transition-colors hover:bg-muted"
              >
                Back to players
              </button>
            </div>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
