import { Suspense } from "react";
import { redirect } from "next/navigation";
import { DeadlineIn } from "@/components/fantasy/deadline-card";
import { SquadBuilder } from "@/components/fantasy/squad-builder";
import { EmptyState, LoadingPitch, PageHeader } from "@/components/fantasy/states";
import { getFantasyRules, getMatchdayState, getMyTeam, getPlayers } from "@/lib/fantasy/api";
import { formatMoney } from "@/lib/fantasy/format";
import { requireManager } from "@/lib/fantasy/guards";

export const metadata = { title: "Pick your squad" };

export default function SquadPage() {
  return (
    <Suspense fallback={<LoadingPitch />}>
      <Squad />
    </Suspense>
  );
}

async function Squad() {
  const { user } = await requireManager("/fantasy/squad");
  const [team, players, rules, md] = await Promise.all([
    getMyTeam(user),
    getPlayers(),
    getFantasyRules(),
    getMatchdayState(),
  ]);
  // The builder is for the first squad. After that, changes are transfers.
  if (team) redirect("/fantasy/transfers");

  return (
    <>
      <PageHeader
        display
        title="Pick your squad"
        caption={
          md.next ? (
            <>
              Matchday {md.next.number} · <DeadlineIn deadlineAt={md.next.deadlineAt} serverNow={md.serverNow} />
            </>
          ) : undefined
        }
        description={`Pick ${rules.squadSize} players within ${formatMoney(rules.budgetTenths)}. At most ${rules.maxPerTeam} from one year.`}
      />
      {!md.next ? (
        <EmptyState
          title="Squads are closed"
          description="There's no matchday left to pick a squad for."
          href="/fantasy/rankings"
          cta="See the rankings"
        />
      ) : players.length === 0 ? (
        <EmptyState title="No players yet" description="The organisers haven't loaded the squads yet. Check back soon." />
      ) : (
        <SquadBuilder
          // Players who have left can't be picked (the database refuses them too).
          players={players.filter((p) => p.status !== "left")}
          rules={rules}
          draftKey={`sees-fantasy-draft:${user.id}`}
        />
      )}
    </>
  );
}
