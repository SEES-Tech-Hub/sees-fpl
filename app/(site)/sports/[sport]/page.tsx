import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrandLoader } from "@/components/brand/brand-loader";
import { SportView } from "@/components/live/sports-views";
import { getSportPage, getSports } from "@/lib/live/public-pages";

// Owner: Fortune (built by Tayo). One sport: fixtures by date, then its
// table and knockouts, or its races and podiums.

export async function generateMetadata({ params }: PageProps<"/sports/[sport]">): Promise<Metadata> {
  const { sport } = await params;
  const found = (await getSports()).find((s) => s.slug === sport);
  return { title: found?.name ?? "Sport" };
}

export default function SportPage({ params }: PageProps<"/sports/[sport]">) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 py-4 pb-12 lg:max-w-4xl lg:px-6">
      <Suspense fallback={<BrandLoader />}>
        <Sport params={params} />
      </Suspense>
    </main>
  );
}

async function Sport({ params }: { params: PageProps<"/sports/[sport]">["params"] }) {
  const { sport } = await params;
  const data = await getSportPage(sport);
  if (!data) notFound();
  return <SportView sport={data.sport} cards={data.cards} tables={data.tables} races={data.races} />;
}
