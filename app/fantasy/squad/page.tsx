import { Suspense } from "react";
import { redirect } from "next/navigation";
import { DeadlineIn } from "@/components/fantasy/deadline-card";
import { SquadBuilder } from "@/components/fantasy/squad-builder";
import { EmptyState, LoadingPitch, PageHeader } from "@/components/fantasy/states";
import { getFantasyRules, getMatchdayState, getMyManager, getMyTeam, getPlayers, requireFantasyUser } from "@/lib/fantasy/api";

export const metadata = { title: "Pick your squad" };

export default function SquadPage() {
  return (
    <Suspense fallback={<LoadingPitch />}>
      <Squad />
    </Suspense>
  );
}

// New managers land here straight after signing in: the builder starts with
// "Name your team" and saves the team and squad together.
async function Squad() {
  const user = await requireFantasyUser("/fantasy/squad");
  const [manager, team, players, rules, md] = await Promise.all([
    getMyManager(user),
    getMyTeam(user),
    getPlayers(),
    getFantasyRules(),
    getMatchdayState(),
  ]);
  // The builder is for the first squad. After that, changes are transfers.
  if (team) redirect("/fantasy/transfers");

  if (!md.next || players.length === 0) {
    return (
      <>
        <PageHeader display title="Pick your squad" />
        {!md.next ? (
          <EmptyState
            art="trophy"
            title="Squads are closed"
            description="There's no matchday left to pick a squad for."
            href="/fantasy/rankings"
            cta="See the rankings"
          />
        ) : (
          <EmptyState art="board" title="No players yet" description="The organisers haven't loaded the squads yet. Check back soon." />
        )}
      </>
    );
  }

  return (
    <SquadBuilder
      // Players who have left can't be picked (the database refuses them too).
      players={players.filter((p) => p.status !== "left")}
      rules={rules}
      userId={user.id}
      matchdayNumber={md.next.number}
      caption={
        <>
          Matchday {md.next.number} · <DeadlineIn deadlineAt={md.next.deadlineAt} serverNow={md.serverNow} />
        </>
      }
      newTeam={manager ? null : { managerName: user.name, defaultYear: user.yearGroup }}
    />
  );
}
