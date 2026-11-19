"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Lock } from "lucide-react";
import { toast } from "sonner";
import { saveLineupAction } from "@/app/fantasy/actions";
import { DeadlineCountdown } from "@/components/fantasy/deadline-countdown";
import { PitchCard, PitchRow } from "@/components/fantasy/pitch-card";
import { StatusFlag } from "@/components/fantasy/player-bits";
import { InlineError } from "@/components/fantasy/states";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ERROR_COPY } from "@/lib/fantasy/errors";
import { formatMoney, POSITION_LABEL } from "@/lib/fantasy/format";
import { POSITIONS, type FantasyRules, type Player } from "@/lib/fantasy/types";
import { formationIssue, formationLabel } from "@/lib/fantasy/validate";
import { cn } from "@/lib/utils";

type Props = {
  squad: Player[]; // 15 players in slot order
  captainId: string | null;
  viceId: string | null;
  rules: FantasyRules;
  locked: boolean;
  deadlineAt: string | null;
  fixtureByTeam: Record<string, string>;
};

export function LineupEditor(props: Props) {
  const { rules, fixtureByTeam } = props;
  const router = useRouter();
  const xiSize = rules.startingSize;
  const [order, setOrder] = useState(() => props.squad.map((p) => p.id));
  const [captain, setCaptain] = useState(props.captainId);
  const [vice, setVice] = useState(props.viceId);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [swapFrom, setSwapFrom] = useState<string | null>(null);
  const [locked, setLocked] = useState(props.locked);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const byId = new Map(props.squad.map((p) => [p.id, p]));
  const players = order.map((id) => byId.get(id)!);
  const xi = players.slice(0, xiSize);
  const bench = players.slice(xiSize);
  const changed =
    order.join() !== props.squad.map((p) => p.id).join() || captain !== props.captainId || vice !== props.viceId;
  const formationProblem = formationIssue(xi, rules);
  const captainProblem =
    !captain || !vice || captain === vice || !xi.some((p) => p.id === captain) || !xi.some((p) => p.id === vice)
      ? "Pick a captain and a different vice-captain from your starting XI."
      : null;

  const onPassed = useCallback(() => {
    setLocked(true);
    setSwapFrom(null);
    setMenuFor(null);
    router.refresh();
  }, [router]);

  /** The order after swapping a and b, or null if the swap isn't allowed. */
  function swapped(a: string, b: string): string[] | null {
    if (a === b) return null;
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    const pa = byId.get(a)!;
    const pb = byId.get(b)!;
    const aStarts = ia < xiSize;
    const bStarts = ib < xiSize;
    if (aStarts && bStarts) return null; // swapping two starters changes nothing
    // Goalkeepers only swap with goalkeepers, and the bench GK slot stays a GK.
    if ((pa.position === "GK") !== (pb.position === "GK")) return null;
    const next = [...order];
    next[ia] = b;
    next[ib] = a;
    if (aStarts !== bStarts && formationIssue(next.slice(0, xiSize).map((id) => byId.get(id)!), rules)) return null;
    return next;
  }

  function doSwap(target: string) {
    if (!swapFrom) return;
    const next = swapped(swapFrom, target);
    if (!next) {
      toast.error("That swap would break your formation.");
      return;
    }
    // A captain or vice moving to the bench hands the armband to whoever comes in.
    const benched = order.slice(0, xiSize).find((id) => !next.slice(0, xiSize).includes(id));
    const promoted = next.slice(0, xiSize).find((id) => !order.slice(0, xiSize).includes(id));
    if (benched && promoted) {
      if (benched === captain) setCaptain(promoted);
      if (benched === vice) setVice(promoted);
    }
    setOrder(next);
    setSwapFrom(null);
    setError(null);
  }

  function tap(id: string) {
    if (locked) return;
    if (swapFrom) {
      if (id === swapFrom) setSwapFrom(null);
      else doSwap(id);
      return;
    }
    setMenuFor(id);
  }

  function makeCaptain(id: string) {
    if (id === vice) setVice(captain);
    setCaptain(id);
    setMenuFor(null);
    setError(null);
  }

  function makeVice(id: string) {
    if (id === captain) setCaptain(vice);
    setVice(id);
    setMenuFor(null);
    setError(null);
  }

  function save() {
    if (!captain || !vice) return;
    startSaving(async () => {
      try {
        const result = await saveLineupAction({
          starters: order.slice(0, xiSize),
          bench: order.slice(xiSize),
          captainId: captain,
          viceCaptainId: vice,
        });
        if (!result.ok) {
          setError(result.error.message);
          toast.error(result.error.message);
          if (result.error.code === "DEADLINE_PASSED") onPassed();
          return;
        }
        toast.success("Lineup saved");
        router.refresh();
      } catch {
        setError(ERROR_COPY.UNKNOWN);
        toast.error(ERROR_COPY.UNKNOWN);
      }
    });
  }

  function reset() {
    setOrder(props.squad.map((p) => p.id));
    setCaptain(props.captainId);
    setVice(props.viceId);
    setSwapFrom(null);
    setError(null);
  }

  const sub = (p: Player) => fixtureByTeam[p.teamId] ?? "No match";
  const menuPlayer = menuFor ? byId.get(menuFor) : undefined;
  const menuStarts = menuFor ? order.indexOf(menuFor) < xiSize : false;

  const card = (p: Player) => {
    const isTarget = swapFrom !== null && p.id !== swapFrom && swapped(swapFrom, p.id) !== null;
    return (
      <PitchCard
        key={p.id}
        player={p}
        sub={sub(p)}
        badge={p.id === captain ? "C" : p.id === vice ? "V" : null}
        selected={p.id === swapFrom}
        target={isTarget}
        dimmed={swapFrom !== null && p.id !== swapFrom && !isTarget}
        flagged={p.status !== "available"}
        onClick={locked ? undefined : () => tap(p.id)}
      />
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <DeadlineCountdown
        deadlineAt={props.deadlineAt}
        label={locked ? "Deadline passed" : "Deadline"}
        onPassed={onPassed}
      />

      {locked ? (
        <p className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
          <Lock className="size-4 shrink-0" />
          Your team is locked for this matchday. You can change it again once the next matchday opens.
        </p>
      ) : swapFrom ? (
        <div className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm" role="status">
          <ArrowLeftRight className="size-4 shrink-0" />
          <span className="flex-1">
            Tap who swaps with <strong>{byId.get(swapFrom)?.displayName}</strong>
          </span>
          <Button variant="ghost" className="h-10" onClick={() => setSwapFrom(null)}>
            Cancel
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Tap a player to make them captain or to substitute them.</p>
      )}

      <section aria-label="Starting XI" className="flex flex-col gap-2 rounded-xl bg-brand p-3">
        <p className="text-center text-xs font-medium text-brand-foreground/80">{formationLabel(xi)}</p>
        {POSITIONS.map((pos) => {
          const row = xi.filter((p) => p.position === pos);
          return (
            <PitchRow key={pos} count={row.length}>
              {row.map(card)}
            </PitchRow>
          );
        })}
      </section>

      <section aria-label="Bench" className="rounded-xl border border-border bg-muted p-3">
        <p className="mb-2 text-xs text-muted-foreground">Bench: auto-subs come on left to right (GK replaces GK only)</p>
        <div className="grid grid-cols-4 gap-1.5">
          {bench.map((p, i) => (
            <div key={p.id} className="flex min-w-0 flex-col gap-1">
              <span className="text-center text-[0.65rem] font-medium text-muted-foreground">{i === 0 ? "GK" : i}</span>
              {card(p)}
            </div>
          ))}
        </div>
      </section>

      {error && <InlineError title="Lineup not saved" message={error} />}
      {!locked && (formationProblem || captainProblem) && (
        <p className="text-sm text-destructive">{formationProblem ?? captainProblem}</p>
      )}

      {!locked && changed && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-2xl gap-3">
            <Button variant="outline" size="lg" className="h-11 flex-1" onClick={reset} disabled={saving}>
              Undo changes
            </Button>
            <Button
              size="lg"
              className="h-11 flex-1"
              onClick={save}
              disabled={saving || Boolean(formationProblem || captainProblem)}
            >
              {saving ? "Saving…" : "Save lineup"}
            </Button>
          </div>
        </div>
      )}

      <Drawer open={menuPlayer !== undefined} onOpenChange={(open) => !open && setMenuFor(null)}>
        <DrawerContent>
          {menuPlayer && (
            <>
              <DrawerHeader>
                <DrawerTitle className="flex items-center justify-center gap-2">
                  {menuPlayer.displayName} <StatusFlag status={menuPlayer.status} />
                </DrawerTitle>
                <DrawerDescription>
                  {POSITION_LABEL[menuPlayer.position]} · {menuPlayer.teamShort} · {formatMoney(menuPlayer.priceTenths)} ·{" "}
                  {sub(menuPlayer)}
                </DrawerDescription>
              </DrawerHeader>
              <DrawerFooter>
                {menuStarts && (
                  <>
                    <Button
                      size="lg"
                      className="h-12"
                      disabled={menuPlayer.id === captain}
                      onClick={() => makeCaptain(menuPlayer.id)}
                    >
                      {menuPlayer.id === captain ? "Captain" : "Make captain"}
                    </Button>
                    <Button
                      size="lg"
                      variant="secondary"
                      className="h-12"
                      disabled={menuPlayer.id === vice}
                      onClick={() => makeVice(menuPlayer.id)}
                    >
                      {menuPlayer.id === vice ? "Vice-captain" : "Make vice-captain"}
                    </Button>
                  </>
                )}
                <Button
                  size="lg"
                  variant="outline"
                  className={cn("h-12")}
                  onClick={() => {
                    setSwapFrom(menuPlayer.id);
                    setMenuFor(null);
                  }}
                >
                  <ArrowLeftRight /> {menuStarts ? "Substitute" : "Bring on or reorder bench"}
                </Button>
              </DrawerFooter>
            </>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
