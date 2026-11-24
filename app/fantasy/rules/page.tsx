import { Suspense, type ReactNode } from "react";
import { ArrowLeftRight, Ban, CalendarClock, Crown, Repeat, ShieldCheck, Sparkles, Users, Wallet } from "lucide-react";
import { CircuitPattern } from "@/components/fantasy/patterns";
import { LoadingPage } from "@/components/fantasy/states";
import { teamColour } from "@/lib/design/team-colour";
import { getFantasyRules, getMatchdayState } from "@/lib/fantasy/api";
import { formatMoney, formatSigned } from "@/lib/fantasy/format";
import { formatWAT } from "@/lib/fantasy/time";
import { POSITIONS, type FantasyRules, type Matchday, type Position, type ScoringKey } from "@/lib/fantasy/types";
import { allowedFormations } from "@/lib/fantasy/validate";
import { pageMeta } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const metadata = pageMeta({
  title: "SEES Fantasy rules",
  description: "How SEES Fantasy works: squad and budget, formations, captains, transfers, the Wildcard, deadlines and how every point is scored.",
  path: "/fantasy/rules",
});

// Public. Every number comes from the rules config (getFantasyRules) or the
// matchdays table, so this page changes when the organisers change a rule.
export default function RulesPage() {
  return (
    <Suspense fallback={<LoadingPage rows={10} />}>
      <Rules />
    </Suspense>
  );
}

const SECTIONS = [
  { id: "squad", label: "Squad" },
  { id: "lineup", label: "Lineup" },
  { id: "deadlines", label: "Deadlines" },
  { id: "transfers", label: "Transfers" },
  { id: "scoring", label: "Scoring" },
  { id: "examples", label: "Examples" },
] as const;

const POSITION_NAME: Record<Position, [string, string]> = {
  GK: ["Goalkeeper", "Goalkeepers"],
  DEF: ["Defender", "Defenders"],
  MID: ["Midfielder", "Midfielders"],
  FWD: ["Forward", "Forwards"],
};

function Section({ id, n, title, intro, children }: { id: string; n: number; title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex scroll-mt-32 flex-col gap-4">
      <div className="flex items-end gap-3">
        <span aria-hidden className="font-heading text-5xl leading-[0.8] font-bold text-brand-light [-webkit-text-stroke:1.5px_var(--brand)]">
          {String(n).padStart(2, "0")}
        </span>
        <div>
          <h2 id={`${id}-title`} className="font-heading text-2xl leading-none font-bold text-brand uppercase">
            {title}
          </h2>
          {intro && <p className="mt-1 text-sm text-muted-foreground">{intro}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Fact({ icon: Icon, children }: { icon: typeof Users; children: ReactNode }) {
  return (
    <li className="flex gap-3 rounded-xl bg-card p-3 text-[0.9375rem] leading-snug shadow-card">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-brand">
        <Icon className="size-[1.125rem]" aria-hidden />
      </span>
      <span className="self-center">{children}</span>
    </li>
  );
}

async function Rules() {
  const [rules, md] = await Promise.all([getFantasyRules(), getMatchdayState()]);
  const sp = rules.squadPositions;
  const f = rules.formation;
  const unlimited = rules.unlimitedTransferMatchdays.map((n) => `Matchday ${n}`).join(" and ");
  const formations = allowedFormations(rules);

  const stats = [
    { label: "Budget", value: formatMoney(rules.budgetTenths) },
    { label: "Squad", value: `${rules.squadSize} players` },
    { label: "Per year", value: `Max ${rules.maxPerTeam}` },
    { label: "Captain", value: `${rules.captainMultiplier}× points` },
  ];

  return (
    <div className="flex flex-col gap-10">
      <header className="relative -mx-4 -mt-4 overflow-hidden bg-pitch px-4 pt-8 pb-6 text-brand-foreground lg:mx-0 lg:mt-0 lg:rounded-2xl lg:px-8">
        <CircuitPattern />
        <div className="relative">
          <p className="text-xs font-semibold tracking-[0.08em] text-brand-light uppercase">SEES Fantasy · Rules</p>
          <h1 className="mt-2 font-heading text-display font-bold uppercase">How it works</h1>
          <p className="mt-2 max-w-lg text-[0.9375rem] text-brand-foreground/85">
            Official FPL, scaled down for five year teams. Pick a squad, start eleven, captain one, and score from every SEES
            football match.
          </p>
          <dl className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl bg-brand-foreground/10 px-3 py-2.5 ring-1 ring-brand-light/15">
                <dt className="text-[0.6875rem] font-semibold tracking-[0.06em] text-brand-light uppercase">{s.label}</dt>
                <dd className="font-heading text-xl font-bold tabular-nums">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </header>

      <nav aria-label="On this page" className="-mx-4 -mt-6 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:px-0">
        <ul className="flex gap-2">
          {SECTIONS.map((s, i) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="flex h-9 items-center gap-1.5 rounded-full bg-card px-3.5 text-sm font-semibold whitespace-nowrap shadow-card transition-colors hover:bg-secondary"
              >
                <span className="font-heading text-xs text-muted-foreground tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <Section id="squad" n={1} title="Your squad" intro={`${rules.squadSize} players, ${formatMoney(rules.budgetTenths)} to spend.`}>
        <ul className="grid grid-cols-4 gap-2">
          {POSITIONS.map((p) => (
            <li key={p} className="flex flex-col items-center gap-1 rounded-xl bg-card px-1 py-3 text-center shadow-card">
              <span className="font-heading text-3xl leading-none font-bold text-brand tabular-nums">{sp[p]}</span>
              <span className="text-xs font-semibold text-muted-foreground">{POSITION_NAME[p][sp[p] === 1 ? 0 : 1]}</span>
            </li>
          ))}
        </ul>
        <ul className="grid gap-2 sm:grid-cols-2">
          <Fact icon={Users}>
            At most <strong>{rules.maxPerTeam} players</strong> from any one year.
          </Fact>
          <Fact icon={Wallet}>Prices are set by the organisers and don&apos;t change during the games.</Fact>
          <Fact icon={Ban}>Injured, suspended and departed players are flagged in red.</Fact>
          <Fact icon={ShieldCheck}>Your team is saved to your Google account, so it follows you to any phone.</Fact>
        </ul>
      </Section>

      <Section id="lineup" n={2} title="Your lineup" intro={`${rules.startingSize} start, ${rules.benchSize} on the bench.`}>
        <div className="rounded-xl bg-card p-4 shadow-card">
          <p className="text-[0.9375rem]">
            {f.GK.min} goalkeeper, {f.DEF.min}–{f.DEF.max} defenders, {f.MID.min}–{f.MID.max} midfielders and {f.FWD.min}–
            {f.FWD.max} forwards. Change formation by swapping players between the pitch and the bench.
          </p>
          <p className="mt-3 text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">{formations.length} formations allowed</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {formations.map((x) => (
              <li key={x} className="rounded-lg bg-pitch px-2.5 py-1 font-heading text-base font-bold text-brand-light tabular-nums">
                {x}
              </li>
            ))}
          </ul>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          <Fact icon={Crown}>
            Your <strong>captain</strong> scores {rules.captainMultiplier}× points. If they don&apos;t play, your vice-captain
            does instead.
          </Fact>
          <Fact icon={Repeat}>
            If a starter doesn&apos;t play, the first bench player who did comes on, as long as the formation stays valid.
            Goalkeepers only swap with goalkeepers.
          </Fact>
        </ul>
      </Section>

      <Section
        id="deadlines"
        n={3}
        title="Deadlines"
        intro={`${rules.deadlineMinutesBeforeKickoff} minutes before each matchday's first kickoff. Times are WAT.`}
      >
        {md.matchdays.length > 0 && <DeadlineTimeline matchdays={md.matchdays} nextId={md.next?.id ?? null} />}
        <p className="text-sm text-muted-foreground">At the deadline, teams lock and everyone&apos;s picks can be seen.</p>
      </Section>

      <Section id="transfers" n={4} title="Transfers and Wildcard">
        <div className="grid gap-2 sm:grid-cols-3">
          <TransferCard icon={ArrowLeftRight} value={String(rules.freeTransfersPerMatchday)} label="free transfer each matchday" />
          <TransferCard icon={CalendarClock} value={String(rules.maxSavedFreeTransfers)} label="the most you can save up" />
          <TransferCard icon={Ban} value={formatSigned(-rules.transferHitPoints)} label="points for each extra transfer" />
        </div>
        <ul className="grid gap-2">
          {unlimited && (
            <Fact icon={Sparkles}>
              Before <strong>{unlimited}</strong>, transfers are unlimited and free.
            </Fact>
          )}
          <Fact icon={ArrowLeftRight}>Players are swapped for one in the same position.</Fact>
        </ul>
        <div className="relative overflow-hidden rounded-xl bg-highlight p-4 text-highlight-foreground shadow-card">
          <Sparkles aria-hidden className="absolute -top-3 -right-3 size-20 opacity-15" />
          <p className="font-heading text-xl font-bold uppercase">The Wildcard</p>
          <p className="mt-1 text-[0.9375rem]">
            You get {rules.wildcardsPerManager === 1 ? "one" : rules.wildcardsPerManager}. Play it before a deadline to make
            unlimited free transfers for that matchday: a full rebuild with no points lost.
          </p>
        </div>
      </Section>

      <Section id="scoring" n={5} title="Scoring" intro="Points per player, by position.">
        <ScoringTable rules={rules} />
        <ul className="grid gap-1.5 text-sm text-muted-foreground">
          {[
            "Minutes come from the officials' kickoff, substitution and full-time entries.",
            "Extra time counts. Penalty shootouts don't.",
            "A walkover gives no points to anyone in that match.",
            "Players whose team doesn't play that matchday score 0, and auto-subs apply.",
            "Points are provisional during matches and final once the organisers finalise the matchday.",
          ].map((t) => (
            <li key={t} className="flex gap-2">
              <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" />
              {t}
            </li>
          ))}
        </ul>
      </Section>

      <Section id="examples" n={6} title="Worked examples">
        <WorkedExamples rules={rules} />
      </Section>
    </div>
  );
}

function TransferCard({ icon: Icon, value, label }: { icon: typeof Users; value: string; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-card p-3 shadow-card sm:flex-col sm:items-start">
      <Icon className="size-5 text-brand" aria-hidden />
      <span className="font-heading text-3xl leading-none font-bold tabular-nums">{value}</span>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}

const yearOf = (short: string | null) => {
  const n = Number(short?.replace(/\D/g, ""));
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
};

function Side({ short }: { short: string | null }) {
  return (
    <span
      className="inline-flex size-6 items-center justify-center rounded-full font-heading text-[0.625rem] font-bold text-team-foreground"
      style={{ background: teamColour(yearOf(short)) }}
    >
      {short ?? "?"}
    </span>
  );
}

const stageName = (stage: string) => (stage === "final" ? "Final" : stage === "third_place" ? "Third place" : "TBD");

/** Each matchday as a stop on a line: its deadline and matches; the next one ringed. */
function DeadlineTimeline({ matchdays, nextId }: { matchdays: Matchday[]; nextId: string | null }) {
  return (
    <ol className="relative flex flex-col gap-2 pl-6 before:absolute before:top-3 before:bottom-3 before:left-[0.4375rem] before:w-0.5 before:rounded-full before:bg-border">
      {matchdays.map((m) => {
        const isNext = m.id === nextId;
        const past = m.status === "locked" || m.status === "finalised";
        return (
          <li key={m.id} className="relative">
            <span
              aria-hidden
              className={cn(
                "absolute top-4 -left-6 size-4 rounded-full border-2",
                isNext ? "border-brand bg-brand-light ring-4 ring-brand-light/40" : past ? "border-border bg-muted" : "border-brand bg-card",
              )}
            />
            <div className={cn("rounded-xl bg-card p-3 shadow-card", isNext && "ring-2 ring-brand", past && "opacity-60")}>
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-heading text-lg font-bold">
                  Matchday {m.number}
                  {isNext && (
                    <span className="ml-2 rounded-full bg-brand-light px-2 py-0.5 align-middle font-sans text-[0.6875rem] font-bold text-brand uppercase">
                      Next
                    </span>
                  )}
                </p>
                <p className="text-right text-sm font-semibold tabular-nums">{formatWAT(m.deadlineAt)}</p>
              </div>
              <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                {m.fixtures.length === 0 && <li className="text-sm text-muted-foreground">Fixtures to be confirmed</li>}
                {m.fixtures.map((x) => (
                  <li key={x.id} className="flex items-center gap-1.5 text-sm">
                    {x.homeShort || x.awayShort ? (
                      <>
                        <Side short={x.homeShort} />
                        <span className="text-xs text-muted-foreground">v</span>
                        <Side short={x.awayShort} />
                      </>
                    ) : (
                      <span className="text-muted-foreground">{stageName(x.stage)}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function ScoringTable({ rules }: { rules: FantasyRules }) {
  return (
    <div className="overflow-x-auto rounded-xl bg-card shadow-card">
      <table className="w-full min-w-[20rem] text-sm">
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">
              Action
            </th>
            {POSITIONS.map((p) => (
              <th key={p} scope="col" className="w-12 px-1 py-2.5 text-center">
                <span className="inline-block rounded-md bg-pitch px-1.5 py-0.5 font-heading text-xs font-bold text-brand-light">{p}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rules.scoring.map((r) => (
            <tr key={r.key} className="border-b border-border align-top last:border-b-0 even:bg-muted/40">
              <td className="px-3 py-2.5">
                <span className="font-medium">{r.label}</span>
                {r.note && <span className="block text-xs text-muted-foreground">{r.note}</span>}
              </td>
              {POSITIONS.map((p) => {
                const v = r.points[p];
                return (
                  <td
                    key={p}
                    className={cn(
                      "px-1 py-2.5 text-center font-heading text-base font-bold tabular-nums",
                      v > 0 ? "text-brand" : v < 0 ? "text-destructive" : "text-muted-foreground/50",
                    )}
                  >
                    {v === 0 ? "–" : formatSigned(v)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Three worked examples (from docs/fantasy-scoring-examples.md E1, E2, E15c).
 * The numbers come from the rules config, so they follow any rule change.
 */
function WorkedExamples({ rules }: { rules: FantasyRules }) {
  const pts = (key: ScoringKey, pos: Position) => rules.scoring.find((r) => r.key === key)?.points[pos] ?? 0;
  const ex1 = [
    ["Appeared", pts("appeared", "FWD")],
    ["Played 30+ min", pts("played_30", "FWD")],
    ["Goal", pts("goal", "FWD")],
    ["Assist", pts("assist", "FWD")],
  ] as const;
  const ex1Total = ex1.reduce((s, [, p]) => s + p, 0);
  const ex2 = [
    ["Appeared", pts("appeared", "DEF")],
    ["Played 30+ min", pts("played_30", "DEF")],
    ["Goal", pts("goal", "DEF")],
    ["Clean sheet", pts("clean_sheet", "DEF")],
  ] as const;
  const ex2Total = ex2.reduce((s, [, p]) => s + p, 0);
  const extra = 2;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <ExampleCard
        title="Captain forward"
        story="A Year 5 forward is your captain. They play all 50 minutes, score once and assist once."
        lines={ex1.map(([label, p]) => [label, formatSigned(p)])}
        total={`${ex1Total} × ${rules.captainMultiplier} = ${ex1Total * rules.captainMultiplier} pts`}
      />
      <ExampleCard
        title="Defender clean sheet"
        story="A defender plays all 50 minutes, scores, and their team concedes nothing."
        lines={ex2.map(([label, p]) => [label, formatSigned(p)])}
        total={`${ex2Total} pts`}
      />
      <ExampleCard
        title="Transfer hit"
        story={`You have ${rules.freeTransfersPerMatchday} free transfer and make ${rules.freeTransfersPerMatchday + extra}.`}
        lines={[
          ["Extra transfers", String(extra)],
          ["Cost each", formatSigned(-rules.transferHitPoints)],
        ]}
        total={`−${extra * rules.transferHitPoints} pts`}
      />
    </div>
  );
}

function ExampleCard({ title, story, lines, total }: { title: string; story: string; lines: (readonly [string, string])[]; total: string }) {
  return (
    <article className="flex flex-col gap-2 rounded-xl bg-card p-4 text-sm shadow-card">
      <h3 className="font-heading text-lg font-bold">{title}</h3>
      <p className="text-muted-foreground">{story}</p>
      <dl className="flex flex-col">
        {lines.map(([label, value]) => (
          <div key={label} className="flex justify-between border-t border-border py-1.5">
            <dt>{label}</dt>
            <dd className="font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-auto rounded-lg bg-pitch px-3 py-2 text-right font-heading text-2xl font-bold text-brand-light tabular-nums">{total}</p>
    </article>
  );
}
