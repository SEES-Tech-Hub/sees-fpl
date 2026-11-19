import { Suspense } from "react";
import Link from "next/link";
import { PointsBreakdown } from "@/components/fantasy/points-breakdown";
import { EmptyState, LoadingPage, PageHeader } from "@/components/fantasy/states";
import { Badge } from "@/components/ui/badge";
import { getManagerPoints, getMatchdayHistory, getMatchdayState } from "@/lib/fantasy/api";
import { formatSigned } from "@/lib/fantasy/format";
import { requireManager } from "@/lib/fantasy/guards";
import { formatWAT } from "@/lib/fantasy/time";
import { cn } from "@/lib/utils";

export const metadata = { title: "Points" };

export default function PointsPage({ searchParams }: PageProps<"/fantasy/points">) {
  return (
    <Suspense fallback={<LoadingPage rows={8} />}>
      <Points searchParams={searchParams} />
    </Suspense>
  );
}

async function Points({ searchParams }: { searchParams: PageProps<"/fantasy/points">["searchParams"] }) {
  const params = await searchParams;
  const { user, manager } = await requireManager("/fantasy/points");
  const managerId = typeof params.manager === "string" ? params.manager : user.id;
  const mine = managerId === user.id;

  const [history, md] = await Promise.all([getMatchdayHistory(user, managerId), getMatchdayState()]);
  if (history.length === 0) {
    const first = md.next ?? md.matchdays[0];
    return (
      <>
        <PageHeader title="Points" />
        <EmptyState
          title="No points yet"
          description={
            mine
              ? `Points appear once the ${first?.name ?? "first matchday"} deadline passes (${formatWAT(first?.deadlineAt)} WAT).`
              : "This manager's points appear after the deadline."
          }
          href={mine ? "/fantasy/team" : "/fantasy/rankings"}
          cta={mine ? "Check your team" : "Back to rankings"}
        />
      </>
    );
  }

  const requested = Number(params.md);
  const selected = history.find((h) => h.matchdayNumber === requested) ?? history[history.length - 1];
  const points = await getManagerPoints(user, managerId, selected.matchdayNumber);
  const query = (n: number) => `/fantasy/points?md=${n}${mine ? "" : `&manager=${managerId}`}`;

  return (
    <>
      <PageHeader
        title={mine ? "Points" : (points?.teamName ?? "Points")}
        description={mine ? manager.teamName : "Picks are shown after the deadline."}
      />

      <nav aria-label="Matchday" className="-mx-4 overflow-x-auto px-4">
        <ul className="flex min-w-max gap-2">
          {history.map((h) => (
            <li key={h.matchdayNumber}>
              <Link
                href={query(h.matchdayNumber)}
                aria-current={h.matchdayNumber === selected.matchdayNumber ? "page" : undefined}
                className={cn(
                  "flex h-11 min-w-16 flex-col items-center justify-center rounded-lg border border-border px-3 text-xs",
                  h.matchdayNumber === selected.matchdayNumber && "border-primary bg-primary text-primary-foreground",
                )}
              >
                <span>MD{h.matchdayNumber}</span>
                <span className="font-semibold tabular-nums">{h.points}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {!points ? (
        <EmptyState title="No team that matchday" description="This manager hadn't picked a team by that deadline." />
      ) : (
        <>
          <section aria-label="Matchday total" className="grid grid-cols-3 gap-2">
            <div className="col-span-3 flex items-center justify-between rounded-xl bg-brand px-4 py-3 text-brand-foreground">
              <div>
                <p className="text-xs opacity-80">Matchday {points.matchdayNumber}</p>
                <p className="font-heading text-4xl font-semibold tabular-nums">{points.total}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                {points.provisional && <Badge className="bg-highlight text-highlight-foreground">Provisional</Badge>}
                {points.wildcardPlayed && <Badge variant="secondary">Wildcard</Badge>}
              </div>
            </div>
            <Stat label="From players" value={String(points.pointsBeforeCost)} />
            <Stat label="Transfer cost" value={points.transferCost ? formatSigned(-points.transferCost) : "0"} />
            <Stat label="Total" value={String(points.total)} />
          </section>
          {points.provisional && (
            <p className="text-xs text-muted-foreground">
              Provisional: points can still change until the organisers finalise the matchday.
            </p>
          )}
          <PointsBreakdown points={points} />
        </>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-heading text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
