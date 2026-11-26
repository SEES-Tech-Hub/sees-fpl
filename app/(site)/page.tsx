import { Suspense } from "react";
import { connection } from "next/server";
import { BrandLoader } from "@/components/brand/brand-loader";
import { ChampionshipStrip } from "@/components/live/championship-strip";
import { HomeLive } from "@/components/live/home-live";
import { getFixtureCards } from "@/lib/live/fixture-cards";
import { getMedalTable } from "@/lib/live/results";
import { JsonLd } from "@/components/seo/json-ld";
import { siteBase, SITE_DESCRIPTION } from "@/lib/seo";

// Owner: Fortune (built by Tayo). Home: Live now (or the next match), the
// race for the championship, fixtures by date and the latest results.
// Scores stay live by polling /api/live (lib/live/use-live.ts).

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 py-6 pb-16 lg:max-w-4xl lg:gap-12 lg:px-6 lg:py-10">
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
  const [cards, medals] = await Promise.all([getFixtureCards(), getMedalTable()]);
  const serverNow = requestTime();
  return (
    <HomeLive cards={cards} serverNow={serverNow} championship={<ChampionshipStrip rows={medals} />} />
  );
}

/** The time this request is served (after connection(), so it's per request). */
function requestTime() {
  return Date.now();
}
