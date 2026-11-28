import { Suspense } from "react";
import { connection } from "next/server";
import { BrandLoader } from "@/components/brand/brand-loader";
import { ChampionshipStrip } from "@/components/live/championship-strip";
import { MedalTowers } from "@/components/live/medal-towers";
import { RaceShare } from "@/components/live/race-share";
import { MedalTable } from "@/components/live/medal-table";
import { sharedChampionshipProgress, sharedMedalTable } from "@/lib/live/shared-results";
import { pageMeta } from "@/lib/seo";

// The race for the championship: the race track, the medal towers and the
// medal table, with the share sheet. Shared links land here.

export const metadata = pageMeta({
  title: "The championship",
  description: "The race for the SEES Games 2026 championship: every year's golds, silvers and bronzes, live through the festival.",
  path: "/championship",
});

export default function ChampionshipPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 py-4 pb-12 lg:max-w-4xl lg:px-6">
      <div className="px-4 lg:px-0">
        <p className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">SEES Games 2026</p>
        <h1 className="font-heading text-display font-bold text-brand uppercase">The championship</h1>
      </div>
      <Suspense fallback={<BrandLoader />}>
        <Championship />
      </Suspense>
    </main>
  );
}

async function Championship() {
  await connection();
  const [rows, progress] = await Promise.all([sharedMedalTable(), sharedChampionshipProgress()]);
  const now = requestTime();
  return (
    <>
      <ChampionshipStrip rows={rows} progress={progress} now={now} link={false} share={<RaceShare />} />
      <div className="flex flex-col gap-4 px-4 lg:px-0">
        <MedalTowers rows={rows} />
        <MedalTable rows={rows} />
      </div>
    </>
  );
}

/** The time this request is served (after connection(), so it's per request). */
function requestTime() {
  return Date.now();
}
