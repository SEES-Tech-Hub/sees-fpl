import { Suspense } from "react";
import { EmptyState, LoadingPage, PageHeader } from "@/components/fantasy/states";
import { TransferPlanner } from "@/components/fantasy/transfer-planner";
import { getFantasyRules, getMatchdayState, getPlayers, getTransferState } from "@/lib/fantasy/api";
import { requireSquad } from "@/lib/fantasy/guards";

export const metadata = { title: "Transfers" };

export default function TransfersPage() {
  return (
    <Suspense fallback={<LoadingPage rows={8} />}>
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
          title="Transfers are closed"
          description="There's no matchday open for changes right now."
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
      <PageHeader title="Transfers" description={`For ${md.next.name}. Players can only be swapped for one in the same position.`} />
      <TransferPlanner
        key={squad.map((p) => p.id).join() + state.made + String(state.wildcard.activeThisMatchday)}
        squad={squad}
        players={players}
        state={state}
        rules={rules}
        deadlineAt={md.next.deadlineAt}
        matchdayName={md.next.name}
      />
    </>
  );
}
