import { Suspense } from "react";
import { LineupEditor } from "@/components/fantasy/lineup-editor";
import { LoadingPage, PageHeader } from "@/components/fantasy/states";
import { getFantasyRules, getMatchdayState, getPlayers } from "@/lib/fantasy/api";
import { formatMoney } from "@/lib/fantasy/format";
import { requireSquad } from "@/lib/fantasy/guards";
import type { Matchday } from "@/lib/fantasy/types";

export const metadata = { title: "My team" };

export default function TeamPage() {
  return (
    <Suspense fallback={<LoadingPage rows={4} />}>
      <Team />
    </Suspense>
  );
}

/** "v Y4 (H)" for each team on a matchday, or "No match". */
function fixtureLabels(matchday: Matchday | null) {
  const labels: Record<string, string> = {};
  for (const f of matchday?.fixtures ?? []) {
    if (f.homeTeamId) labels[f.homeTeamId] = `v ${f.awayShort ?? "TBD"} (H)`;
    if (f.awayTeamId) labels[f.awayTeamId] = `v ${f.homeShort ?? "TBD"} (A)`;
  }
  return labels;
}

async function Team() {
  const { manager, team } = await requireSquad("/fantasy/team");
  const [players, rules, md] = await Promise.all([getPlayers(), getFantasyRules(), getMatchdayState()]);
  const byId = new Map(players.map((p) => [p.id, p]));
  const squad = [...team.picks].sort((a, b) => a.slot - b.slot).map((pick) => byId.get(pick.playerId)!);
  const captain = team.picks.find((p) => p.isCaptain)?.playerId ?? null;
  const vice = team.picks.find((p) => p.isViceCaptain)?.playerId ?? null;

  return (
    <>
      <PageHeader
        title={manager.teamName}
        description={`${md.next ? md.next.name : "Season finished"} · Squad value ${formatMoney(team.squadValueTenths)} · In the bank ${formatMoney(team.bankTenths)}`}
      />
      <LineupEditor
        // Re-mount when the saved lineup changes (after Save or a transfer).
        key={squad.map((p) => p.id).join() + captain + vice}
        squad={squad}
        captainId={captain}
        viceId={vice}
        rules={rules}
        locked={team.locked}
        deadlineAt={md.next?.deadlineAt ?? null}
        fixtureByTeam={fixtureLabels(md.next)}
      />
    </>
  );
}
