import { Suspense, type ReactNode } from "react";
import { LoadingPage, PageHeader } from "@/components/fantasy/states";
import { getFantasyRules, getMatchdayState } from "@/lib/fantasy/api";
import { formatMoney, formatSigned } from "@/lib/fantasy/format";
import { formatWAT } from "@/lib/fantasy/time";
import { POSITIONS } from "@/lib/fantasy/types";
import { allowedFormations } from "@/lib/fantasy/validate";

export const metadata = { title: "Fantasy rules" };

// Public. Every number comes from the rules config (getFantasyRules) or the
// matchdays table, so this page changes when the organisers change a rule.
export default function RulesPage() {
  return (
    <>
      <PageHeader title="Rules" description="How SEES Fantasy works. Based on official FPL, scaled down for five teams." />
      <Suspense fallback={<LoadingPage rows={10} />}>
        <Rules />
      </Suspense>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-heading text-lg font-semibold text-brand">{title}</h2>
      <div className="flex flex-col gap-2 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

async function Rules() {
  const [rules, md] = await Promise.all([getFantasyRules(), getMatchdayState()]);
  const sp = rules.squadPositions;
  const f = rules.formation;
  const unlimited = rules.unlimitedTransferMatchdays.map((n) => `Matchday ${n}`).join(" and ");

  return (
    <div className="flex flex-col gap-6">
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
