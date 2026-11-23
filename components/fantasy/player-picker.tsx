"use client";

import { useMemo, useState, type ReactNode } from "react";
import { AnimatePresence } from "motion/react";
import { AnimatedPlayerRow, SlidingChoice } from "@/components/fantasy/motion-bits";
import { useLocalStorageState } from "@/hooks/use-local-storage-state";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatMoney } from "@/lib/fantasy/format";
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

/** Search + compact filters + the player list, used inside the picker sheets. */
export function PlayerPickerList({
  players,
  position,
  renderAction,
  reasonFor,
  hideBlocked = false,
  storageKey = null,
}: {
  players: Player[];
  position: Position;
  renderAction: (p: Player, reason: string | null) => ReactNode;
  reasonFor: (p: Player) => string | null;
  /** Show only players that can be picked, with a count of the rest. */
  hideBlocked?: boolean;
  /** Where to remember the filters between visits (null: don't). */
  storageKey?: string | null;
}) {
  const [saved, setSaved] = useLocalStorageState<Filters>(storageKey, { ...DEFAULT_FILTERS, position });
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
        <Input
          type="search"
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          placeholder="Search players"
          aria-label="Search players"
          className="h-11 text-base"
        />
        <FilterControls filters={filters} onChange={setFilters} prices={prices} showPosition={false} />
      </div>
      <ul className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto border-t border-border px-2 pb-6">
        <AnimatePresence initial={false} mode="popLayout">
          {shown.length === 0 && (
            <li key="none" className="py-8 text-center text-sm text-muted-foreground">
              No players match these filters.
            </li>
          )}
          {shown.map((p, i) => {
            const reason = reasonFor(p);
            return <AnimatedPlayerRow key={p.id} index={i} player={p} reason={reason} action={renderAction(p, reason)} />;
          })}
        </AnimatePresence>
        {blocked.length > 0 && (
          <li className="py-3 text-center text-xs text-muted-foreground">
            {blocked.length} more hidden: not enough budget or year full.
          </li>
        )}
      </ul>
    </div>
  );
}
