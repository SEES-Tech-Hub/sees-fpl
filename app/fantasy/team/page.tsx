import { Suspense } from "react";
import { LineupEditor } from "@/components/fantasy/lineup-editor";
import { LoadingPitch, PageHeader } from "@/components/fantasy/states";
import { getFantasyRules, getMatchdayState, getPlayers } from "@/lib/fantasy/api";
import { formatMoney } from "@/lib/fantasy/format";
import { requireSquad } from "@/lib/fantasy/guards";
import type { Matchday } from "@/lib/fantasy/types";
import { privatePage } from "@/lib/seo";

export const metadata = privatePage("My team");

export default function TeamPage() {
  return (
    <Suspense fallback={<LoadingPitch />}>
      <Team />
    </Suspense>
  );
}

/** "v Y4" for each team on a matchday (short enough for a pitch chip). */
function fixtureLabels(matchday: Matchday | null) {
  const labels: Record<string, string> = {};
  for (const f of matchday?.fixtures ?? []) {
    if (f.homeTeamId) labels[f.homeTeamId] = `v ${f.awayShort ?? "TBD"}`;
    if (f.awayTeamId) labels[f.awayTeamId] = `v ${f.homeShort ?? "TBD"}`;
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
        caption={md.next ? `Matchday ${md.next.number} · My team` : "My team"}
        title={manager.teamName}
        description={`${formatMoney(team.bankTenths)} in the bank`}
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
        serverNow={md.serverNow}
        matchdayName={md.next?.name ?? md.current?.name ?? "Matchday"}
        matchdayNumber={md.next?.number ?? md.current?.number ?? 0}
        fixtureByTeam={fixtureLabels(md.next)}
      />
    </>
  );
}
