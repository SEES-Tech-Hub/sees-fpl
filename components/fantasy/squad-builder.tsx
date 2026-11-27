"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Check, Pencil, Plus, SlidersHorizontal } from "lucide-react";
import { createTeamAndSquadAction, saveSquadAction } from "@/app/fantasy/actions";
import { BrandLoader } from "@/components/brand/brand-loader";
import { useSaveCelebration } from "@/components/brand/save-celebration";
import { BudgetBar, SquadProgress } from "@/components/fantasy/budget-bar";
import { AnimatedPlayerRow, chipMotion, SlidingTabs } from "@/components/fantasy/motion-bits";
import { BenchTray, Pitch, PitchRow } from "@/components/fantasy/pitch";
import { StatusFlag } from "@/components/fantasy/player-bits";
import { EmptyChip, PlayerChip } from "@/components/fantasy/player-chip";
import {
  activeFilterCount,
  applyFilters,
  DEFAULT_FILTERS,
  FilterControls,
  PlayerPickerList,
  type Filters,
} from "@/components/fantasy/player-picker";
import { InlineError, PageHeader } from "@/components/fantasy/states";
import { TeamDot } from "@/components/fantasy/team-badge";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Field, FieldDescription, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useHydrated, useLocalStorageState } from "@/hooks/use-local-storage-state";
import { ERROR_COPY } from "@/lib/fantasy/errors";
import { formatMoney, POSITION_LABEL, POSITION_PLURAL } from "@/lib/fantasy/format";
import type { FantasyErrorCode, FantasyRules, Player, Position } from "@/lib/fantasy/types";
import { cannotAddReason, countByPosition, squadCost, squadIssues } from "@/lib/fantasy/validate";
import { cn } from "@/lib/utils";

// Pitch rows from the top (design system §11.3): FWD, MID, DEF, GK.
const PITCH_ORDER: Position[] = ["FWD", "MID", "DEF", "GK"];
const BENCH_POSITIONS: Position[] = ["GK", "DEF", "MID", "FWD"];

const YEARS = [
  { value: "1", label: "Year 1", sub: "SEES 31" },
  { value: "2", label: "Year 2", sub: "SEES 30" },
  { value: "3", label: "Year 3", sub: "SEES 29" },
  { value: "4", label: "Year 4", sub: "SEES 28" },
  { value: "5", label: "Year 5", sub: "SEES 26" },
  { value: "none", label: "Not in a year team", sub: "Staff, alumni, guests" },
];

// Picked from at random while a squad saves; usually only one or two show.
const SAVING_LINES = [
  "Lacing up the boots…",
  "Checking the budget with the treasurer…",
  "Handing out the captain's armband…",
  "Saving your wonderful XI…",
  "Pumping up the match ball…",
  "Chalking the touchlines…",
  "Printing the team sheet…",
  "Ironing the kits…",
  "Briefing the bench…",
  "Checking VAR, just in case…",
  "Warming up on the touchline…",
  "Polishing the trophy cabinet…",
];

// Errors about the team itself send the manager back to step 1.
const TEAM_ERRORS: FantasyErrorCode[] = ["TEAM_NAME_INVALID", "YEAR_GROUP_INVALID"];

type TeamDraft = { name: string; year: string; confirmed: boolean };
type View = "pitch" | "list";

const step = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -24 },
  transition: { duration: 0.22, ease: [0.2, 0.8, 0.2, 1] as const },
};

/**
 * The squad builder. For a new manager it starts with "Name your team" and
 * saves the team and the squad together at the end, so the only wait is the
 * final save. Picks, the team name, the view and the filters are kept in
 * this browser, so a reload carries on where it left off.
 */
export function SquadBuilder({
  players,
  rules,
  userId,
  matchdayNumber,
  caption,
  newTeam: newTeamProp,
}: {
  players: Player[];
  rules: FantasyRules;
  userId: string;
  matchdayNumber: number;
  caption?: ReactNode;
  /** Set when the manager has no team yet: who they are and their year. */
  newTeam: { managerName: string; defaultYear: number | null } | null;
}) {
  // Treat a missing prop like null (an open page can keep old props across a hot reload).
  const newTeam = newTeamProp ?? null;
  const router = useRouter();
  const key = (name: string) => `sees-fantasy:${userId}:${name}`;
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const [team, setTeam, clearTeam] = useLocalStorageState<TeamDraft>(newTeam ? key("team") : null, {
    name: "",
    year: newTeam?.defaultYear ? String(newTeam.defaultYear) : "",
    confirmed: false,
  });
  // One draft per matchday, so an old draft never comes back after a deadline.
  const [selectedIds, setSelectedIds, clearDraft] = useLocalStorageState<string[]>(
    key(`squad-draft:md${matchdayNumber}`),
    [],
    { validate: (ids) => ids.filter((id) => byId.has(id)) },
  );
  const [view, setView] = useLocalStorageState<View>(key("builder-view"), "pitch");
  const [savedFilters, setSavedFilters] = useLocalStorageState<Filters>(key("builder-filters"), DEFAULT_FILTERS);
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [pickFor, setPickFor] = useState<Position | null>(null);
  const [sheetFor, setSheetFor] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const { run, overlay, busy } = useSaveCelebration();

  // The draft lives in this browser, so wait for it rather than flash an empty builder.
  const hydrated = useHydrated();

  const filters = { ...savedFilters, search };
  const setFilters = (f: Filters) => {
    setSavedFilters({ ...f, search: "" });
    setSearch(f.search);
  };

  const onTeamStep = newTeam !== null && !team.confirmed;
  const selected = selectedIds.map((id) => byId.get(id)).filter((p): p is Player => Boolean(p));
  const counts = countByPosition(selected);
  const left = rules.budgetTenths - squadCost(selected);
  const blocking = squadIssues(selected, rules).filter((i) => i.blocking);
  const complete = selected.length === rules.squadSize && blocking.length === 0;
  const remaining = rules.squadSize - selected.length;
  const prices = useMemo(() => [...new Set(players.map((p) => p.priceTenths))].sort((a, b) => a - b), [players]);

  const update = (ids: string[]) => {
    setSelectedIds(ids);
    setServerError(null);
  };
  const add = (p: Player) => {
    if (!cannotAddReason(p, selected, rules)) update([...selectedIds, p.id]);
  };
  const remove = (id: string) => update(selectedIds.filter((x) => x !== id));

  async function save() {
    setServerError(null);
    const teamName = team.name.trim();
    try {
      const result = await run(
        () =>
          newTeam
            ? createTeamAndSquadAction({
                teamName,
                yearGroup: team.year === "none" ? null : Number(team.year),
                playerIds: selectedIds,
              })
            : saveSquadAction(selectedIds),
        {
          lines: SAVING_LINES,
          done: {
            title: "Your XI is in!",
            subtitle: newTeam ? `${teamName} is ready for Matchday ${matchdayNumber}` : `Ready for Matchday ${matchdayNumber}`,
          },
          onSuccess: () => {
            clearDraft();
            clearTeam();
            // The team page opens "Share your amazing XI" once (?share=1).
            router.push("/fantasy/team?share=1");
          },
        },
      );
      if (!result.ok) {
        setServerError(`${result.error.message} Fix it and save again.`);
        if (TEAM_ERRORS.includes(result.error.code)) setTeam({ ...team, confirmed: false });
      }
    } catch {
      setServerError(ERROR_COPY.UNKNOWN);
    }
  }

  // On the pitch: all but one of each position; the last of each sits on the bench (GK first).
  const onPitch = (pos: Position) => rules.squadPositions[pos] - 1;
  const ofPos = (pos: Position) => selected.filter((p) => p.position === pos);
  const chipFor = (p: Player) => (
    <motion.div key={p.id} {...chipMotion}>
      <PlayerChip player={p} tag={formatMoney(p.priceTenths)} selected={sheetFor === p.id} onClick={() => setSheetFor(p.id)} />
    </motion.div>
  );
  const emptyFor = (pos: Position, i: number) => (
    <motion.div key={`empty-${pos}-${i}`} {...chipMotion}>
      <EmptyChip position={pos} onClick={() => setPickFor(pos)} />
    </motion.div>
  );
  const sheetPlayer = sheetFor ? byId.get(sheetFor) : undefined;
  const listed = applyFilters(players, filters);
  const nFilters = activeFilterCount(filters);

  if (!hydrated) return <BrandLoader />;

  return (
    <>
      <PageHeader
        display
        title={onTeamStep ? "Name your team" : "Pick your squad"}
        caption={
          newTeam ? (
            <>
              Step {onTeamStep ? 1 : 2} of 2{caption ? <> · {caption}</> : null}
            </>
          ) : (
            caption
          )
        }
        description={
          onTeamStep
            ? `Then pick ${rules.squadSize} players within ${formatMoney(rules.budgetTenths)}. Nothing is saved until you save your squad.`
            : `Pick ${rules.squadSize} players within ${formatMoney(rules.budgetTenths)}. At most ${rules.maxPerTeam} from one year.`
        }
      />

      <AnimatePresence mode="wait" initial={false}>
        {onTeamStep && newTeam ? (
          <motion.div key="team" {...step}>
            <TeamStep
              managerName={newTeam.managerName}
              draft={team}
              maxLength={rules.teamNameMaxLength}
              error={serverError}
              onChange={(d) => setTeam(d)}
              onNext={() => {
                setServerError(null);
                setTeam({ ...team, name: team.name.trim().replace(/\s+/g, " "), confirmed: true });
              }}
            />
          </motion.div>
        ) : (
          <motion.div key="squad" {...step} className="flex flex-col gap-4 pb-36">
            {newTeam && (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-secondary px-3 py-2">
                <span className="flex min-w-0 items-center gap-2">
                  {team.year !== "none" && team.year !== "" && <TeamDot year={Number(team.year)} />}
                  <span className="truncate font-heading text-lg font-semibold text-brand">{team.name}</span>
                </span>
                <Button variant="ghost" size="sm" className="h-9 gap-1.5" onClick={() => setTeam({ ...team, confirmed: false })}>
                  <Pencil /> Edit
                </Button>
              </div>
            )}

            <SlidingTabs
              label="View"
              value={view}
              onValueChange={setView}
              items={[
                { value: "pitch", label: "Pitch" },
                { value: "list", label: "List" },
              ]}
            />

            <AnimatePresence mode="wait" initial={false}>
              {view === "pitch" ? (
                <motion.div
                  key="pitch"
                  className="flex flex-col gap-4"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
                  transition={{ duration: 0.2 }}
                >
                  <Pitch>
                    {PITCH_ORDER.map((pos) => {
                      const list = ofPos(pos).slice(0, onPitch(pos));
                      const empty = onPitch(pos) - list.length;
                      return (
                        <PitchRow key={pos} count={onPitch(pos)} label={POSITION_PLURAL[pos]}>
                          <AnimatePresence initial={false} mode="popLayout">
                            {list.map(chipFor)}
                            {Array.from({ length: empty }, (_, i) => emptyFor(pos, list.length + i))}
                          </AnimatePresence>
                        </PitchRow>
                      );
                    })}
                  </Pitch>
                  <BenchTray
                    items={BENCH_POSITIONS.map((pos) => {
                      const p = ofPos(pos)[onPitch(pos)];
                      return {
                        key: pos,
                        node: (
                          <AnimatePresence initial={false} mode="popLayout">
                            {p ? (
                              chipFor(p)
                            ) : (
                              <span key="empty" className="text-muted-foreground [&_button]:text-muted-foreground">
                                {emptyFor(pos, 0)}
                              </span>
                            )}
                          </AnimatePresence>
                        ),
                      };
                    })}
                  />
                </motion.div>
              ) : (
                <motion.section
                  key="list"
                  aria-label="Players"
                  className="flex flex-col gap-3"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
                  transition={{ duration: 0.2 }}
                >
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
                      <AnimatePresence>
                        {nFilters > 0 && (
                          <motion.span
                            key={nFilters}
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.5, opacity: 0 }}
                            className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground"
                          >
                            {nFilters}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </Button>
                  </div>
                  <ul className="overflow-hidden rounded-xl bg-card shadow-card">
                    <AnimatePresence initial={false} mode="popLayout">
                      {listed.length === 0 && (
                        <motion.li
                          key="none"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="py-8 text-center text-sm text-muted-foreground"
                        >
                          No players match these filters.
                        </motion.li>
                      )}
                      {listed.map((p, i) => {
                        const isIn = selectedIds.includes(p.id);
                        const reason = isIn ? null : cannotAddReason(p, selected, rules);
                        return (
                          <AnimatedPlayerRow
                            key={p.id}
                            index={i}
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
                    </AnimatePresence>
                  </ul>
                </motion.section>
              )}
            </AnimatePresence>

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
                <Button size="lg" className="h-11 px-5 text-[0.9375rem]" disabled={!complete || busy} onClick={save}>
                  Save team
                </Button>
              }
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Picker for an empty slot, already filtered to that position */}
      <Drawer open={pickFor !== null} onOpenChange={(o) => !o && setPickFor(null)}>
        <DrawerContent className="flex flex-col data-[vaul-drawer-direction=bottom]:max-h-[90dvh]">
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
                storageKey={key("picker-filters")}
                players={players.filter((p) => p.position === pickFor && !selectedIds.includes(p.id))}
                position={pickFor}
                reasonFor={(p) => cannotAddReason(p, selected, rules)}
                verb="Add"
                onChoose={(p) => {
                  add(p);
                  setPickFor(null);
                }}
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
                <DrawerTitle className="flex items-center justify-center gap-2 group-data-[vaul-drawer-direction=right]/drawer-content:justify-start">
                  {sheetPlayer.displayName} <StatusFlag status={sheetPlayer.status} />
                </DrawerTitle>
                <DrawerDescription>
                  {POSITION_LABEL[sheetPlayer.position]} · Year {sheetPlayer.teamYear} · {formatMoney(sheetPlayer.priceTenths)} ·{" "}
                  {sheetPlayer.totalPoints} pts · picked by {sheetPlayer.selectedByPct}%
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

      {overlay}
    </>
  );
}

/** Step 1 for a new manager: team name and year. Nothing is sent to the server yet. */
function TeamStep({
  managerName,
  draft,
  maxLength,
  error,
  onChange,
  onNext,
}: {
  managerName: string;
  draft: TeamDraft;
  maxLength: number;
  error: string | null;
  onChange: (d: TeamDraft) => void;
  onNext: () => void;
}) {
  const [touched, setTouched] = useState(false);
  const name = draft.name.trim();
  const nameProblem = name.length < 3 ? "Team names need at least 3 characters." : null;
  const yearProblem = draft.year === "" ? "Pick your year, or “Not in a year team”." : null;

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (!nameProblem && !yearProblem) onNext();
      }}
    >
      <p className="text-sm">
        Signed in as <span className="font-medium">{managerName}</span>
      </p>

      <Field data-invalid={touched && Boolean(nameProblem)}>
        <FieldLabel htmlFor="teamName">Team name</FieldLabel>
        <Input
          id="teamName"
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
          maxLength={maxLength}
          autoComplete="off"
          autoFocus
          placeholder="e.g. Ohm's Rangers"
          aria-invalid={touched && Boolean(nameProblem)}
          className="h-11 text-base"
        />
        <FieldDescription>3 to {maxLength} characters. Everyone sees it in the rankings.</FieldDescription>
        {touched && nameProblem && <FieldError>{nameProblem}</FieldError>}
      </Field>

      <FieldSet>
        <FieldLegend>Your year</FieldLegend>
        <FieldDescription>Used for the year rankings.</FieldDescription>
        <div className="grid grid-cols-2 gap-2">
          {YEARS.map((y) => (
            <motion.label
              key={y.value}
              whileTap={{ scale: 0.97 }}
              className={cn(
                "flex min-h-16 cursor-pointer flex-col justify-center gap-0.5 rounded-lg border-2 border-border px-3 py-2 transition-colors duration-200 has-checked:border-primary has-checked:bg-secondary has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                y.value === "none" && "col-span-2",
              )}
            >
              <input
                type="radio"
                name="yearGroup"
                value={y.value}
                checked={draft.year === y.value}
                onChange={() => onChange({ ...draft, year: y.value })}
                className="sr-only"
              />
              <span className="flex items-center gap-2">
                {y.value !== "none" && <TeamDot year={Number(y.value)} />}
                <span className="text-[0.9375rem] font-semibold">{y.label}</span>
              </span>
              <span className="text-[0.8125rem] text-muted-foreground">{y.sub}</span>
            </motion.label>
          ))}
        </div>
        {touched && yearProblem && <FieldError>{yearProblem}</FieldError>}
      </FieldSet>

      {error && <InlineError title="Team not saved" message={error} />}

      <Button type="submit" size="lg" className="h-12 text-base">
        Next: pick your squad
      </Button>
    </form>
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
      className="size-11 shrink-0 rounded-full transition-colors duration-200"
      disabled={disabled}
      onClick={onClick}
      aria-label={added ? `Remove ${name}` : `Add ${name}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={added ? "added" : "add"}
          initial={{ scale: 0.4, rotate: -45, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          exit={{ scale: 0.4, rotate: 45, opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="flex"
        >
          {added ? <Check /> : <Plus />}
        </motion.span>
      </AnimatePresence>
    </Button>
  );
}
