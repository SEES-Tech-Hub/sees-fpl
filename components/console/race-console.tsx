"use client";

import { ConsoleGuide, ConsoleHelpButton } from "./console-help";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ListOrdered, Plus, Send, Trash2, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { teamColour } from "@/lib/design/team-colour";
import { fillRaceFinal, recordRaceResults, setRaceEntries } from "@/lib/live/actions";
import type { ActionResult, LiveFixture, RaceOutcome, RaceResultInput, RaceResultRow, TeamSummary } from "@/lib/live/types";
import { cn, formatWAT } from "@/lib/utils";
import { HolderBar, type ConsoleViewer } from "./console-app";
import { notify } from "./notify";

// The console for races (athletics and swimming). Two steps:
//   1. Entrants: who runs, with their year, name (blank for a relay) and lane.
//   2. Results: each entrant's place and time, or DNF, DNS or DQ. Save keeps
//      them private; Publish makes the race final and public (every entrant
//      needs a result). Officials can't change a published race; the admin can.
// The admin can also fill a final from its heats (the top finishers of each).
// Races are entered after they finish, so this works online only.

type EntrantDraft = { key: string; teamId: string; athleteName: string; lane: string };
type ResultDraft = { outcome: RaceOutcome; position: string; time: string };

const OUTCOMES: { value: RaceOutcome; label: string }[] = [
  { value: "finished", label: "Finished" },
  { value: "dnf", label: "DNF" },
  { value: "dns", label: "DNS" },
  { value: "dq", label: "DQ" },
];

const stageName = (stage: string) => (stage.startsWith("heat_") ? `Heat ${stage.slice(5)}` : stage === "final" ? "Final" : stage.replace(/_/g, " "));

/** "12.34" or "1:02.34" → milliseconds; empty → null; nonsense → NaN. */
export function parseTime(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  const m = /^(?:(\d+):)?(\d+(?:\.\d{1,3})?)$/.exec(t);
  if (!m) return Number.NaN;
  const minutes = m[1] ? Number(m[1]) : 0;
  return Math.round((minutes * 60 + Number(m[2])) * 1000);
}

function formatTime(ms: number | null): string {
  if (ms === null) return "";
  const total = ms / 1000;
  const min = Math.floor(total / 60);
  const sec = total - min * 60;
  return min > 0 ? `${min}:${sec.toFixed(2).padStart(5, "0")}` : sec.toFixed(2);
}

const entrantKey = (teamId: string, athleteName: string | null) => `${teamId}|${(athleteName ?? "").trim().toLowerCase()}`;

export function RaceConsole({
  fixture,
  entries,
  teams,
  hasHeats,
  viewer,
}: {
  fixture: LiveFixture;
  entries: RaceResultRow[];
  teams: TeamSummary[];
  hasHeats: boolean;
  viewer: ConsoleViewer;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const published = fixture.status === "full_time";
  const canEdit = viewer.canRecord && (!published || viewer.isAdmin);
  const hasResults = entries.some((e) => e.outcome !== null);

  const [drafts, setDrafts] = useState<EntrantDraft[]>(() =>
    entries.length > 0
      ? entries.map((e) => ({ key: String(e.entryId), teamId: e.team.id, athleteName: e.athleteName ?? "", lane: e.lane ? String(e.lane) : "" }))
      : [],
  );
  const [results, setResults] = useState<Record<string, ResultDraft>>(() =>
    Object.fromEntries(
      entries.map((e) => [
        entrantKey(e.team.id, e.athleteName),
        { outcome: e.outcome ?? "finished", position: e.position ? String(e.position) : "", time: formatTime(e.timeMs) },
      ]),
    ),
  );

  const teamById = new Map(teams.map((t) => [t.id, t]));

  function run<T>(action: () => Promise<ActionResult<T>>, success: string) {
    startTransition(async () => {
      try {
        const r = await action();
        if (!r.ok) {
          notify.error(r.error.message);
          return;
        }
        notify.success(success);
        router.refresh();
      } catch {
        notify.error("No connection. Try again when you're back online.");
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Step 1: entrants
  // ---------------------------------------------------------------------------
  const addEntrant = () =>
    setDrafts((d) => [...d, { key: crypto.randomUUID(), teamId: teams[d.length % teams.length]?.id ?? "", athleteName: "", lane: "" }]);
  const update = (key: string, patch: Partial<EntrantDraft>) => setDrafts((d) => d.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const remove = (key: string) => setDrafts((d) => d.filter((x) => x.key !== key));

  const saveEntrants = () => {
    const list = drafts.filter((d) => d.teamId);
    if (list.length === 0) {
      notify.error("Add at least one entrant.");
      return;
    }
    run(
      () =>
        setRaceEntries({
          fixtureId: fixture.id,
          entries: list.map((d) => ({
            teamId: d.teamId,
            athleteName: d.athleteName.trim() || null,
            lane: d.lane ? Number(d.lane) : null,
          })),
        }),
      `${list.length} ${list.length === 1 ? "entrant" : "entrants"} saved`,
    );
  };

  // ---------------------------------------------------------------------------
  // Step 2: results (for the saved entrants)
  // ---------------------------------------------------------------------------
  const resultFor = (e: RaceResultRow): ResultDraft =>
    results[entrantKey(e.team.id, e.athleteName)] ?? { outcome: "finished", position: "", time: "" };
  const setResult = (e: RaceResultRow, patch: Partial<ResultDraft>) =>
    setResults((r) => ({ ...r, [entrantKey(e.team.id, e.athleteName)]: { ...resultFor(e), ...patch } }));

  const saveResults = (publish: boolean) => {
    const payload: RaceResultInput[] = [];
    for (const e of entries) {
      const r = resultFor(e);
      const timeMs = parseTime(r.time);
      if (Number.isNaN(timeMs)) {
        notify.error(`Check the time for ${e.athleteName ?? e.team.name}: use 12.34 or 1:02.34.`);
        return;
      }
      const position = r.position ? Number(r.position) : null;
      if (publish && r.outcome === "finished" && !position) {
        notify.error(`Give ${e.athleteName ?? e.team.name} a place, or mark them DNF, DNS or DQ.`);
        return;
      }
      payload.push({
        teamId: e.team.id,
        athleteName: e.athleteName,
        outcome: r.outcome,
        position: r.outcome === "finished" ? position : null,
        timeMs: r.outcome === "finished" ? timeMs : null,
      });
    }
    run(() => recordRaceResults({ fixtureId: fixture.id, results: payload, publish }), publish ? "Results published" : "Results saved (not public yet)");
  };

  const sortedEntries = [...entries].sort((a, b) => (a.lane ?? 99) - (b.lane ?? 99) || a.team.year - b.team.year);

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 pt-4 pb-16">
      <header className="relative flex flex-col items-center gap-1 px-10 text-center">
        <ConsoleHelpButton kind="race" className="absolute top-0 right-0" />
        <p className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">
          {fixture.sport.name} · {stageName(fixture.stage)}
        </p>
        <h1 className="font-heading text-3xl font-bold text-brand">{fixture.event.name}</h1>
        <p className="text-sm text-muted-foreground">
          {fixture.kickoffAt ? formatWAT(fixture.kickoffAt, "datetime") : "Time to be confirmed"}
          {fixture.venue ? ` · ${fixture.venue}` : ""}
        </p>
        <span
          className={cn(
            "mt-1 rounded-full px-3 py-0.5 text-xs font-bold",
            published ? "bg-secondary text-brand" : hasResults ? "bg-highlight/30" : "bg-muted text-muted-foreground",
          )}
        >
          {published ? "Results published" : hasResults ? "Results saved, not public yet" : "No results yet"}
        </span>
      </header>

      <HolderBar viewer={viewer} fixtureId={fixture.id} waiting={0} onTaken={() => router.refresh()} />
      <ConsoleGuide kind="race" show={viewer.canRecord || viewer.canTake} />

      {viewer.isAdmin && hasHeats && fixture.stage === "final" && !hasResults && (
        <Button
          variant="secondary"
          className="gap-2"
          disabled={pending}
          onClick={() => run(() => fillRaceFinal(fixture.event.id, fixture.id), "Final filled from the heats")}
        >
          <Trophy className="size-4" aria-hidden /> Fill the final from the heats
        </Button>
      )}

      {/* Step 1 */}
      <section className="flex flex-col gap-2 rounded-xl bg-card p-3 shadow-card" aria-labelledby="entrants">
        <h2 id="entrants" className="flex items-center gap-2 font-heading text-lg font-bold">
          <Users className="size-5 text-brand" aria-hidden /> 1. Entrants
        </h2>
        {canEdit && !hasResults ? (
          <>
            {drafts.length === 0 && <p className="text-sm text-muted-foreground">Add everyone in this race. Leave the name blank for a relay team.</p>}
            <ul className="flex flex-col gap-2">
              {drafts.map((d) => (
                <li key={d.key} className="grid grid-cols-[6.5rem_1fr_3.5rem_auto] items-center gap-2">
                  <Select value={d.teamId} onValueChange={(v) => update(d.key, { teamId: v })}>
                    <SelectTrigger aria-label="Year" className="h-11 w-full">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input className="h-11" placeholder="Name (blank for relay)" value={d.athleteName} maxLength={80} onChange={(e) => update(d.key, { athleteName: e.target.value })} />
                  <Input className="h-11" inputMode="numeric" placeholder="Lane" value={d.lane} onChange={(e) => update(d.key, { lane: e.target.value.replace(/\D/g, "").slice(0, 2) })} />
                  <Button variant="ghost" size="icon" aria-label="Remove" onClick={() => remove(d.key)}>
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 gap-2" onClick={addEntrant}>
                <Plus className="size-4" aria-hidden /> Add entrant
              </Button>
              <Button className="flex-1 gap-2" disabled={pending || drafts.length === 0} onClick={saveEntrants}>
                <Check className="size-4" aria-hidden /> Save entrants
              </Button>
            </div>
          </>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No entrants yet.</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {sortedEntries.map((e) => (
              <li key={e.entryId} className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-sm">
                <span className="size-2.5 rounded-full" style={{ background: teamColour(e.team.year) }} aria-hidden />
                {e.athleteName ?? `${e.team.name} relay`}
                {e.lane ? <span className="text-xs text-muted-foreground">lane {e.lane}</span> : null}
              </li>
            ))}
          </ul>
        )}
        {hasResults && canEdit && !published && (
          <p className="text-xs text-muted-foreground">Results are in, so the entrants are locked. Ask the admin to change them.</p>
        )}
      </section>

      {/* Step 2 */}
      {entries.length > 0 && (
        <section className="flex flex-col gap-2 rounded-xl bg-card p-3 shadow-card" aria-labelledby="results">
          <h2 id="results" className="flex items-center gap-2 font-heading text-lg font-bold">
            <ListOrdered className="size-5 text-brand" aria-hidden /> 2. Results
          </h2>
          <ul className="flex flex-col divide-y divide-border">
            {sortedEntries.map((e) => {
              const r = resultFor(e);
              const team = teamById.get(e.team.id) ?? e.team;
              return (
                <li key={e.entryId} className="flex flex-col gap-2 py-2.5">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <span className="size-3 rounded-full" style={{ background: teamColour(team.year) }} aria-hidden />
                    {e.athleteName ?? `${team.name} relay`}
                    <span className="text-xs font-normal text-muted-foreground">{team.name}</span>
                  </p>
                  <div className="grid grid-cols-[1fr_4rem_6rem] gap-2">
                    <Select value={r.outcome} disabled={!canEdit} onValueChange={(v) => setResult(e, { outcome: v as RaceOutcome })}>
                      <SelectTrigger aria-label="Outcome" className="h-11 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OUTCOMES.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      className="h-11"
                      inputMode="numeric"
                      aria-label="Place"
                      placeholder="Place"
                      disabled={!canEdit || r.outcome !== "finished"}
                      value={r.position}
                      onChange={(ev) => setResult(e, { position: ev.target.value.replace(/\D/g, "").slice(0, 2) })}
                    />
                    <Input
                      className="h-11"
                      inputMode="decimal"
                      aria-label="Time"
                      placeholder="12.34"
                      disabled={!canEdit || r.outcome !== "finished"}
                      value={r.time}
                      onChange={(ev) => setResult(e, { time: ev.target.value })}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          {canEdit && (
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" disabled={pending} onClick={() => saveResults(false)}>
                Save
              </Button>
              <Button className="flex-1 gap-2" disabled={pending} onClick={() => saveResults(true)}>
                <Send className="size-4" aria-hidden /> Publish
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">Times as 12.34 or 1:02.34. Equal places can share a number.</p>
        </section>
      )}
    </div>
  );
}
