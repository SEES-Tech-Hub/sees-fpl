import type { FantasyRules, Player, Position } from "./types";

// Formations for the lineup editor's formation buttons. Pure functions, so
// the rules are tested on their own (formations.test.ts).

export type Formation = Record<"DEF" | "MID" | "FWD", number>;

const OUTFIELD = ["DEF", "MID", "FWD"] as const;

export const formationName = (f: Formation) => `${f.DEF}-${f.MID}-${f.FWD}`;

/** Every formation the rules allow that this squad can field, fewest defenders first. */
export function availableFormations(squad: Pick<Player, "position">[], rules: Pick<FantasyRules, "formation" | "startingSize">): Formation[] {
  const have: Record<Position, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const p of squad) have[p.position] += 1;
  const outfield = rules.startingSize - rules.formation.GK.min;
  const out: Formation[] = [];
  const { DEF, MID, FWD } = rules.formation;
  for (let d = DEF.min; d <= Math.min(DEF.max, have.DEF); d++) {
    for (let m = MID.min; m <= Math.min(MID.max, have.MID); m++) {
      const f = outfield - d - m;
      if (f >= FWD.min && f <= Math.min(FWD.max, have.FWD)) out.push({ DEF: d, MID: m, FWD: f });
    }
  }
  return out;
}

/**
 * The lineup (ids, starting XI first, then the bench with its goalkeeper
 * first) rearranged into formation `f`. Bench players come on in bench
 * order; starters go to the bench cheapest first, and armband holders
 * (`keep`) only if nothing else will do. Null if the squad can't field it.
 */
export function applyFormation(
  order: string[],
  byId: Map<string, Pick<Player, "position" | "priceTenths">>,
  xiSize: number,
  f: Formation,
  keep: ReadonlySet<string>,
): { order: string[]; cameIn: string[]; wentOut: string[] } | null {
  const pos = (id: string) => byId.get(id)!.position;
  let xi = order.slice(0, xiSize);
  const bench = order.slice(xiSize);
  const wentOut: string[] = [];
  const cameIn: string[] = [];

  for (const p of OUTFIELD) {
    const mine = xi.filter((id) => pos(id) === p);
    const extra = mine.length - f[p];
    if (extra <= 0) continue;
    const drop = [...mine]
      .sort((a, b) => Number(keep.has(a)) - Number(keep.has(b)) || byId.get(a)!.priceTenths - byId.get(b)!.priceTenths)
      .slice(0, extra);
    xi = xi.filter((id) => !drop.includes(id));
    wentOut.push(...drop);
  }
  for (const p of OUTFIELD) {
    const need = f[p] - xi.filter((id) => pos(id) === p).length;
    if (need <= 0) continue;
    const pick = bench.filter((id) => pos(id) === p && !cameIn.includes(id)).slice(0, need);
    if (pick.length < need) return null;
    cameIn.push(...pick);
    xi = [...xi, ...pick];
  }
  if (xi.length !== xiSize) return null;

  const rest = [...bench.filter((id) => !cameIn.includes(id)), ...wentOut];
  const benchOrder = [...rest.filter((id) => pos(id) === "GK"), ...rest.filter((id) => pos(id) !== "GK")];
  return { order: [...xi, ...benchOrder], cameIn, wentOut };
}
