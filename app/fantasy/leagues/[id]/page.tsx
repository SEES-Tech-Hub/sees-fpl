import { Suspense } from "react";
import { CopyCode } from "@/components/fantasy/copy-code";
import { RankingTable } from "@/components/fantasy/ranking-table";
import { EmptyState, LoadingPage, PageHeader } from "@/components/fantasy/states";
import { Badge } from "@/components/ui/badge";
import { getLeagueStandings } from "@/lib/fantasy/api";
import { requireManager } from "@/lib/fantasy/guards";

export const metadata = { title: "League" };

export default function LeaguePage({ params }: PageProps<"/fantasy/leagues/[id]">) {
  return (
    <Suspense fallback={<LoadingPage rows={8} />}>
      <League params={params} />
    </Suspense>
  );
}

async function League({ params }: { params: PageProps<"/fantasy/leagues/[id]">["params"] }) {
  const { id } = await params;
  const { user } = await requireManager(`/fantasy/leagues/${id}`);
  const standings = await getLeagueStandings(user, id);

  if (!standings) {
    return (
      <>
        <PageHeader title="League" />
        <EmptyState
          title="League not found"
          description="It doesn't exist, or you're not a member. Join it with its code."
          href="/fantasy/leagues"
          cta="Your leagues"
        />
      </>
    );
  }

  const { league, rows } = standings;
  return (
    <>
      <PageHeader
        title={league.name}
        description={`${league.memberCount} manager${league.memberCount === 1 ? "" : "s"}`}
      />
      <CopyCode code={league.code} leagueName={league.name} />
      {standings.provisional && rows.length > 0 && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge className="bg-highlight text-highlight-foreground">Provisional</Badge>
          Ranks can change until the matchday is finalised.
        </p>
      )}
      {rows.length <= 1 && (
        <p className="text-sm text-muted-foreground">Share the code so friends can join.</p>
      )}
      {rows.length > 0 && <RankingTable rows={rows} meId={user.id} linkToPoints />}
    </>
  );
}
