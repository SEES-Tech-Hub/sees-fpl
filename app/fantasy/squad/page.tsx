import { Suspense } from "react";
import { redirect } from "next/navigation";
import { SquadBuilder } from "@/components/fantasy/squad-builder";
import { DeadlineCountdown } from "@/components/fantasy/deadline-countdown";
import { EmptyState, LoadingPage, PageHeader } from "@/components/fantasy/states";
import { getFantasyRules, getMatchdayState, getMyTeam, getPlayers, getTeams } from "@/lib/fantasy/api";
import { formatMoney } from "@/lib/fantasy/format";
import { requireManager } from "@/lib/fantasy/guards";

export const metadata = { title: "Pick your squad" };

export default function SquadPage() {
  return (
    <Suspense fallback={<LoadingPage rows={10} />}>
      <Squad />
    </Suspense>
  );
}

async function Squad() {
  const { user, manager } = await requireManager("/fantasy/squad");
  const [team, players, teams, rules, md] = await Promise.all([
    getMyTeam(user),
    getPlayers(),
    getTeams(),
    getFantasyRules(),
    getMatchdayState(),
  ]);
  // The builder is for the first squad. After that, changes are transfers.
  if (team) redirect("/fantasy/transfers");

  return (
    <>
      <PageHeader
        title="Pick your squad"
        description={`${manager.teamName}: ${rules.squadPositions.GK} GK, ${rules.squadPositions.DEF} DEF, ${rules.squadPositions.MID} MID, ${rules.squadPositions.FWD} FWD, ${formatMoney(rules.budgetTenths)}, at most ${rules.maxPerTeam} from one year.`}
      />
      {md.next ? (
        <DeadlineCountdown deadlineAt={md.next.deadlineAt} label={`${md.next.name} deadline`} />
      ) : null}
      {!md.next ? (
        <EmptyState title="Squads are closed" description="There's no matchday left to pick a squad for." />
      ) : players.length === 0 ? (
        <EmptyState title="No players yet" description="The organisers haven't loaded the squads. Check back soon." />
      ) : (
        <SquadBuilder players={players} teams={teams} rules={rules} draftKey={`sees-fantasy-draft:${user.id}`} />
      )}
    </>
  );
}
