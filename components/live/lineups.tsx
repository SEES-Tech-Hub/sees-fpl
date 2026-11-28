"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { ArrowDown, ArrowUp, Star } from "lucide-react";
import { EmptyState } from "@/components/brand/empty-state";
import { SlidingTabs } from "@/components/fantasy/motion-bits";
import { Pitch } from "@/components/fantasy/pitch";
import { PlayerFace } from "@/components/fantasy/player-face";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { teamColour } from "@/lib/design/team-colour";
import { playerPhotoUrl } from "@/lib/fantasy/player-photos";
import type { LineupPlayer, TeamSummary, TimelineEntry } from "@/lib/live/types";
import { cn } from "@/lib/utils";

// The match page's team sheets (concepts A, C and D on the lineups board):
// - Tabs for the two teams.
// - Football: the starting XI on a pitch in its formation (forwards at the
//   top), each face with its year tag and what the player has done so far
//   (goal, assist, card, subbed off with the minute); the bench is a dugout
//   underneath, with who came on and when.
// - Other sports: the same players as a list, with the events as chips.
// - Tap anyone: a sheet with that player's match so far.
// Everything comes from the match timeline, so it updates live.

type Kind = "goal" | "own_goal" | "assist" | "yellow" | "red" | "off" | "on" | "motm" | "pen_miss";
type PlayerEvent = { kind: Kind; minute: string; text: string };

const ORDER = { GK: 0, DEF: 1, MID: 2, FWD: 3 } as const;
const LINES = ["FWD", "MID", "DEF", "GK"] as const;
const LINE_LABEL = { FWD: "Forwards", MID: "Midfielders", DEF: "Defenders", GK: "Goalkeeper" } as const;
const POSITION = { GK: "Goalkeeper", DEF: "Defender", MID: "Midfielder", FWD: "Forward" } as const;

const minuteOf = (e: TimelineEntry) => (e.minute === null ? "" : `${e.minute}${e.addedMinutes ? `+${e.addedMinutes}` : ""}'`);

/** Every player's events, in match order. */
export function eventsByPlayer(timeline: TimelineEntry[]) {
  const map = new Map<string, PlayerEvent[]>();
  const add = (id: string | null, ev: PlayerEvent) => {
    if (!id) return;
    map.set(id, [...(map.get(id) ?? []), ev]);
  };
  for (const e of timeline) {
    const m = minuteOf(e);
    if (e.type === "goal") {
      if (e.isOwnGoal) add(e.playerId, { kind: "own_goal", minute: m, text: "Own goal" });
      else {
        add(e.playerId, { kind: "goal", minute: m, text: `${e.isPenalty ? "Penalty goal" : "Goal"}${e.otherPlayerName ? ` · assisted by ${e.otherPlayerName}` : ""}` });
        add(e.otherPlayerId, { kind: "assist", minute: m, text: `Assist${e.playerName ? ` for ${e.playerName}` : ""}` });
      }
    } else if (e.type === "card") {
      add(e.playerId, e.card === "red" ? { kind: "red", minute: m, text: "Red card" } : { kind: "yellow", minute: m, text: "Yellow card" });
    } else if (e.type === "substitution") {
      add(e.playerId, { kind: "off", minute: m, text: `Subbed off${e.otherPlayerName ? ` for ${e.otherPlayerName}` : ""}` });
      add(e.otherPlayerId, { kind: "on", minute: m, text: `Came on${e.playerName ? ` for ${e.playerName}` : ""}` });
    } else if (e.type === "penalty_miss") {
      add(e.playerId, { kind: "pen_miss", minute: m, text: e.otherPlayerName ? `Penalty saved by ${e.otherPlayerName}` : "Missed a penalty" });
    } else if (e.type === "man_of_the_match") {
      add(e.playerId, { kind: "motm", minute: "", text: "Player of the match" });
    }
  }
  return map;
}

const count = (evs: PlayerEvent[], ...kinds: Kind[]) => evs.filter((e) => kinds.includes(e.kind)).length;

export function Lineups({
  players,
  timeline,
  home,
  away,
  pitch,
}: {
  players: LineupPlayer[];
  timeline: TimelineEntry[];
  home: TeamSummary | null;
  away: TeamSummary | null;
  /** Football: show the starters on a pitch. */
  pitch: boolean;
}) {
  const teams = [home, away].filter((t): t is TeamSummary => t !== null);
  const [tab, setTab] = useState<string>(teams[0]?.id ?? "");
  const [shown, setShown] = useState<LineupPlayer | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const events = useMemo(() => eventsByPlayer(timeline), [timeline]);

  if (players.length === 0 || teams.length === 0) {
    return (
      <EmptyState
        art="board"
        title="Team sheets not in yet"
        description="The officials set both lineups before kickoff. Check back then to see who starts."
      />
    );
  }

  const team = teams.find((t) => t.id === tab) ?? teams[0];
  const open = (p: LineupPlayer) => {
    setShown(p);
    setSheetOpen(true);
  };
  const yearOf = (p: LineupPlayer) => teams.find((t) => t.id === p.teamId)?.year ?? team.year;

  return (
    <MotionConfig reducedMotion="user">
      {/* Bottom room so the floating reactions button never covers the bench. */}
      <div className="flex flex-col gap-3 pb-20">
        {teams.length > 1 && (
          <SlidingTabs
            label="Team"
            value={team.id}
            onValueChange={setTab}
            className="grid w-full grid-cols-2"
            items={teams.map((t) => ({
              value: t.id,
              label: (
                <span className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ background: teamColour(t.year) }} aria-hidden />
                  {t.name}
                </span>
              ),
            }))}
          />
        )}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={team.id}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <TeamSheet team={team} pitch={pitch} events={events} onOpen={open} players={players.filter((p) => p.teamId === team.id)} />
          </motion.div>
        </AnimatePresence>
        <Legend />
      </div>
      <PlayerSheet
        player={shown}
        year={shown ? yearOf(shown) : team.year}
        events={shown ? (events.get(shown.playerId) ?? []) : []}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </MotionConfig>
  );
}

function TeamSheet({
  team,
  players,
  pitch,
  events,
  onOpen,
}: {
  team: TeamSummary;
  players: LineupPlayer[];
  pitch: boolean;
  events: Map<string, PlayerEvent[]>;
  onOpen: (p: LineupPlayer) => void;
}) {
  const sorted = [...players].sort((a, b) => ORDER[a.position] - ORDER[b.position] || (a.shirtNumber ?? 99) - (b.shirtNumber ?? 99));
  const starters = sorted.filter((p) => p.role === "starter");
  const bench = sorted.filter((p) => p.role === "bench");
  const evs = (p: LineupPlayer) => events.get(p.playerId) ?? [];
  const formation = (["DEF", "MID", "FWD"] as const).map((pos) => starters.filter((p) => p.position === pos).length).filter(Boolean).join("-");

  if (!pitch) {
    return (
      <div className="flex flex-col gap-3">
        {starters.length > 0 && (
          <ListCard title="Starting" aside={`${starters.length} players`}>
            {starters.map((p, i) => (
              <ListRow key={p.playerId} player={p} year={team.year} events={evs(p)} index={i} onOpen={onOpen} />
            ))}
          </ListCard>
        )}
        {bench.length > 0 && (
          <ListCard title="Bench" muted>
            {bench.map((p, i) => (
              <ListRow key={p.playerId} player={p} year={team.year} events={evs(p)} index={starters.length + i} onOpen={onOpen} />
            ))}
          </ListCard>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between px-0.5">
        <span className="font-heading text-2xl font-bold tabular-nums">{formation || "Starting XI"}</span>
        <span className="text-xs text-muted-foreground">Tap a player</span>
      </div>
      {starters.length > 0 && (
        <Pitch className="pt-4 pb-5">
          <div className="relative flex flex-col gap-4">
            {LINES.map((line) => {
              const row = starters.filter((p) => p.position === line);
              if (row.length === 0) return null;
              return (
                <div
                  key={line}
                  role="group"
                  aria-label={LINE_LABEL[line]}
                  className="mx-auto grid w-full max-w-md gap-1"
                  style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))`, maxWidth: `${row.length * 5.5}rem` }}
                >
                  {row.map((p) => (
                    <PitchChip key={p.playerId} player={p} year={team.year} events={evs(p)} index={starters.indexOf(p)} onOpen={onOpen} />
                  ))}
                </div>
              );
            })}
          </div>
        </Pitch>
      )}
      {bench.length > 0 && (
        <section aria-label="Bench" className="rounded-xl bg-pitch px-3 pt-2.5 pb-3 text-brand-foreground lg:mx-auto lg:w-full lg:max-w-xl">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="font-heading text-sm font-semibold tracking-[0.08em] text-brand-light uppercase">Bench</span>
            <span className="text-xs opacity-70">{bench.length} subs</span>
          </div>
          <ul className="-mx-1 flex gap-1 overflow-x-auto px-1 pt-1.5 pb-1 [scrollbar-width:none]">
            {bench.map((p, i) => {
              const e = evs(p);
              const on = e.find((x) => x.kind === "on");
              return (
                <motion.li key={p.playerId} {...pop(starters.length + i)} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => onOpen(p)}
                    className={cn(
                      "flex w-16 flex-col items-center gap-1 rounded-lg py-1 outline-none transition-transform hover:bg-brand-foreground/10 focus-visible:ring-2 focus-visible:ring-brand-light active:scale-95",
                      !p.appeared && "opacity-75",
                    )}
                  >
                    <span className="relative">
                      <Face player={p} year={team.year} size={40} />
                      {on && <MinuteBadge kind="on" minute={on.minute} className="absolute -top-1.5 -right-3" />}
                      <Badges events={e.filter((x) => x.kind !== "on")} className="absolute -top-1.5 -left-2" />
                    </span>
                    <span className="max-w-full truncate text-[0.6875rem] font-semibold">{p.name}</span>
                    <span className="-mt-1 text-[0.625rem] opacity-60">{p.position}</span>
                  </button>
                </motion.li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

const pop = (i: number) => ({
  initial: { opacity: 0, scale: 0.7, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0 },
  transition: { type: "spring" as const, stiffness: 480, damping: 28, delay: Math.min(i, 16) * 0.03 },
});

function Face({ player: p, year, size }: { player: LineupPlayer; year: number; size: number }) {
  return (
    <span className="relative inline-flex">
      <PlayerFace player={{ displayName: p.name, teamYear: year, photoUrl: playerPhotoUrl(p.playerId) }} size={size} badge={false} />
      <span
        aria-hidden
        className="absolute -right-2 -bottom-1 rounded-full px-1 text-[0.5625rem] leading-3.5 font-bold text-highlight-foreground shadow-sm"
        style={{ background: teamColour(year) }}
      >
        Y{year}
      </span>
    </span>
  );
}

function PitchChip({
  player: p,
  year,
  events,
  index,
  onOpen,
}: {
  player: LineupPlayer;
  year: number;
  events: PlayerEvent[];
  index: number;
  onOpen: (p: LineupPlayer) => void;
}) {
  const off = events.find((e) => e.kind === "off");
  const gone = Boolean(off) || p.sentOff;
  return (
    <motion.div {...pop(index)} className="flex min-w-0 justify-center">
      <button
        type="button"
        onClick={() => onOpen(p)}
        aria-label={`${p.name}, ${POSITION[p.position]}`}
        className="flex w-full min-w-0 flex-col items-center gap-1 rounded-lg py-0.5 outline-none transition-transform focus-visible:ring-2 focus-visible:ring-brand-light active:scale-95"
      >
        <span className={cn("relative", gone && "opacity-70")}>
          <Face player={p} year={year} size={48} />
          <Badges events={events.filter((e) => e.kind !== "off")} className="absolute -top-1.5 -right-2.5" />
          {off && <MinuteBadge kind="off" minute={off.minute} className="absolute -top-1.5 -left-3" />}
        </span>
        <span
          className={cn(
            "max-w-full truncate rounded px-1.5 py-0.5 text-[0.6875rem] leading-tight font-semibold shadow-sm",
            gone ? "bg-background/60 text-muted-foreground" : "bg-background text-foreground",
          )}
        >
          {p.name}
        </span>
      </button>
    </motion.div>
  );
}

/** Goal / assist / card / star marks on a face (a number when it happened more than once). */
function Badges({ events, className }: { events: PlayerEvent[]; className?: string }) {
  const goals = count(events, "goal");
  const own = count(events, "own_goal");
  const assists = count(events, "assist");
  const yellow = count(events, "yellow");
  const red = count(events, "red");
  const motm = count(events, "motm");
  if (!goals && !own && !assists && !yellow && !red && !motm) return null;
  return (
    <span className={cn("flex items-center gap-0.5", className)}>
      {goals > 0 && <Dot label={`${goals} goal${goals > 1 ? "s" : ""}`} n={goals} className="bg-background text-foreground"><Ball /></Dot>}
      {own > 0 && <Dot label="Own goal" n={own} className="bg-background text-live"><Ball /></Dot>}
      {assists > 0 && <Dot label={`${assists} assist${assists > 1 ? "s" : ""}`} n={assists} className="bg-brand-light text-brand">A</Dot>}
      {yellow > 0 && !red && <span aria-label="Booked" className="h-3.5 w-2.5 rounded-[2px] bg-highlight shadow-sm" />}
      {red > 0 && <span aria-label="Sent off" className="h-3.5 w-2.5 rounded-[2px] bg-live shadow-sm" />}
      {motm > 0 && <Dot label="Player of the match" className="bg-highlight text-highlight-foreground"><Star className="size-2.5 fill-current" /></Dot>}
    </span>
  );
}

function Dot({ label, n = 1, className, children }: { label: string; n?: number; className?: string; children: React.ReactNode }) {
  return (
    <span aria-label={label} className={cn("flex h-4 min-w-4 items-center justify-center gap-px rounded-full px-0.5 text-[0.5625rem] font-extrabold shadow-sm", className)}>
      {children}
      {n > 1 && <span>{n}</span>}
    </span>
  );
}

function Ball() {
  return (
    <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7l4 3-1.5 5h-5L8 10z" />
    </svg>
  );
}

function MinuteBadge({ kind, minute, className }: { kind: "on" | "off"; minute: string; className?: string }) {
  return (
    <span
      aria-label={kind === "on" ? `Came on ${minute}` : `Subbed off ${minute}`}
      className={cn(
        "flex h-4 items-center gap-px rounded-full bg-background pr-1 pl-0.5 text-[0.5625rem] font-bold shadow-sm tabular-nums",
        kind === "on" ? "text-success" : "text-live",
        className,
      )}
    >
      {kind === "on" ? <ArrowUp className="size-2.5" strokeWidth={3} aria-hidden /> : <ArrowDown className="size-2.5" strokeWidth={3} aria-hidden />}
      {minute}
    </span>
  );
}

function ListCard({ title, aside, muted, children }: { title: string; aside?: string; muted?: boolean; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl bg-card shadow-card">
      <div
        className={cn(
          "flex items-baseline justify-between px-3 py-2",
          muted ? "bg-muted text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase" : "bg-pitch text-brand-foreground",
        )}
      >
        <span className={cn(!muted && "font-heading text-base font-semibold tracking-[0.06em] uppercase")}>{title}</span>
        {aside && <span className="text-xs text-brand-light">{aside}</span>}
      </div>
      <ul>{children}</ul>
    </section>
  );
}

const CHIP: Record<Kind, string> = {
  goal: "bg-muted text-foreground",
  own_goal: "bg-live/15 text-live",
  assist: "bg-brand-light/60 text-brand dark:text-pitch",
  yellow: "bg-highlight/25 text-foreground",
  red: "bg-live/15 text-live",
  off: "bg-live/10 text-live",
  on: "bg-success/15 text-success",
  motm: "bg-highlight/25 text-foreground",
  pen_miss: "bg-muted text-muted-foreground",
};

function EventChip({ e }: { e: PlayerEvent }) {
  return (
    <span className={cn("inline-flex h-5.5 items-center gap-1 rounded-full px-2 text-[0.6875rem] font-bold tabular-nums", CHIP[e.kind])}>
      <EventIcon kind={e.kind} />
      {e.kind === "assist" ? "A " : ""}
      {e.minute}
    </span>
  );
}

function EventIcon({ kind }: { kind: Kind }) {
  if (kind === "goal" || kind === "own_goal" || kind === "pen_miss") return <Ball />;
  if (kind === "yellow") return <span className="h-3 w-2 rounded-[2px] bg-highlight" aria-hidden />;
  if (kind === "red") return <span className="h-3 w-2 rounded-[2px] bg-live" aria-hidden />;
  if (kind === "off") return <ArrowDown className="size-3" strokeWidth={3} aria-hidden />;
  if (kind === "on") return <ArrowUp className="size-3" strokeWidth={3} aria-hidden />;
  if (kind === "motm") return <Star className="size-3 fill-current" aria-hidden />;
  return null;
}

function ListRow({
  player: p,
  year,
  events,
  index,
  onOpen,
}: {
  player: LineupPlayer;
  year: number;
  events: PlayerEvent[];
  index: number;
  onOpen: (p: LineupPlayer) => void;
}) {
  const unused = p.role === "bench" && !p.appeared;
  const off = events.some((e) => e.kind === "off") || p.sentOff;
  return (
    <motion.li
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 420, damping: 32, delay: Math.min(index, 16) * 0.03 }}
      className="border-t border-border first:border-t-0"
    >
      <button
        type="button"
        onClick={() => onOpen(p)}
        className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted active:bg-muted"
      >
        <span className={cn((unused || off) && "opacity-70")}>
          <Face player={p} year={year} size={36} />
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate text-[0.9375rem] font-semibold", (unused || off) && "text-muted-foreground")}>{p.name}</span>
          <span className="block text-xs text-muted-foreground tabular-nums">
            {p.shirtNumber !== null ? `#${p.shirtNumber} · ` : ""}
            {POSITION[p.position]}
          </span>
        </span>
        <span className="flex max-w-[45%] flex-wrap justify-end gap-1">
          {events.map((e, i) => (
            <EventChip key={i} e={e} />
          ))}
        </span>
      </button>
    </motion.li>
  );
}

function Legend() {
  return (
    <p className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 px-0.5 text-xs text-muted-foreground">
      <span className="flex items-center gap-1"><Ball /> Goal</span>
      <span className="flex items-center gap-1">
        <span className="flex size-3.5 items-center justify-center rounded-full bg-brand-light text-[0.5rem] font-extrabold text-brand">A</span> Assist
      </span>
      <span className="flex items-center gap-1"><span className="h-3 w-2 rounded-[2px] bg-highlight" /> Yellow</span>
      <span className="flex items-center gap-1"><span className="h-3 w-2 rounded-[2px] bg-live" /> Red</span>
      <span className="flex items-center gap-1 text-live"><ArrowDown className="size-3" strokeWidth={3} /> Off</span>
      <span className="flex items-center gap-1 text-success"><ArrowUp className="size-3" strokeWidth={3} /> On</span>
    </p>
  );
}

function PlayerSheet({
  player: p,
  year,
  events,
  open,
  onOpenChange,
}: {
  player: LineupPlayer | null;
  year: number;
  events: PlayerEvent[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const goals = count(events, "goal");
  const assists = count(events, "assist");
  const cards = count(events, "yellow", "red");
  const off = events.find((e) => e.kind === "off");
  const on = events.find((e) => e.kind === "on");
  const status = !p
    ? ""
    : p.sentOff
      ? "Sent off"
      : p.role === "starter"
        ? off
          ? `Started · off ${off.minute}`
          : "Started"
        : on
          ? `Came on ${on.minute}`
          : "On the bench";

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-md">
        {p && (
          <>
            <DrawerHeader className="flex-row items-center gap-4 text-left">
              <span className="relative shrink-0">
                <PlayerFace player={{ displayName: p.name, teamYear: year, photoUrl: playerPhotoUrl(p.playerId) }} size={80} badge={false} />
                <span
                  aria-hidden
                  className="absolute -right-2 bottom-0 rounded-full px-1.5 text-xs leading-5 font-bold text-highlight-foreground shadow-sm"
                  style={{ background: teamColour(year) }}
                >
                  Y{year}
                </span>
              </span>
              <span className="min-w-0">
                <DrawerTitle className="truncate font-heading text-3xl font-bold">{p.name}</DrawerTitle>
                <DrawerDescription>
                  {POSITION[p.position]} · Year {year}
                  {p.shirtNumber !== null ? ` · #${p.shirtNumber}` : ""} · {status}
                </DrawerDescription>
              </span>
            </DrawerHeader>
            <div className="flex flex-col gap-4 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
              <div className="grid grid-cols-3 gap-2">
                {[
                  [goals, goals === 1 ? "Goal" : "Goals"],
                  [assists, assists === 1 ? "Assist" : "Assists"],
                  [cards, cards === 1 ? "Card" : "Cards"],
                ].map(([n, label], i) => (
                  <motion.div
                    key={String(label)}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 420, damping: 30, delay: 0.05 + i * 0.04 }}
                    className="rounded-xl bg-muted px-2 py-2.5 text-center"
                  >
                    <span className="block font-heading text-2xl font-bold tabular-nums">{n}</span>
                    <span className="block text-xs text-muted-foreground">{label}</span>
                  </motion.div>
                ))}
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">In this match</p>
                {events.length === 0 ? (
                  <p className="py-3 text-sm text-muted-foreground">Nothing yet.</p>
                ) : (
                  <ul>
                    {events.map((e, i) => (
                      <motion.li
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ type: "spring", stiffness: 420, damping: 32, delay: 0.1 + i * 0.04 }}
                        className="flex min-h-12 items-center gap-3 border-t border-border"
                      >
                        <span className="w-10 font-heading text-base font-bold tabular-nums">{e.minute}</span>
                        <span className={cn("flex size-7 items-center justify-center rounded-full", CHIP[e.kind])}>
                          <EventIcon kind={e.kind} />
                          {e.kind === "assist" && <span className="text-xs font-extrabold">A</span>}
                        </span>
                        <span className="flex-1 text-sm">{e.text}</span>
                      </motion.li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
