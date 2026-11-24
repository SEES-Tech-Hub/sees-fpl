import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrandLoader } from "@/components/brand/brand-loader";
import { MatchCentre } from "@/components/live/match-centre";
import { getMatchPage } from "@/lib/live/match-page";
import { pageMeta, siteBase } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import { formatWAT } from "@/lib/utils";

// Owner: Fortune (built by Tayo). The match centre: live score header,
// timeline and lineups. Stays live by polling /api/live/<id>.

export async function generateMetadata({ params }: PageProps<"/matches/[id]">): Promise<Metadata> {
  const { id } = await params;
  const data = await getMatchPage(id);
  if (!data) return { title: "Match" };
  const { fixture, state, timeline } = data;
  const home = fixture.home?.name ?? "TBD";
  const away = fixture.away?.name ?? "TBD";
  const played = state.status !== "scheduled" && state.status !== "postponed" && state.status !== "cancelled";
  const score = `${home} ${state.homeScore ?? 0}–${state.awayScore ?? 0} ${away}`;
  const scorers = timeline
    .filter((e) => e.type === "goal" && e.playerName)
    .map((e) => `${e.playerName}${e.minute !== null ? ` ${e.minute}'` : ""}`)
    .slice(0, 6)
    .join(", ");
  const when = fixture.kickoffAt ? formatWAT(fixture.kickoffAt, "datetime") : "time to be confirmed";
  const description = played
    ? `${state.status === "full_time" ? "Full time" : "Live"}: ${score} in ${fixture.sport.name} at SEES Games 2026.${scorers ? ` Scorers: ${scorers}.` : ""}`
    : `${home} v ${away}, ${fixture.sport.name} at SEES Games 2026. Kick-off ${when}${fixture.venue ? `, ${fixture.venue}` : ""}. Follow it live.`;
  return pageMeta({
    title: played ? `${score} · ${fixture.sport.name}` : `${home} v ${away} · ${fixture.sport.name}`,
    description,
    path: `/matches/${fixture.id}`,
  });
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
  const { fixture, state } = data;
  const base = siteBase();
  const team = (t: typeof fixture.home) => (t ? { "@type": "SportsTeam", name: `${t.name} (${fixture.sport.name})` } : undefined);
  const status =
    state.status === "postponed"
      ? "https://schema.org/EventPostponed"
      : state.status === "cancelled"
        ? "https://schema.org/EventCancelled"
        : "https://schema.org/EventScheduled";
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SportsEvent",
          name: `${fixture.home?.name ?? "TBD"} v ${fixture.away?.name ?? "TBD"} · ${fixture.sport.name}`,
          sport: fixture.sport.name,
          url: `${base}/matches/${fixture.id}`,
          ...(fixture.kickoffAt ? { startDate: fixture.kickoffAt } : {}),
          eventStatus: status,
          eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
          ...(team(fixture.home) ? { homeTeam: team(fixture.home), competitor: [team(fixture.home), team(fixture.away)].filter(Boolean) } : {}),
          ...(team(fixture.away) ? { awayTeam: team(fixture.away) } : {}),
          location: { "@type": "Place", name: fixture.venue ?? "University of Lagos", address: "University of Lagos, Akoka, Lagos, Nigeria" },
          organizer: { "@type": "Organization", name: "SEES, University of Lagos", url: base },
          superEvent: { "@type": "SportsEvent", name: "SEES Games 2026" },
        }}
      />
      <MatchCentre data={data} />
    </>
  );
}
