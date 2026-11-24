import { Suspense } from "react";
import { EmptyState, LoadingPitch, PageHeader } from "@/components/fantasy/states";
import { TransferPlanner } from "@/components/fantasy/transfer-planner";
import { getFantasyRules, getMatchdayState, getPlayers, getTransferState } from "@/lib/fantasy/api";
import { requireSquad } from "@/lib/fantasy/guards";
import { privatePage } from "@/lib/seo";

export const metadata = privatePage("Transfers");

export default function TransfersPage() {
  return (
    <Suspense fallback={<LoadingPitch />}>
      <Transfers />
    </Suspense>
  );
}

async function Transfers() {
  const { user, team } = await requireSquad("/fantasy/transfers");
  const [state, players, rules, md] = await Promise.all([
    getTransferState(user),
    getPlayers(),
    getFantasyRules(),
    getMatchdayState(),
  ]);

  if (!state || state.locked || !md.next) {
    return (
      <>
        <PageHeader title="Transfers" />
        <EmptyState
          art="calendar"
          title="Transfers are closed"
          description="No matchday is open for changes right now. Transfers open again after the next matchday is finalised."
          href="/fantasy/points"
          cta="See your points"
        />
      </>
    );
  }

  const byId = new Map(players.map((p) => [p.id, p]));
  const squad = [...team.picks].sort((a, b) => a.slot - b.slot).map((p) => byId.get(p.playerId)!);

  return (
    <>
      <PageHeader caption={`Matchday ${md.next.number} · Transfers`} title="Transfers" />
      <TransferPlanner
        key={squad.map((p) => p.id).join() + state.made + String(state.wildcard.activeThisMatchday)}
        squad={squad}
        players={players}
        state={state}
        rules={rules}
        deadlineAt={md.next.deadlineAt}
        serverNow={md.serverNow}
        matchdayName={md.next.name}
      />
    </>
  );
}
