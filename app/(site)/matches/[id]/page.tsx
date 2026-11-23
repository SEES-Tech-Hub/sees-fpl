import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrandLoader } from "@/components/brand/brand-loader";
import { MatchCentre } from "@/components/live/match-centre";
import { getMatchPage } from "@/lib/live/match-page";

// Owner: Fortune (built by Tayo). The match centre: live score header,
// timeline and lineups. Stays live by polling /api/live/<id>.

export async function generateMetadata({ params }: PageProps<"/matches/[id]">): Promise<Metadata> {
  const { id } = await params;
  const data = await getMatchPage(id);
  if (!data) return { title: "Match" };
  const { fixture } = data;
  return { title: `${fixture.home?.name ?? "TBD"} v ${fixture.away?.name ?? "TBD"} · ${fixture.sport.name}` };
}

export default function MatchPage({ params }: PageProps<"/matches/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 pb-12 lg:max-w-3xl lg:px-6 lg:pt-4">
      <Suspense fallback={<BrandLoader />}>
        <Match params={params} />
      </Suspense>
    </main>
  );
}

async function Match({ params }: { params: PageProps<"/matches/[id]">["params"] }) {
  const { id } = await params;
  const data = await getMatchPage(id);
  if (!data) notFound();
  return <MatchCentre data={data} />;
}
