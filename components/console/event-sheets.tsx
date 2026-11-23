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

function useTeamTools(ctx: SheetContext) {
  const opponentOf = (teamId: string) => (teamId === ctx.home.id ? ctx.away.id : ctx.home.id);
  const teamName = (teamId: string) => (teamId === ctx.home.id ? ctx.home.shortName : ctx.away.shortName);
  const pick = (teamId: string | null, need: Eligibility, exclude: (string | null)[] = []) => {
    if (!teamId) return [];
    const squad = ctx.squads.filter((p) => p.teamId === teamId);
    const ids = new Set(eligiblePlayers(ctx.state, teamId, squad, need));
    return squad.filter((p) => ids.has(p.id) && !exclude.includes(p.id));
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

  // An own goal is put in by a player of the other team.
  const scorerTeam = ownGoal ? opponentOf(teamId) : teamId;

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
            if (on) setPenalty(false);
          }}
        />
      </div>
      <PlayerPicker
        label={ownGoal ? `Who put it in their own net? (${teamName(scorerTeam)})` : "Scorer"}
        players={pick(scorerTeam, "on_pitch")}
        value={scorerId}
        onChange={(id) => {
          setScorerId(id);
          if (id === assistId) setAssistId(null);
        }}
        noneLabel="Not sure"
      />
      {!ownGoal && !penalty && (
        <PlayerPicker
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
          <PlayerPicker
            label={`Coming off (${teamName(teamId)})`}
            players={pick(teamId, "on_pitch", [onId])}
            value={offId}
            onChange={setOffId}
          />
          <PlayerPicker
            label="Coming on"
            players={pick(teamId, "unused_sub", [offId])}
            value={onId}
            onChange={setOnId}
            emptyText="No unused substitutes left."
          />
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
      canSubmit={!!teamId && !!takerId && !!outcome}
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
          setKeeperId(null);
        }}
      />
      <Choice
        label="What happened"
        options={[
          { value: "missed", label: "Missed" },
          { value: "saved", label: "Saved" },
        ]}
        value={outcome}
        onChange={setOutcome}
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
          noneLabel="Not sure"
        />
      )}
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
