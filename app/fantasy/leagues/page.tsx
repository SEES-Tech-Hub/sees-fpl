import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CreateLeagueForm, JoinLeagueForm } from "@/components/fantasy/league-forms";
import { EmptyState, LoadingPage, PageHeader } from "@/components/fantasy/states";
import { RankingTabs } from "@/components/fantasy/ranking-tabs";
import { Separator } from "@/components/ui/separator";
import { getFantasyRules, getMyLeagues } from "@/lib/fantasy/api";
import { ordinal } from "@/lib/fantasy/format";
import { requireManager } from "@/lib/fantasy/guards";

export const metadata = { title: "Leagues" };

export default function LeaguesPage() {
  return (
    <>
      <PageHeader caption="SEES Fantasy" title="Leagues" description="Private mini-leagues with your friends, joined by code." />
      <Suspense fallback={<LoadingPage rows={3} />}>
        <Leagues />
      </Suspense>
    </>
  );
}

async function Leagues() {
  const { user } = await requireManager("/fantasy/leagues");
  const [leagues, rules] = await Promise.all([getMyLeagues(user), getFantasyRules()]);

  return (
    <>
      <RankingTabs active="leagues" myYear={user.yearGroup} />
      <section aria-label="Your leagues">
        {leagues.length === 0 ? (
          <EmptyState
          art="stands"
            title="No leagues yet"
            description="You're not in a league yet. Create one and share the code with friends."
          />
        ) : (
          <ul className="rounded-xl bg-card shadow-card">
            {leagues.map((l) => (
              <li key={l.id} className="border-b border-border last:border-b-0">
                <Link href={`/fantasy/leagues/${l.id}`} className="flex min-h-14 items-center gap-3 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{l.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {l.memberCount} manager{l.memberCount === 1 ? "" : "s"}
                      {l.isOwner ? " · you created it" : ""}
                    </p>
                  </div>
                  <span className="font-heading text-xl font-bold tabular-nums">
                    {l.myRank ? ordinal(l.myRank) : "–"}
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <JoinLeagueForm codeLength={rules.leagueCodeLength} />
      <Separator />
      <CreateLeagueForm />
    </>
  );
}
