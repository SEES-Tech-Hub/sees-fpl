import { Suspense } from "react";
import { connection } from "next/server";
import { BrandLoader } from "@/components/brand/brand-loader";
import { ChampionshipStrip } from "@/components/live/championship-strip";
import { FantasyTicketStub } from "@/components/fantasy/ticket-stub";
import { RaceShare } from "@/components/live/race-share";
import { HomeLive } from "@/components/live/home-live";
import { getFixtureCards } from "@/lib/live/fixture-cards";
import { sharedChampionshipProgress, sharedMedalTable } from "@/lib/live/shared-results";
import { JsonLd } from "@/components/seo/json-ld";
import { siteBase, SITE_DESCRIPTION } from "@/lib/seo";

// Owner: Fortune (built by Tayo). Home: Live now (or the next match), the
// race for the championship, fixtures by date and the latest results.
// Scores stay live by polling /api/live (lib/live/use-live.ts).

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 py-4 pb-12 lg:max-w-4xl lg:px-6">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            { "@type": "WebSite", name: "SEES Games Hub", url: siteBase(), description: SITE_DESCRIPTION },
            {
              "@type": "SportsOrganization",
              name: "Society of Electrical & Electronics and Computer Engineering Students (SEES)",
              alternateName: "SEES UNILAG",
              url: "https://seesunilag.com",
              logo: `${siteBase()}/icons/icon-512.png`,
            },
          ],
        }}
      />
      <Suspense fallback={<BrandLoader />}>
        <HomeContent />
      </Suspense>
    </main>
  );
}

async function HomeContent() {
  await connection();
  const [cards, medals, progress] = await Promise.all([getFixtureCards(), sharedMedalTable(), sharedChampionshipProgress()]);
  const serverNow = requestTime();
  return (
    <HomeLive
      cards={cards}
      serverNow={serverNow}
      championship={<ChampionshipStrip rows={medals} progress={progress} now={serverNow} share={<RaceShare />} />}
      // Rendered with the rest of Home (inside its Suspense): a nested boundary
      // inside HomeLive (a client component) never got swapped in.
      fantasy={<FantasyTicketStub />}
    />
  );
}

/** The time this request is served (after connection(), so it's per request). */
function requestTime() {
  return Date.now();
}
