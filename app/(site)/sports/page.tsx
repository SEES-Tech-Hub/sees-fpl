import { Suspense } from "react";
import { BrandLoader } from "@/components/brand/brand-loader";
import { SportsGrid } from "@/components/live/sports-views";
import { getFixtureCards } from "@/lib/live/fixture-cards";
import { getSports } from "@/lib/live/public-pages";
import { pageMeta } from "@/lib/seo";

// Owner: Fortune (built by Tayo). All 12 sports, with a live badge.

export const metadata = pageMeta({
  title: "Sports",
  description: "All 12 sports at SEES Games 2026: football, basketball, volleyball, athletics, swimming, board games and more. Fixtures, results and tables.",
  path: "/sports",
});

export default function SportsPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 py-4 pb-12 lg:max-w-4xl lg:px-6">
      <div className="px-4 lg:px-0">
        <p className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">SEES Games 2026</p>
        <h1 className="font-heading text-display font-bold text-brand uppercase">Sports</h1>
      </div>
      <Suspense fallback={<BrandLoader />}>
        <Grid />
      </Suspense>
    </main>
  );
}

async function Grid() {
  const [sports, cards] = await Promise.all([getSports(), getFixtureCards()]);
  return <SportsGrid sports={sports} cards={cards} />;
}
