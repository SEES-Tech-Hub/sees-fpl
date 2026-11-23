"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import type { SquadPlayer } from "@/lib/console/squad";
import type { SetLineupInput, TeamSummary } from "@/lib/live/types";
import { cn } from "@/lib/utils";
import { playerLabel } from "./player-picker";

// Owner: Samuel (console). The lineup check before kickoff: tick the starters
// from the squad; everyone else available goes on the bench. Saved through
// the queue like any other action. The server allows 1 to 11 starters and
// refuses a player serving a red-card ban (player_banned).

const MAX_STARTERS = 11;

export function LineupSheet({
  team,
  squad,
  currentStarters,
  onSave,
  close,
}: {
  team: TeamSummary;
  squad: SquadPlayer[];
  /** The lineup already saved (or waiting to send), if any. */
  currentStarters: string[] | null;
  onSave: (input: Omit<SetLineupInput, "fixtureId">) => void;
  close: () => void;
}) {
  const [starters, setStarters] = useState<ReadonlySet<string>>(() => new Set(currentStarters ?? []));
  const available = squad.filter((p) => p.status !== "suspended");
  const full = starters.size >= MAX_STARTERS;

  function toggle(id: string) {
    setStarters((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_STARTERS) next.add(id);
      return next;
    });
  }

  return (
    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle className="font-heading text-xl">Lineup: {team.name}</DrawerTitle>
        <DrawerDescription>
          Tick the starters. Everyone else goes on the bench. {starters.size} of {MAX_STARTERS} picked.
        </DrawerDescription>
      </DrawerHeader>
      <ul className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-4 pb-2" aria-label={`${team.name} squad`}>
        {squad.map((p) => {
          const checked = starters.has(p.id);
          const suspended = p.status === "suspended";
          const disabled = suspended || (!checked && full);
          return (
            <li key={p.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                aria-label={`${playerLabel(p)}${suspended ? ", suspended" : p.status === "injured" ? ", injured" : ""}`}
                disabled={disabled}
                onClick={() => toggle(p.id)}
                className={cn(
                  "flex min-h-12 w-full items-center gap-3 rounded-lg border px-3 text-left transition-colors",
                  "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50",
                  checked ? "border-primary bg-secondary text-secondary-foreground" : "border-border bg-card",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-md border",
                    checked ? "border-primary bg-primary text-primary-foreground" : "border-input",
                  )}
                >
                  {checked && <Check className="size-4" />}
                </span>
                <span className="w-6 shrink-0 text-right font-mono text-sm text-muted-foreground tabular-nums">
                  {p.shirtNumber ?? ""}
                </span>
                <span className="flex-1 truncate font-medium">{p.name}</span>
                <span className="text-xs text-muted-foreground">
                  {suspended ? "Suspended" : p.status === "injured" ? `${p.position} · injured` : p.position}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <DrawerFooter>
        <Button
          className="h-14 text-base"
          disabled={starters.size === 0}
          onClick={() => {
            const ids = [...starters];
            onSave({
              teamId: team.id,
              starters: ids,
              bench: available.filter((p) => !starters.has(p.id)).map((p) => p.id),
            });
            close();
          }}
        >
          Save lineup ({starters.size} starting)
        </Button>
      </DrawerFooter>
    </DrawerContent>
  );
}
