import { Suspense } from "react";
import Link from "next/link";
import { RankingTable } from "@/components/fantasy/ranking-table";
import { EmptyState, LoadingPage, PageHeader } from "@/components/fantasy/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getMyManager, getOptionalFantasyUser, getRankings } from "@/lib/fantasy/api";
import { ordinal } from "@/lib/fantasy/format";
import type { RankingScope } from "@/lib/fantasy/types";
import { cn } from "@/lib/utils";

export const metadata = { title: "Rankings" };

// Public, as in the PRD's role table: anyone can view fantasy rankings.
export default function RankingsPage({ searchParams }: PageProps<"/fantasy/rankings">) {
  return (
    <>
      <PageHeader title="Rankings" description="Every SEES Fantasy manager, by total points." />
      <Suspense fallback={<LoadingPage rows={10} />}>
        <Rankings searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Rankings({ searchParams }: { searchParams: PageProps<"/fantasy/rankings">["searchParams"] }) {
  const params = await searchParams;
  const year = Number(params.year);
  const scope: RankingScope = year >= 1 && year <= 5 ? { kind: "year", year } : { kind: "overall" };
  const page = Math.max(1, Number(params.page) || 1);

  const user = await getOptionalFantasyUser();
  const [ranking, manager] = await Promise.all([
    getRankings(user, scope, page),
    user ? getMyManager(user) : Promise.resolve(null),
  ]);
  const pages = Math.max(1, Math.ceil(ranking.totalManagers / ranking.pageSize));
  const href = (y: number | null, p = 1) => {
    const q = new URLSearchParams();
    if (y) q.set("year", String(y));
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return `/fantasy/rankings${s ? `?${s}` : ""}`;
  };
  const activeYear = scope.kind === "year" ? scope.year : null;

  return (
    <>
      <nav aria-label="Ranking" className="-mx-4 overflow-x-auto px-4">
        <ul className="flex min-w-max gap-2">
          {[null, 1, 2, 3, 4, 5].map((y) => (
            <li key={y ?? "all"}>
              <Link
                href={href(y)}
                aria-current={activeYear === y ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center rounded-lg border border-border px-3 text-sm font-medium",
                  activeYear === y && "border-primary bg-primary text-primary-foreground",
                )}
              >
                {y === null ? "Overall" : `Year ${y}`}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {ranking.me ? (
        <section aria-label="Your rank" className="flex items-center justify-between rounded-xl bg-brand px-4 py-3 text-brand-foreground">
          <div className="min-w-0">
            <p className="text-xs opacity-80">Your rank{activeYear ? ` in Year ${activeYear}` : ""}</p>
            <p className="font-heading text-3xl font-semibold tabular-nums">
              {ordinal(ranking.me.rank)}
              <span className="ml-1 text-base font-normal opacity-80">of {ranking.totalManagers}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs opacity-80">Points</p>
            <p className="font-heading text-2xl font-semibold tabular-nums">{ranking.me.totalPoints}</p>
          </div>
        </section>
      ) : !user ? (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm">
          <Link href="/login?next=/fantasy" className="font-medium text-primary underline-offset-4 hover:underline">
            Sign in
          </Link>{" "}
          to play and see your rank.
        </p>
      ) : !manager ? (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm">
          <Link href="/fantasy/join" className="font-medium text-primary underline-offset-4 hover:underline">
            Create your team
          </Link>{" "}
          to appear in the rankings.
        </p>
      ) : activeYear ? (
        <p className="text-sm text-muted-foreground">You&apos;re not in Year {activeYear}&apos;s ranking.</p>
      ) : null}

      {ranking.provisional && ranking.rows.length > 0 && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge className="bg-highlight text-highlight-foreground">Provisional</Badge>
          Ranks can change until the matchday is finalised.
        </p>
      )}

      {ranking.rows.length === 0 ? (
        <EmptyState
          title="No managers here yet"
          description={activeYear ? `No Year ${activeYear} managers have points yet.` : "Rankings appear after the first matchday."}
        />
      ) : (
        <RankingTable rows={ranking.rows} meId={user?.id ?? null} linkToPoints={Boolean(manager)} />
      )}

      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between gap-2">
          <Button asChild variant="outline" className={cn("h-11 px-4", page <= 1 && "pointer-events-none opacity-50")}>
            <Link href={href(activeYear, page - 1)} aria-disabled={page <= 1}>
              Previous
            </Link>
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {pages}
          </span>
          <Button asChild variant="outline" className={cn("h-11 px-4", page >= pages && "pointer-events-none opacity-50")}>
            <Link href={href(activeYear, page + 1)} aria-disabled={page >= pages}>
              Next
            </Link>
          </Button>
        </nav>
      )}
    </>
  );
}
