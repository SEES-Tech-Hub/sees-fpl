import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftRight, BookOpen, ChevronRight, Shirt, Trophy, Users } from "lucide-react";
import { DeadlineCard } from "@/components/fantasy/deadline-card";
import { CircuitPattern } from "@/components/fantasy/patterns";
import { LoadingPitch } from "@/components/fantasy/states";
import { Button } from "@/components/ui/button";
import {
  getFantasyRules,
  getMatchdayHistory,
  getMatchdayState,
  getMyManager,
  getMyTeam,
  getOptionalFantasyUser,
  getRankings,
} from "@/lib/fantasy/api";
import { formatMoney, ordinal } from "@/lib/fantasy/format";

export const metadata = { title: "Fantasy" };

// Design system §12.5. Signed out: a hero. No team: onboarding. With a team:
// deadline, latest points, overall rank and quick links.
export default function FantasyHome() {
  return (
    <Suspense fallback={<LoadingPitch />}>
      <Home />
    </Suspense>
  );
}

async function Home() {
  const user = await getOptionalFantasyUser();
  if (!user) return <SignedOutHero />;
  const manager = await getMyManager(user);
  if (!manager) redirect("/fantasy/squad");
  const team = await getMyTeam(user);
  if (!team) redirect("/fantasy/squad");

  const [md, history, ranking] = await Promise.all([
    getMatchdayState(),
    getMatchdayHistory(user, user.id),
    getRankings(user, { kind: "overall" }, 1, 1),
  ]);
  const latest = history[history.length - 1];

  return (
    <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[1fr_20rem] lg:items-start lg:gap-6">
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">SEES Fantasy</p>
          <h1 className="font-heading text-[1.75rem] leading-[1.1] font-semibold text-brand dark:text-foreground">
            {manager.teamName}
          </h1>
        </div>
        {md.next ? (
          <DeadlineCard
            matchdayName={md.next.name}
            matchdayNumber={md.next.number}
            deadlineAt={md.next.deadlineAt}
            serverNow={md.serverNow}
            action={md.current ? { href: "/fantasy/transfers", label: "Make transfers" } : { href: "/fantasy/team", label: "Pick your team" }}
          />
        ) : (
          <p className="rounded-xl bg-muted px-4 py-3 text-sm">The season is over. Thanks for playing.</p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/fantasy/points" className="rounded-xl bg-pitch p-4 text-brand-foreground shadow-card dark:text-foreground">
            <p className="text-xs font-semibold tracking-[0.06em] text-brand-light uppercase dark:text-brand">
              {latest ? `Matchday ${latest.matchdayNumber}` : "Points"}
            </p>
            <p className="font-heading text-display font-bold tabular-nums">{latest ? latest.points : "–"}</p>
            <p className="text-xs opacity-80">{latest?.provisional ? "Provisional" : latest ? "pts" : "After the first deadline"}</p>
          </Link>
          <Link href="/fantasy/rankings" className="rounded-xl bg-card p-4 shadow-card">
            <p className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Overall rank</p>
            <p className="font-heading text-display font-bold tabular-nums">{ranking.me ? ordinal(ranking.me.rank) : "–"}</p>
            <p className="text-xs text-muted-foreground">of {ranking.totalManagers}</p>
          </Link>
        </div>
      </div>
      <nav aria-label="Quick links" className="lg:sticky lg:top-4">
        <ul className="rounded-xl bg-card shadow-card">
          {[
            { href: "/fantasy/team", label: "My team", sub: `${formatMoney(team.bankTenths)} in the bank`, icon: Shirt },
            { href: "/fantasy/transfers", label: "Transfers", sub: "Swap players before the deadline", icon: ArrowLeftRight },
            { href: "/fantasy/leagues", label: "Leagues", sub: "Play your friends", icon: Users },
            { href: "/fantasy/rankings", label: "Rankings", sub: "Overall and by year", icon: Trophy },
            { href: "/fantasy/rules", label: "Rules", sub: "How points work", icon: BookOpen },
          ].map(({ href, label, sub, icon: Icon }) => (
            <li key={href} className="border-b border-border last:border-b-0">
              <Link href={href} className="flex min-h-14 items-center gap-3 px-4 py-2">
                <Icon className="size-5 text-brand dark:text-brand" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.9375rem] font-semibold">{label}</span>
                  <span className="block truncate text-[0.8125rem] text-muted-foreground">{sub}</span>
                </span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

async function SignedOutHero() {
  const rules = await getFantasyRules();
  const steps = [
    `Pick ${rules.squadSize} players`,
    "Set your captain",
    "Score every matchday",
  ];
  return (
    <section className="relative -mx-4 -mt-4 overflow-hidden bg-pitch px-4 pt-10 pb-12 text-brand-foreground dark:text-foreground">
      <CircuitPattern />
      <span className="absolute top-6 right-5 rotate-[-8deg] rounded-full bg-highlight px-3 py-1 font-heading text-lg font-bold text-highlight-foreground shadow-raised">
        FREE
      </span>
      <div className="relative mx-auto max-w-2xl">
        <p className="text-xs font-semibold tracking-[0.06em] text-brand-light uppercase dark:text-brand">SEES Fantasy 2026</p>
        <h1 className="mt-2 font-heading text-display font-bold uppercase">Pick your SEES XI</h1>
        <ol className="mt-6 flex flex-col gap-3">
          {steps.map((s, i) => (
            <li key={s} className="flex items-center gap-3 text-[0.9375rem]">
              <span className="flex size-8 items-center justify-center rounded-full bg-brand-light font-heading font-bold text-brand">
                {i + 1}
              </span>
              {s}
            </li>
          ))}
        </ol>
        <Button asChild size="lg" className="mt-8 h-12 w-full bg-brand-light text-base text-brand hover:bg-brand-light/90 sm:w-auto sm:px-8">
          <Link href="/login?next=/fantasy">Sign in with Google</Link>
        </Button>
        <p className="mt-4 text-sm">
          <Link href="/fantasy/rankings" className="underline underline-offset-4">
            See the rankings
          </Link>{" "}
          ·{" "}
          <Link href="/fantasy/rules" className="underline underline-offset-4">
            Read the rules
          </Link>
        </p>
      </div>
    </section>
  );
}
