import { Suspense, type ReactNode } from "react";
import { LoadingPage, PageHeader } from "@/components/fantasy/states";
import { getFantasyRules, getMatchdayState } from "@/lib/fantasy/api";
import { formatMoney, formatSigned } from "@/lib/fantasy/format";
import { formatWAT } from "@/lib/fantasy/time";
import { POSITIONS, type FantasyRules, type Position, type ScoringKey } from "@/lib/fantasy/types";
import { allowedFormations } from "@/lib/fantasy/validate";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  title: "SEES Fantasy rules",
  description: "How SEES Fantasy works: squad and budget, formations, captains, transfers, the Wildcard, deadlines and how every point is scored.",
  path: "/fantasy/rules",
});

// Public. Every number comes from the rules config (getFantasyRules) or the
// matchdays table, so this page changes when the organisers change a rule.
export default function RulesPage() {
  return (
    <>
      <PageHeader caption="SEES Fantasy" title="Rules" description="How SEES Fantasy works. Based on official FPL, scaled down for five teams." />
      <Suspense fallback={<LoadingPage rows={10} />}>
        <Rules />
      </Suspense>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-heading text-[1.375rem] leading-[1.15] font-semibold">{title}</h2>
      <div className="flex flex-col gap-2 text-base leading-normal">{children}</div>
    </section>
  );
}

async function Rules() {
  const [rules, md] = await Promise.all([getFantasyRules(), getMatchdayState()]);
  const sp = rules.squadPositions;
  const f = rules.formation;
  const unlimited = rules.unlimitedTransferMatchdays.map((n) => `Matchday ${n}`).join(" and ");

  return (
    <div className="flex flex-col gap-8">
      <Section title="Your squad">
        <p>
          Pick {rules.squadSize} players: {sp.GK} goalkeepers, {sp.DEF} defenders, {sp.MID} midfielders and {sp.FWD}{" "}
          forwards, with a budget of {formatMoney(rules.budgetTenths)}. You can have at most {rules.maxPerTeam}{" "}
          players from one year. Prices are set by the organisers and don&apos;t change.
        </p>
        <p>Players who are injured, suspended or have left the squad are flagged in red.</p>
      </Section>

      <Section title="Your lineup">
        <p>
          Each matchday, {rules.startingSize} players start: {f.GK.min} goalkeeper, {f.DEF.min}–{f.DEF.max} defenders,{" "}
          {f.MID.min}–{f.MID.max} midfielders and {f.FWD.min}–{f.FWD.max} forwards. Allowed formations:{" "}
          {allowedFormations(rules).join(", ")}.
        </p>
        <p>
          The other {rules.benchSize} sit on the bench. If a starter doesn&apos;t play, the first bench player who did
          comes on, as long as the formation stays valid. A goalkeeper is only replaced by a goalkeeper.
        </p>
        <p>
          Your captain scores {rules.captainMultiplier}× points. If the captain doesn&apos;t play, the vice-captain
          scores {rules.captainMultiplier}× instead.
        </p>
      </Section>

      <Section title="Deadlines">
        <p>
          Each matchday&apos;s deadline is {rules.deadlineMinutesBeforeKickoff} minutes before its first kickoff. After it,
          teams lock and everyone&apos;s picks can be seen. All times are WAT.
        </p>
        {md.matchdays.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Matchday</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Matches</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Deadline</th>
                </tr>
              </thead>
              <tbody>
                {md.matchdays.map((m) => (
                  <tr key={m.id} className="border-t border-border align-top">
                    <td className="px-3 py-2 font-medium">{m.number}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {m.fixtures.length === 0
                        ? "TBC"
                        : m.fixtures.map((x) => `${x.homeShort ?? "TBD"} v ${x.awayShort ?? "TBD"}`).join(", ")}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatWAT(m.deadlineAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Transfers and Wildcard">
        <p>Before {unlimited}, transfers are unlimited and free.</p>
        <p>
          Otherwise you get {rules.freeTransfersPerMatchday} free transfer per matchday, and can save up to{" "}
          {rules.maxSavedFreeTransfers}. Each extra transfer costs {rules.transferHitPoints} points from that
          matchday&apos;s score. Players are swapped for one in the same position.
        </p>
        <p>
          You have {rules.wildcardsPerManager === 1 ? "one Wildcard" : `${rules.wildcardsPerManager} Wildcards`}: play it
          to make unlimited free transfers for one matchday.
        </p>
      </Section>

      <Section title="Worked examples">
        <WorkedExamples rules={rules} />
      </Section>

      <Section title="Scoring">
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[20rem] text-sm">
            <thead className="bg-muted text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium">Event</th>
                {POSITIONS.map((p) => (
                  <th key={p} scope="col" className="w-11 px-1 py-2 text-right font-medium">
                    {p}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rules.scoring.map((r) => (
                <tr key={r.key} className="border-t border-border align-top">
                  <td className="px-3 py-2">
                    {r.label}
                    {r.note && <span className="block text-xs text-muted-foreground">{r.note}</span>}
                  </td>
                  {POSITIONS.map((p) => (
                    <td key={p} className="px-1 py-2 text-right tabular-nums">
                      {formatSigned(r.points[p])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="list-disc pl-5">
          <li>Minutes come from the match officials&apos; kickoff, substitution and full-time entries.</li>
          <li>Extra time counts. Penalty shootouts don&apos;t.</li>
          <li>A walkover gives no points to anyone in that match.</li>
          <li>Players whose team doesn&apos;t play that matchday score 0, and auto-subs apply.</li>
          <li>Points are provisional during matches and final once the organisers finalise the matchday.</li>
        </ul>
      </Section>
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
      <h3 className="text-[1.0625rem] font-semibold">{title}</h3>
      <p className="text-muted-foreground">{story}</p>
      <dl className="flex flex-col">
        {lines.map(([label, value]) => (
          <div key={label} className="flex justify-between border-t border-border py-1.5">
            <dt>{label}</dt>
            <dd className="font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-auto border-t-2 border-foreground pt-2 text-right font-heading text-2xl font-bold tabular-nums">{total}</p>
    </article>
  );
}
