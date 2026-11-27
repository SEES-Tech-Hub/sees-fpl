"use client";

import { useMemo, useState, type ReactNode } from "react";
import { LayoutGrid, List, Plus } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { AnimatedPlayerRow, SlidingChoice } from "@/components/fantasy/motion-bits";
import { useLocalStorageState } from "@/hooks/use-local-storage-state";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlayerCard } from "@/components/fantasy/player-card";
import { PlayerFace } from "@/components/fantasy/player-face";
import { CREST_CLASS } from "@/lib/design/crest";
import { formatMoney, POSITION_LABEL } from "@/lib/fantasy/format";
import { cn } from "@/lib/utils";
import { POSITIONS, type Player, type Position } from "@/lib/fantasy/types";

export type Sort = "price-desc" | "price-asc" | "points" | "picked";

export type Filters = {
  position: Position | "ALL";
  year: number | null;
  maxPrice: number | null;
  sort: Sort;
  search: string;
};

export const DEFAULT_FILTERS: Filters = { position: "ALL", year: null, maxPrice: null, sort: "price-desc", search: "" };

const SORT_LABEL: Record<Sort, string> = {
  "price-desc": "Price: high to low",
  "price-asc": "Price: low to high",
  points: "Most points",
  picked: "Most picked",
};

export function applyFilters(players: Player[], f: Filters) {
  const q = f.search.trim().toLowerCase();
  const cmp: Record<Sort, (a: Player, b: Player) => number> = {
    "price-desc": (a, b) => b.priceTenths - a.priceTenths,
    "price-asc": (a, b) => a.priceTenths - b.priceTenths,
    points: (a, b) => b.totalPoints - a.totalPoints,
    picked: (a, b) => b.selectedByPct - a.selectedByPct,
  };
  return players
    .filter(
      (p) =>
        (f.position === "ALL" || p.position === f.position) &&
        (f.year === null || p.teamYear === f.year) &&
        (f.maxPrice === null || p.priceTenths <= f.maxPrice) &&
        (!q || p.displayName.toLowerCase().includes(q) || p.fullName.toLowerCase().includes(q)),
    )
    .sort((a, b) => cmp[f.sort](a, b) || a.displayName.localeCompare(b.displayName));
}

export function activeFilterCount(f: Filters) {
  return (f.position !== "ALL" ? 1 : 0) + (f.year !== null ? 1 : 0) + (f.maxPrice !== null ? 1 : 0);
}

/** Position segmented control, year chips, price cap and sort (design system §11.3). */
export function FilterControls({
  filters,
  onChange,
  prices,
  showPosition = true,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  prices: number[];
  showPosition?: boolean;
}) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  return (
    <div className="flex flex-col gap-4">
      {showPosition && (
        <div>
          <p className="mb-1.5 text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Position</p>
          <SlidingChoice
            label="Position"
            value={filters.position}
            onChange={(position) => set({ position })}
            options={(["ALL", ...POSITIONS] as const).map((pos) => ({ value: pos, label: pos === "ALL" ? "All" : pos }))}
          />
        </div>
      )}
      <div>
        <p className="mb-1.5 text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Year</p>
        <SlidingChoice
          label="Year"
          variant="pills"
          value={filters.year}
          onChange={(year) => set({ year })}
          options={[{ value: null, label: "All" }, ...[1, 2, 3, 4, 5].map((y) => ({ value: y, label: `Y${y}` }))]}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="mb-1.5 text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Max price</p>
          <Select
            value={filters.maxPrice === null ? "any" : String(filters.maxPrice)}
            onValueChange={(v) => set({ maxPrice: v === "any" ? null : Number(v) })}
          >
            <SelectTrigger className="h-11 w-full" aria-label="Max price">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={4}>
              <SelectItem value="any" className="h-10">Any price</SelectItem>
              {prices.map((p) => (
                <SelectItem key={p} value={String(p)} className="h-10">
                  Up to {formatMoney(p)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Sort</p>
          <Select value={filters.sort} onValueChange={(v) => set({ sort: v as Sort })}>
            <SelectTrigger className="h-11 w-full" aria-label="Sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={4}>
              {(Object.keys(SORT_LABEL) as Sort[]).map((s) => (
                <SelectItem key={s} value={s} className="h-10">
                  {SORT_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

type PickerView = "list" | "faces";
/** List or Faces, remembered on this phone for every picker. */
const VIEW_KEY = "sees-fantasy:picker-view";

/**
 * Search + compact filters + the players, used inside the picker sheets.
 * "List" is the classic rows; "Faces" is a grid of faces grouped by year, for
 * people who know the players by face, not name. Tapping a face (in either)
 * opens the player card, whose button does `onChoose`.
 */
export function PlayerPickerList({
  players,
  position,
  renderAction,
  reasonFor,
  onChoose,
  verb,
  hideBlocked = false,
  storageKey = null,
}: {
  players: Player[];
  position: Position;
  renderAction: (p: Player, reason: string | null) => ReactNode;
  reasonFor: (p: Player) => string | null;
  /** Pick this player: what the row's action button does. */
  onChoose: (p: Player) => void;
  /** The action's word on the card and the faces grid ("Add", "Bring in"). */
  verb: string;
  /** Show only players that can be picked, with a count of the rest. */
  hideBlocked?: boolean;
  /** Where to remember the filters between visits (null: don't). */
  storageKey?: string | null;
}) {
  const [view, setView] = useLocalStorageState<PickerView>(VIEW_KEY, "list", {
    validate: (v) => (v === "list" || v === "faces" ? v : null),
  });
  const [shown_, setShown] = useState<Player | null>(null);
  const [cardOpen, setCardOpen] = useState(false);
  const show = (p: Player) => {
    setShown(p);
    setCardOpen(true);
  };
  // Remembered on this phone when there's a key; otherwise kept for this
  // sheet only (the storage hook ignores changes when it has no key).
  const [stored, setStored] = useLocalStorageState<Filters>(storageKey, { ...DEFAULT_FILTERS, position });
  const [local, setLocal] = useState<Filters>({ ...DEFAULT_FILTERS, position });
  const saved = storageKey ? stored : local;
  const setSaved = (f: Filters) => (storageKey ? setStored(f) : setLocal(f));
  // Filters are remembered; the search box isn't (a stale search hides everyone).
  const [search, setSearch] = useState("");
  // The sheet is always for one position, whatever was saved.
  const filters = { ...saved, position, search };
  const setFilters = (f: Filters) => {
    setSaved({ ...f, search: "" });
    setSearch(f.search);
  };
  const prices = useMemo(() => [...new Set(players.map((p) => p.priceTenths))].sort((a, b) => a - b), [players]);
  const list = applyFilters(players, filters);
  const blocked = hideBlocked ? list.filter((p) => reasonFor(p)) : [];
  const shown = hideBlocked ? list.filter((p) => !reasonFor(p)) : list;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-3 px-4 pb-3">
        <div className="flex gap-2">
          <Input
            type="search"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            placeholder="Search players"
            aria-label="Search players"
            className="h-11 min-w-0 flex-1 text-base"
          />
          <div role="radiogroup" aria-label="Show players as" className="flex shrink-0 gap-0.5 rounded-xl bg-muted p-1">
            {(
              [
                ["list", "List", List],
                ["faces", "Faces", LayoutGrid],
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={view === value}
                aria-label={label}
                onClick={() => setView(value)}
                className={cn(
                  "flex h-9 w-10 items-center justify-center rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  view === value ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-[18px]" aria-hidden />
              </button>
            ))}
          </div>
        </div>
        <FilterControls filters={filters} onChange={setFilters} prices={prices} showPosition={false} />
      </div>
      {view === "faces" ? (
        <FaceGrid players={shown} reasonFor={reasonFor} onShow={show} onChoose={onChoose} verb={verb} blockedCount={blocked.length} />
      ) : (
        <ul className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto border-t border-border px-2 pb-6">
          <AnimatePresence initial={false} mode="popLayout">
            {shown.length === 0 && (
              <li key="none" className="py-8 text-center text-sm text-muted-foreground">
                No players match these filters.
              </li>
            )}
            {shown.map((p, i) => {
              const reason = reasonFor(p);
              return (
                <AnimatedPlayerRow key={p.id} index={i} player={p} reason={reason} action={renderAction(p, reason)} onShow={() => show(p)} />
              );
            })}
          </AnimatePresence>
          {blocked.length > 0 && (
            <li className="py-3 text-center text-xs text-muted-foreground">
              {blocked.length} more hidden: not enough budget or year full.
            </li>
          )}
        </ul>
      )}
      <PlayerCard
        player={shown_}
        open={cardOpen}
        onOpenChange={setCardOpen}
        verb={verb}
        reason={shown_ ? reasonFor(shown_) : null}
        onChoose={(p) => {
          setCardOpen(false);
          onChoose(p);
        }}
      />
    </div>
  );
}

/** Faces three across, grouped by year (in the filtered order within each year). */
function FaceGrid({
  players,
  reasonFor,
  onShow,
  onChoose,
  verb,
  blockedCount,
}: {
  players: Player[];
  reasonFor: (p: Player) => string | null;
  onShow: (p: Player) => void;
  onChoose: (p: Player) => void;
  verb: string;
  blockedCount: number;
}) {
  const years = [1, 2, 3, 4, 5].map((y) => ({ year: y, players: players.filter((p) => p.teamYear === y) })).filter((g) => g.players.length > 0);
  let n = 0;
  return (
    <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto border-t border-border px-4 pb-8">
      {players.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No players match these filters.</p>}
      {years.map((g) => (
        <section key={g.year} aria-labelledby={`faces-y${g.year}`} className="flex flex-col gap-3 pt-4">
          <h3 id={`faces-y${g.year}`} className="flex items-baseline gap-2 font-heading text-[0.9375rem] font-semibold uppercase">
            Year {g.year}
            <span className="font-sans text-xs font-medium text-muted-foreground normal-case">
              {CREST_CLASS[g.year]} · {g.players.length} {g.players.length === 1 ? POSITION_LABEL[g.players[0].position].toLowerCase() : "players"}
            </span>
          </h3>
          <ul className="grid grid-cols-3 gap-x-2.5 gap-y-4">
            {g.players.map((p) => {
              const reason = reasonFor(p);
              const delay = Math.min(n++, 12) * 30;
              return (
                <li
                  key={p.id}
                  className={cn(
                    "flex flex-col items-center gap-1.5 motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-90 motion-safe:fill-mode-backwards motion-safe:duration-300",
                    reason && "opacity-45",
                  )}
                  style={{ animationDelay: `${delay}ms` }}
                >
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => onShow(p)}
                      aria-label={`See ${p.displayName}`}
                      className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring"
                    >
                      <PlayerFace player={p} size={84} badge={false} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onChoose(p)}
                      disabled={Boolean(reason)}
                      aria-label={`${verb} ${p.displayName}`}
                      className="absolute -right-1.5 -bottom-1 flex size-9 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground transition-transform active:scale-90 disabled:bg-muted-foreground"
                    >
                      <Plus className="size-4" strokeWidth={2.6} aria-hidden />
                    </button>
                  </div>
                  <span className="max-w-full truncate text-[0.8125rem] font-semibold">{p.displayName}</span>
                  <span className={cn("-mt-1 font-heading text-[0.8125rem] font-semibold tabular-nums", reason && "text-destructive")}>
                    {formatMoney(p.priceTenths)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {blockedCount > 0 && (
        <p className="pt-5 text-center text-xs text-muted-foreground">{blockedCount} more hidden: not enough budget or year full.</p>
      )}
    </div>
  );
}
