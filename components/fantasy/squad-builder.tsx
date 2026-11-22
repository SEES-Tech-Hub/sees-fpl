"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { saveSquadAction } from "@/app/fantasy/actions";
import { BudgetBar, SquadProgress } from "@/components/fantasy/budget-bar";
import { BenchTray, Pitch, PitchRow } from "@/components/fantasy/pitch";
import { PlayerRow, StatusFlag } from "@/components/fantasy/player-bits";
import { EmptyChip, PlayerChip } from "@/components/fantasy/player-chip";
import {
  activeFilterCount,
  applyFilters,
  DEFAULT_FILTERS,
  FilterControls,
  PlayerPickerList,
  type Filters,
} from "@/components/fantasy/player-picker";
import { InlineError } from "@/components/fantasy/states";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { ERROR_COPY } from "@/lib/fantasy/errors";
import { formatMoney, POSITION_LABEL, POSITION_PLURAL } from "@/lib/fantasy/format";
import type { FantasyRules, Player, Position } from "@/lib/fantasy/types";
import { cannotAddReason, countByPosition, squadCost, squadIssues } from "@/lib/fantasy/validate";
import { cn } from "@/lib/utils";

// Pitch rows from the top (design system §11.3): FWD, MID, DEF, GK.
const PITCH_ORDER: Position[] = ["FWD", "MID", "DEF", "GK"];

export function SquadBuilder({
  players,
  rules,
  draftKey,
}: {
  players: Player[];
  rules: FantasyRules;
  draftKey: string;
}) {
  const router = useRouter();
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [view, setView] = useState<"pitch" | "list">("pitch");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [pickFor, setPickFor] = useState<Position | null>(null);
  const [sheetFor, setSheetFor] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  // Keep an unsaved draft on this phone, so a dropped connection doesn't lose picks.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(draftKey);
      const ids = raw ? (JSON.parse(raw) as string[]) : [];
      const valid = ids.filter((id) => byId.has(id));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring browser-only state after hydration
      if (valid.length) setSelectedIds(valid);
    } catch {
      // Storage blocked or corrupt: start empty.
    }
  }, [draftKey, byId]);

  function update(ids: string[]) {
    setSelectedIds(ids);
    setServerError(null);
    try {
      window.localStorage.setItem(draftKey, JSON.stringify(ids));
    } catch {
      // The draft is a convenience.
    }
  }

  const selected = selectedIds.map((id) => byId.get(id)).filter((p): p is Player => Boolean(p));
  const counts = countByPosition(selected);
  const left = rules.budgetTenths - squadCost(selected);
  const issues = squadIssues(selected, rules);
  const blocking = issues.filter((i) => i.blocking);
  const complete = selected.length === rules.squadSize && blocking.length === 0;
  const remaining = rules.squadSize - selected.length;
  const prices = useMemo(() => [...new Set(players.map((p) => p.priceTenths))].sort((a, b) => a - b), [players]);

  const add = (p: Player) => {
    if (!cannotAddReason(p, selected, rules)) update([...selectedIds, p.id]);
  };
  const remove = (id: string) => update(selectedIds.filter((x) => x !== id));

  function save() {
    startSaving(async () => {
      try {
        const result = await saveSquadAction(selectedIds);
        if (!result.ok) {
          setServerError(`${result.error.message} Fix it and save again.`);
          toast.error(result.error.message);
          return;
        }
        try {
          window.localStorage.removeItem(draftKey);
        } catch {}
        toast.success("Team saved");
        router.push("/fantasy/team");
      } catch {
        setServerError(ERROR_COPY.UNKNOWN);
        toast.error(ERROR_COPY.UNKNOWN);
      }
    });
  }

  // On the pitch: all but one of each position; the last of each sits on the bench (GK first).
  const onPitch = (pos: Position) => rules.squadPositions[pos] - 1;
  const ofPos = (pos: Position) => selected.filter((p) => p.position === pos);
  const chipFor = (p: Player) => (
    <PlayerChip
      key={p.id}
      player={p}
      tag={formatMoney(p.priceTenths)}
      selected={sheetFor === p.id}
      onClick={() => setSheetFor(p.id)}
    />
  );
  const benchPositions: Position[] = ["GK", "DEF", "MID", "FWD"];
  const sheetPlayer = sheetFor ? byId.get(sheetFor) : undefined;
  const listed = applyFilters(players, filters);
  const nFilters = activeFilterCount(filters);

  return (
    <div className="flex flex-col gap-4 pb-36">
      <div role="tablist" aria-label="View" className="grid w-44 grid-cols-2 rounded-lg bg-muted p-1">
        {(["pitch", "list"] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={cn(
              "h-10 rounded-md text-[0.9375rem] font-medium text-muted-foreground",
              view === v && "bg-background text-foreground shadow-card",
            )}
          >
            {v === "pitch" ? "Pitch" : "List"}
          </button>
        ))}
      </div>

      {view === "pitch" ? (
        <>
          <Pitch>
            {PITCH_ORDER.map((pos) => {
              const list = ofPos(pos).slice(0, onPitch(pos));
              const empty = onPitch(pos) - list.length;
              return (
                <PitchRow key={pos} count={onPitch(pos)} label={POSITION_PLURAL[pos]}>
                  {list.map(chipFor)}
                  {Array.from({ length: empty }, (_, i) => (
                    <EmptyChip key={`e${i}`} position={pos} onClick={() => setPickFor(pos)} />
                  ))}
                </PitchRow>
              );
            })}
          </Pitch>
          <BenchTray
            items={benchPositions.map((pos) => {
              const p = ofPos(pos)[onPitch(pos)];
              return {
                key: pos,
                node: p ? (
                  chipFor(p)
                ) : (
                  <span className="text-muted-foreground [&_button]:text-muted-foreground">
                    <EmptyChip position={pos} onClick={() => setPickFor(pos)} />
                  </span>
                ),
              };
            })}
          />
        </>
      ) : (
        <section aria-label="Players" className="flex flex-col gap-3">
          <div className="flex gap-2">
            <Input
              type="search"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Search players"
              aria-label="Search players"
              className="h-11 flex-1 text-base"
            />
            <Button variant="outline" className="h-11 gap-2 px-3" onClick={() => setFiltersOpen(true)}>
              <SlidersHorizontal />
              Filters
              {nFilters > 0 && (
                <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{nFilters}</span>
              )}
            </Button>
          </div>
          {listed.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No players match these filters.</p>
          ) : (
            <ul className="rounded-xl bg-card shadow-card">
              {listed.map((p) => {
                const isIn = selectedIds.includes(p.id);
                const reason = isIn ? null : cannotAddReason(p, selected, rules);
                return (
                  <PlayerRow
                    key={p.id}
                    player={p}
                    highlight={isIn}
                    reason={reason}
                    action={
                      <RoundButton
                        added={isIn}
                        disabled={!isIn && Boolean(reason)}
                        name={p.displayName}
                        onClick={() => (isIn ? remove(p.id) : add(p))}
                      />
                    }
                  />
                );
              })}
            </ul>
          )}
        </section>
      )}

      {serverError && <InlineError title="Team not saved" message={serverError} />}

      <BudgetBar
        leftTenths={left}
        progress={<SquadProgress counts={counts} rules={rules} />}
        reason={
          blocking.length > 0
            ? blocking[0].message
            : remaining > 0
              ? `Pick ${remaining} more player${remaining === 1 ? "" : "s"}`
              : "Squad complete"
        }
        reasonTone={blocking.length > 0 ? "error" : remaining > 0 ? "muted" : "ok"}
        action={
          <Button size="lg" className="h-11 px-5 text-[0.9375rem]" disabled={!complete || saving} onClick={save}>
            {saving ? "Saving…" : "Save team"}
          </Button>
        }
      />

      {/* Picker for an empty slot, already filtered to that position */}
      <Drawer open={pickFor !== null} onOpenChange={(o) => !o && setPickFor(null)}>
        <DrawerContent className="flex max-h-[90dvh] flex-col">
          {pickFor && (
            <>
              <DrawerHeader>
                <DrawerTitle>Add a {POSITION_LABEL[pickFor].toLowerCase()}</DrawerTitle>
                <DrawerDescription>
                  {counts[pickFor]}/{rules.squadPositions[pickFor]} {pickFor} · {formatMoney(left)} left
                </DrawerDescription>
              </DrawerHeader>
              <PlayerPickerList
                key={pickFor}
                players={players.filter((p) => p.position === pickFor && !selectedIds.includes(p.id))}
                position={pickFor}
                reasonFor={(p) => cannotAddReason(p, selected, rules)}
                renderAction={(p, reason) => (
                  <RoundButton
                    added={false}
                    disabled={Boolean(reason)}
                    name={p.displayName}
                    onClick={() => {
                      add(p);
                      setPickFor(null);
                    }}
                  />
                )}
              />
            </>
          )}
        </DrawerContent>
      </Drawer>

      {/* Player sheet */}
      <Drawer open={sheetPlayer !== undefined} onOpenChange={(o) => !o && setSheetFor(null)}>
        <DrawerContent>
          {sheetPlayer && (
            <>
              <DrawerHeader>
                <DrawerTitle className="flex items-center justify-center gap-2">
                  {sheetPlayer.displayName} <StatusFlag status={sheetPlayer.status} />
                </DrawerTitle>
                <DrawerDescription>
                  {POSITION_LABEL[sheetPlayer.position]} · Year {sheetPlayer.teamYear} ·{" "}
                  {formatMoney(sheetPlayer.priceTenths)} · {sheetPlayer.totalPoints} pts · picked by{" "}
                  {sheetPlayer.selectedByPct}%
                </DrawerDescription>
              </DrawerHeader>
              <DrawerFooter>
                <Button
                  variant="destructive"
                  size="lg"
                  className="h-12 text-[0.9375rem]"
                  onClick={() => {
                    remove(sheetPlayer.id);
                    setSheetFor(null);
                  }}
                >
                  Remove from squad
                </Button>
              </DrawerFooter>
            </>
          )}
        </DrawerContent>
      </Drawer>

      {/* Filters sheet (list view) */}
      <Drawer open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Filters</DrawerTitle>
            <DrawerDescription>{listed.length} players</DrawerDescription>
          </DrawerHeader>
          <div className="px-4">
            <FilterControls filters={filters} onChange={setFilters} prices={prices} />
          </div>
          <DrawerFooter className="flex-row">
            <Button
              variant="outline"
              size="lg"
              className="h-12 flex-1"
              onClick={() => setFilters({ ...DEFAULT_FILTERS, search: filters.search })}
            >
              Clear
            </Button>
            <Button size="lg" className="h-12 flex-1" onClick={() => setFiltersOpen(false)}>
              Show {listed.length} players
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

/** Round + / ✓ button with a 44 px target. */
export function RoundButton({
  added,
  disabled,
  name,
  onClick,
}: {
  added: boolean;
  disabled: boolean;
  name: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="icon-lg"
      variant={added ? "default" : "outline"}
      className="size-11 shrink-0 rounded-full"
      disabled={disabled}
      onClick={onClick}
      aria-label={added ? `Remove ${name}` : `Add ${name}`}
    >
      {added ? <Check /> : <Plus />}
    </Button>
  );
}

