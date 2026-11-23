"use client";

import { Check } from "lucide-react";
import type { SquadPlayer } from "@/lib/console/squad";
import { cn } from "@/lib/utils";

// Owner: Samuel (console). A list of big tappable rows, one per player, for
// the event sheets. Works as a radio group for screen readers.

export function PlayerPicker({
  label,
  players,
  value,
  onChange,
  noneLabel,
  emptyText = "No players to pick from.",
}: {
  label: string;
  players: SquadPlayer[];
  value: string | null;
  onChange: (id: string | null) => void;
  /** Offer a "nobody" option, such as "No assist". */
  noneLabel?: string;
  emptyText?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium text-muted-foreground">{label}</legend>
      <div role="radiogroup" aria-label={label} className="flex flex-col gap-1.5">
        {noneLabel && (
          <Row selected={value === null} onSelect={() => onChange(null)}>
            <span className="text-muted-foreground">{noneLabel}</span>
          </Row>
        )}
        {players.map((p) => (
          <Row key={p.id} label={playerLabel(p)} selected={value === p.id} onSelect={() => onChange(p.id)}>
            <span className="w-7 shrink-0 text-right font-mono text-sm text-muted-foreground tabular-nums">
              {p.shirtNumber ?? ""}
            </span>
            <span className="flex-1 truncate font-medium">{p.name}</span>
            <span className="text-xs text-muted-foreground">{p.position}</span>
          </Row>
        ))}
        {players.length === 0 && !noneLabel && <p className="text-sm text-muted-foreground">{emptyText}</p>}
      </div>
    </fieldset>
  );
}

/** "Ade Bello, number 9, FWD": what a screen reader says for a row. */
export function playerLabel(p: SquadPlayer): string {
  return [p.name, p.shirtNumber !== null ? `number ${p.shirtNumber}` : null, p.position].filter(Boolean).join(", ");
}

function Row({
  label,
  selected,
  onSelect,
  children,
}: {
  label?: string;
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      onClick={onSelect}
      className={cn(
        "flex min-h-12 w-full items-center gap-3 rounded-lg border px-3 text-left transition-colors",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        selected ? "border-primary bg-secondary text-secondary-foreground" : "border-border bg-card",
      )}
    >
      {children}
      <Check aria-hidden className={cn("size-5 shrink-0 text-primary", !selected && "invisible")} />
    </button>
  );
}
