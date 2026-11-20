import { Suspense } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getDashboardData, type DashboardFixture } from "./dashboard-data";
import { formatDay, formatLongDay, formatTime } from "./wat";

// Admin-only and session-dependent: see the note on `instant` in layout.tsx.
export const instant = false;

export const metadata = { title: "Dashboard" };

// Owner: Tayo (T12). Today's fixtures, missing console holders, and counts.
export default function AdminDashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl font-semibold text-primary md:text-3xl">Dashboard</h1>
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}

async function DashboardContent() {
  const data = await getDashboardData();

  return (
    <>
      <p className="-mt-4 text-sm text-muted-foreground">{formatLongDay(data.now)} (WAT)</p>

      {data.needsHolder.length > 0 && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>
            {data.needsHolder.length === 1
              ? "1 fixture starts within 2 hours with no console holder"
              : `${data.needsHolder.length} fixtures start within 2 hours with no console holder`}
          </AlertTitle>
          <AlertDescription>
            <ul className="mt-1 list-disc pl-5">
              {data.needsHolder.map((f) => (
                <li key={f.id}>
                  {formatTime(f.kickoff_at!)}: {f.sportName}, {f.label}
                </li>
              ))}
            </ul>
            <Link href="/admin/fixtures" className="mt-2 inline-block font-medium underline underline-offset-4">
              Assign officials
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <section aria-label="Totals" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Players" value={data.counts.players} href="/admin/players" />
        <StatCard label="Teams" value={data.counts.teams} href="/admin/teams" />
        <StatCard label="Fixtures" value={data.counts.fixtures} href="/admin/fixtures" />
        <StatCard label="Officials" value={data.counts.officials} href="/admin/officials" />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Today</CardTitle>
          <CardDescription>
            {data.today.length === 0
              ? "No fixtures today."
              : `${data.today.length} fixture${data.today.length === 1 ? "" : "s"} today.`}
          </CardDescription>
        </CardHeader>
        {data.today.length > 0 && (
          <CardContent>
            <FixtureList fixtures={data.today} />
          </CardContent>
        )}
      </Card>

      {data.today.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Next up</CardTitle>
            <CardDescription>
              {data.upcoming.length === 0 ? "Nothing scheduled." : "The next scheduled fixtures."}
            </CardDescription>
          </CardHeader>
          {data.upcoming.length > 0 && (
            <CardContent>
              <FixtureList fixtures={data.upcoming} showDay />
            </CardContent>
          )}
        </Card>
      )}
    </>
  );
}

function StatCard({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="rounded-xl focus-visible:outline-2 focus-visible:outline-ring">
      <Card className="h-full transition-colors hover:bg-muted">
        <CardHeader>
          <CardDescription>{label}</CardDescription>
          <CardTitle className="font-heading text-3xl">{value}</CardTitle>
        </CardHeader>
      </Card>
    </Link>
  );
}

const STATUS_TEXT: Record<string, string> = {
  scheduled: "Scheduled",
  live: "Live",
  half_time: "Half time",
  full_time: "Full time",
  postponed: "Postponed",
  walkover: "Walkover",
  cancelled: "Cancelled",
};

function FixtureList({ fixtures, showDay = false }: { fixtures: DashboardFixture[]; showDay?: boolean }) {
  return (
    <ul className="divide-y divide-border">
      {fixtures.map((f) => (
        <li key={f.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0">
          <div className="w-24 shrink-0 text-sm tabular-nums">
            {f.kickoff_at ? (
              <>
                {showDay && <div className="text-muted-foreground">{formatDay(f.kickoff_at)}</div>}
                <div className="font-medium">{formatTime(f.kickoff_at)}</div>
              </>
            ) : (
              <span className="text-muted-foreground">Time TBC</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{f.label}</div>
            <div className="truncate text-sm text-muted-foreground">
              {f.sportName}
              {f.venue ? ` · ${f.venue}` : ""}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={f.status === "live" ? "default" : "outline"}>{STATUS_TEXT[f.status] ?? f.status}</Badge>
            {f.holderName ? (
              <Badge variant="secondary">Holder: {f.holderName}</Badge>
            ) : (
              <Badge variant="destructive">No holder</Badge>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading dashboard">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-40" />
    </div>
  );
}
