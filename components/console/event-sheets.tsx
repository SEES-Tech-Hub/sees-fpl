"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { eligiblePlayers, type Eligibility, type MatchState } from "@/lib/console/match-state";
import type { SquadPlayer } from "@/lib/console/squad";
import type { CardColour, RecordEventInput, TeamSummary } from "@/lib/live/types";
import { Choice, Switch } from "./choice";
import { PlayerPicker } from "./player-picker";

// Owner: Samuel (console). The bottom sheets behind Goal, Card, Sub, Penalty
// and Man of the Match. Each one builds a single event and hands it to
// `record`; the queue does the rest.

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type EventCommand = DistributiveOmit<RecordEventInput, "fixtureId" | "clientEventId" | "occurredAt">;

export type SheetContext = {
  state: MatchState;
  home: TeamSummary;
  away: TeamSummary;
  squads: SquadPlayer[];
  record: (command: EventCommand) => void;
  close: () => void;
};

// Forwards first: they're the likeliest scorers, so the right name is usually on top.
const ATTACK_FIRST = { FWD: 0, MID: 1, DEF: 2, GK: 3 } as const;

function useTeamTools(ctx: SheetContext) {
  const opponentOf = (teamId: string) => (teamId === ctx.home.id ? ctx.away.id : ctx.home.id);
  const teamName = (teamId: string) => (teamId === ctx.home.id ? ctx.home.shortName : ctx.away.shortName);
  const pick = (teamId: string | null, need: Eligibility, exclude: (string | null)[] = []) => {
    if (!teamId) return [];
    const squad = ctx.squads.filter((p) => p.teamId === teamId);
    const ids = new Set(eligiblePlayers(ctx.state, teamId, squad, need));
    return squad
      .filter((p) => ids.has(p.id) && !exclude.includes(p.id))
      .sort((a, b) => ATTACK_FIRST[a.position] - ATTACK_FIRST[b.position] || (a.shirtNumber ?? 99) - (b.shirtNumber ?? 99));
  };
  const teamOptions = [
    { value: ctx.home.id, label: ctx.home.shortName },
    { value: ctx.away.id, label: ctx.away.shortName },
  ];
  return { opponentOf, teamName, pick, teamOptions };
}

function Sheet({
  title,
  description,
  submitLabel,
  canSubmit,
  onSubmit,
  children,
}: {
  title: string;
  description?: string;
  submitLabel: string;
  canSubmit: boolean;
  onSubmit: () => void;
  children: React.ReactNode;
}) {
  return (
    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle className="font-heading text-xl">{title}</DrawerTitle>
        {description && <DrawerDescription>{description}</DrawerDescription>}
      </DrawerHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pb-2">{children}</div>
      <DrawerFooter>
        <Button className="h-14 text-base" disabled={!canSubmit} onClick={onSubmit}>
          {submitLabel}
        </Button>
      </DrawerFooter>
    </DrawerContent>
  );
}

export function GoalSheet({ ctx, teamId }: { ctx: SheetContext; teamId: string }) {
  const { opponentOf, teamName, pick } = useTeamTools(ctx);
  const [ownGoal, setOwnGoal] = useState(false);
  const [penalty, setPenalty] = useState(false);
  const [scorerId, setScorerId] = useState<string | null>(null);
  const [assistId, setAssistId] = useState<string | null>(null);

  const [step, setStep] = useState<"scorer" | "assist">("scorer");

  // An own goal is put in by a player of the other team.
  const scorerTeam = ownGoal ? opponentOf(teamId) : teamId;
  const showAssist = !ownGoal && !penalty;
  const nameOf = (id: string) => ctx.squads.find((p) => p.id === id)?.name ?? "Player";

  return (
    <Sheet
      title={`Goal ${teamName(teamId)}`}
      description="Pick the scorer. Leave them out if nobody saw who it was."
      submitLabel={`Record goal for ${teamName(teamId)}`}
      canSubmit
      onSubmit={() => {
        ctx.record({
          type: "goal",
          teamId,
          scorerId,
          assistId: ownGoal || penalty ? null : assistId,
          penalty: !ownGoal && penalty,
          ownGoal,
        });
        ctx.close();
      }}
    >
      <div className="flex gap-2">
        <Switch
          label="Penalty"
          checked={penalty}
          onChange={(on) => {
            setPenalty(on);
            if (on) setOwnGoal(false);
          }}
        />
        <Switch
          label="Own goal"
          checked={ownGoal}
          onChange={(on) => {
            setOwnGoal(on);
            setScorerId(null);
            setAssistId(null);
            setStep("scorer");
            if (on) setPenalty(false);
          }}
        />
      </div>
      {/* What will be recorded, always visible above the lists */}
      <p className="rounded-lg bg-muted px-3 py-2 text-sm">
        <span className="font-semibold">{scorerId ? nameOf(scorerId) : "Scorer not picked"}</span>
        {ownGoal && <span className="text-muted-foreground"> (own goal)</span>}
        {penalty && <span className="text-muted-foreground"> (penalty)</span>}
        {showAssist && <span className="text-muted-foreground"> · assist {assistId ? nameOf(assistId) : "none"}</span>}
      </p>
      {showAssist && (
        <Choice
          label="Pick"
          options={[
            { value: "scorer", label: scorerId ? `Scorer ✓` : "1. Scorer" },
            { value: "assist", label: assistId ? `Assist ✓` : "2. Assist" },
          ]}
          value={step}
          onChange={setStep}
        />
      )}
      {step === "scorer" || !showAssist ? (
        <PlayerPicker
          layout="grid"
          label={ownGoal ? `Who put it in their own net? (${teamName(scorerTeam)})` : "Scorer"}
          players={pick(scorerTeam, "on_pitch")}
          value={scorerId}
          onChange={(id) => {
            setScorerId(id);
            // The scorer can't also be the assister.
            if (id && id === assistId) setAssistId(null);
            if (id && showAssist) setStep("assist");
          }}
          noneLabel="Not sure"
        />
      ) : (
        <PlayerPicker
          layout="grid"
          label="Assist"
          players={pick(teamId, "on_pitch", [scorerId])}
          value={assistId}
          onChange={setAssistId}
          noneLabel="No assist"
        />
      )}
    </Sheet>
  );
}

export function CardSheet({ ctx }: { ctx: SheetContext }) {
  const { teamName, pick, teamOptions } = useTeamTools(ctx);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [colour, setColour] = useState<CardColour | null>(null);

  const yellows = playerId ? (ctx.state.players.get(playerId)?.yellowCards ?? 0) : 0;
  const secondYellow = colour === "yellow" && yellows > 0;
  const sendColour: CardColour | null = secondYellow ? "red" : colour;

  return (
    <Sheet
      title="Card"
      submitLabel={
        secondYellow ? "Record red card (second yellow)" : colour ? `Record ${colour} card` : "Record card"
      }
      canSubmit={!!teamId && !!playerId && !!sendColour}
      onSubmit={() => {
        if (!teamId || !playerId || !sendColour) return;
        ctx.record({ type: "card", teamId, playerId, colour: sendColour });
        ctx.close();
      }}
    >
      <Choice
        label="Team"
        options={teamOptions}
        value={teamId}
        onChange={(id) => {
          setTeamId(id);
          setPlayerId(null);
        }}
      />
      <Choice
        label="Colour"
        options={[
          { value: "yellow", label: "Yellow", className: "border-highlight bg-highlight text-highlight-foreground" },
          { value: "red", label: "Red", className: "border-live bg-card text-live ring-2 ring-live" },
        ]}
        value={colour}
        onChange={setColour}
      />
      {secondYellow && (
        <p className="flex items-start gap-2 rounded-lg bg-secondary p-3 text-sm text-secondary-foreground">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          This player is already on a yellow. A second yellow is recorded as a red card.
        </p>
      )}
      {teamId && (
        <PlayerPicker
          label={`Player (${teamName(teamId)})`}
          players={pick(teamId, "in_lineup")}
          value={playerId}
          onChange={setPlayerId}
        />
      )}
    </Sheet>
  );
}

export function SubSheet({ ctx }: { ctx: SheetContext }) {
  const { teamName, pick, teamOptions } = useTeamTools(ctx);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [offId, setOffId] = useState<string | null>(null);
  const [onId, setOnId] = useState<string | null>(null);
  const nameOf = (id: string) => ctx.squads.find((p) => p.id === id)?.name ?? "Player";

  return (
    <Sheet
      title="Substitution"
      submitLabel="Record substitution"
      canSubmit={!!teamId && !!offId && !!onId}
      onSubmit={() => {
        if (!teamId || !offId || !onId) return;
        ctx.record({ type: "substitution", teamId, playerOffId: offId, playerOnId: onId });
        ctx.close();
      }}
    >
      <Choice
        label="Team"
        options={teamOptions}
        value={teamId}
        onChange={(id) => {
          setTeamId(id);
          setOffId(null);
          setOnId(null);
        }}
      />
      {teamId && (
        <>
          <p className="rounded-lg bg-muted px-3 py-2 text-sm">
            <span className="font-semibold text-live">↓ {offId ? nameOf(offId) : "Off: pick"}</span>
            <span className="mx-2 text-muted-foreground">for</span>
            <span className="font-semibold text-success">↑ {onId ? nameOf(onId) : "On: pick"}</span>
          </p>
          <div className="grid grid-cols-2 gap-3">
            <PlayerPicker
              layout="column"
              label={`Off (${teamName(teamId)})`}
              players={pick(teamId, "on_pitch", [onId])}
              value={offId}
              onChange={setOffId}
            />
            <PlayerPicker
              layout="column"
              label="On (bench)"
              players={pick(teamId, "unused_sub", [offId])}
              value={onId}
              onChange={setOnId}
              emptyText="No unused subs left."
            />
          </div>
        </>
      )}
    </Sheet>
  );
}

export function PenaltySheet({ ctx }: { ctx: SheetContext }) {
  const { opponentOf, teamName, pick, teamOptions } = useTeamTools(ctx);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [takerId, setTakerId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<"missed" | "saved" | null>(null);
  const [keeperId, setKeeperId] = useState<string | null>(null);

  const keepers = teamId
    ? pick(opponentOf(teamId), "on_pitch").sort((a, b) => Number(b.position === "GK") - Number(a.position === "GK"))
    : [];

  return (
    <Sheet
      title="Penalty missed or saved"
      description="A scored penalty is a Goal with Penalty switched on."
      submitLabel={outcome === "saved" ? "Record saved penalty" : "Record missed penalty"}
      // A save needs the keeper: that's how the database tells a save from a miss (and fantasy pays the keeper).
      canSubmit={!!teamId && !!takerId && !!outcome && (outcome === "missed" || !!keeperId)}
      onSubmit={() => {
        if (!teamId || !takerId) return;
        ctx.record({
          type: "penalty_miss",
          teamId,
          takerId,
          savedById: outcome === "saved" ? keeperId : null,
        });
        ctx.close();
      }}
    >
      <Choice
        label="Team taking it"
        options={teamOptions}
        value={teamId}
        onChange={(id) => {
          setTeamId(id);
          setTakerId(null);
          const gk = outcome === "saved" && id ? pick(opponentOf(id), "on_pitch").find((p) => p.position === "GK") : undefined;
          setKeeperId(gk?.id ?? null);
        }}
      />
      <Choice
        label="What happened"
        options={[
          { value: "missed", label: "Missed" },
          { value: "saved", label: "Saved" },
        ]}
        value={outcome}
        onChange={(o) => {
          setOutcome(o);
          // Saved: start with the other side's goalkeeper picked.
          if (o === "saved" && teamId && !keeperId) {
            const gk = pick(opponentOf(teamId), "on_pitch").find((p) => p.position === "GK");
            if (gk) setKeeperId(gk.id);
          }
        }}
      />
      {teamId && (
        <PlayerPicker
          label={`Taker (${teamName(teamId)})`}
          players={pick(teamId, "on_pitch")}
          value={takerId}
          onChange={setTakerId}
        />
      )}
      {teamId && outcome === "saved" && (
        <PlayerPicker
          label={`Saved by (${teamName(opponentOf(teamId))})`}
          players={keepers}
          value={keeperId}
          onChange={setKeeperId}
        />
      )}
    </Sheet>
  );
}

/**
 * The goalkeeper a Save button credits: the team's GK on the pitch, if there's
 * exactly one. Otherwise null, and the console asks (SaveSheet).
 */
export function keeperOnPitch(ctx: Pick<SheetContext, "state" | "squads">, teamId: string): string | null {
  const squad = ctx.squads.filter((p) => p.teamId === teamId);
  const onPitch = new Set(eligiblePlayers(ctx.state, teamId, squad, "on_pitch"));
  const keepers = squad.filter((p) => p.position === "GK" && onPitch.has(p.id));
  return keepers.length === 1 ? keepers[0].id : null;
}

/** Who made the save, when the console can't tell (no GK on the pitch, or two). */
export function SaveSheet({ ctx, teamId }: { ctx: SheetContext; teamId: string }) {
  const { teamName, pick } = useTeamTools(ctx);
  const [keeperId, setKeeperId] = useState<string | null>(null);
  const players = pick(teamId, "on_pitch").sort((a, b) => Number(b.position === "GK") - Number(a.position === "GK"));
  return (
    <Sheet
      title={`Save ${teamName(teamId)}`}
      description="Who's in goal? Saves count for the keeper's fantasy points (1 point for every 3)."
      submitLabel="Record save"
      canSubmit={!!keeperId}
      onSubmit={() => {
        if (!keeperId) return;
        ctx.record({ type: "save", teamId, playerId: keeperId });
        ctx.close();
      }}
    >
      <PlayerPicker label={`In goal (${teamName(teamId)})`} players={players} value={keeperId} onChange={setKeeperId} />
    </Sheet>
  );
}

export function MotmSheet({ ctx }: { ctx: SheetContext }) {
  const { pick } = useTeamTools(ctx);
  const [playerId, setPlayerId] = useState<string | null>(null);

  return (
    <Sheet
      title="Man of the Match"
      description="Picked once. Undo it to change it."
      submitLabel="Record Man of the Match"
      canSubmit={!!playerId}
      onSubmit={() => {
        if (!playerId) return;
        ctx.record({ type: "man_of_the_match", playerId });
        ctx.close();
      }}
    >
      {[ctx.home, ctx.away].map((team) => (
        <PlayerPicker
          key={team.id}
          label={team.name}
          players={pick(team.id, "appeared")}
          value={playerId}
          onChange={setPlayerId}
        />
      ))}
    </Sheet>
  );
}
