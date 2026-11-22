"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeftRight, Lock } from "lucide-react";
import { toast } from "sonner";
import { saveLineupAction } from "@/app/fantasy/actions";
import { DeadlineCard } from "@/components/fantasy/deadline-card";
import { BenchTray, Pitch, PitchRow } from "@/components/fantasy/pitch";
import { PlayerChip } from "@/components/fantasy/player-chip";
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
import { formatMoney, POSITION_LABEL, POSITION_PLURAL } from "@/lib/fantasy/format";
import type { FantasyRules, Player, Position } from "@/lib/fantasy/types";
import { formationIssue, formationLabel } from "@/lib/fantasy/validate";
import { cn } from "@/lib/utils";

const PITCH_ORDER: Position[] = ["FWD", "MID", "DEF", "GK"];

type Props = {
  squad: Player[]; // 15 players in slot order
  captainId: string | null;
  viceId: string | null;
  rules: FantasyRules;
  locked: boolean;
  deadlineAt: string | null;
  serverNow: number;
  matchdayName: string;
  matchdayNumber: number;
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

  const chip = (p: Player) => {
    const isTarget = swapFrom !== null && p.id !== swapFrom && swapped(swapFrom, p.id) !== null;
    return (
      <PlayerChip
        key={p.id}
        player={p}
        tag={sub(p)}
        captain={p.id === captain}
        vice={p.id === vice}
        selected={p.id === swapFrom}
        target={isTarget}
        dimmed={swapFrom !== null && p.id !== swapFrom && !isTarget}
        onClick={locked ? undefined : () => tap(p.id)}
      />
    );
  };

  return (
    <div className={cn("flex flex-col gap-3", !locked && changed && "pb-24")}>
      <DeadlineCard
        matchdayName={props.matchdayName}
        matchdayNumber={props.matchdayNumber}
        deadlineAt={props.deadlineAt}
        serverNow={props.serverNow}
        onPassed={onPassed}
      />

      {locked ? (
        <p className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
          <Lock className="size-4 shrink-0" />
          Deadline passed. Your team is locked for Matchday {props.matchdayNumber}.
        </p>
      ) : swapFrom ? (
        <div className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-1 text-sm" role="status">
          <ArrowLeftRight className="size-4 shrink-0" />
          <span className="flex-1">
            Tap a glowing player to swap with <strong>{byId.get(swapFrom)?.displayName}</strong>
          </span>
          <Button variant="ghost" className="h-11" onClick={() => setSwapFrom(null)}>
            Cancel
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Tap a player to make them captain or to substitute them.</p>
      )}

      <Pitch caption={formationLabel(xi)}>
        {PITCH_ORDER.map((pos) => {
          const row = xi.filter((p) => p.position === pos);
          return (
            <PitchRow key={pos} count={row.length} label={POSITION_PLURAL[pos]}>
              {row.map(chip)}
            </PitchRow>
          );
        })}
      </Pitch>

      <BenchTray
        note="Auto-subs come on in this order. A goalkeeper only replaces a goalkeeper."
        items={bench.map((p, i) => ({ key: p.id, label: i === 0 ? "GK" : undefined, node: chip(p) }))}
      />

      {error && <InlineError title="Lineup not saved" message={error} />}
      {!locked && (formationProblem || captainProblem) && (
        <p className="text-sm text-destructive">{formationProblem ?? captainProblem}</p>
      )}

      {!locked && changed && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/80 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-raised backdrop-blur-md">
          <div className="mx-auto flex max-w-2xl gap-3">
            <Button variant="outline" size="lg" className="h-11 flex-1 text-[0.9375rem]" onClick={reset} disabled={saving}>
              Undo changes
            </Button>
            <Button
              size="lg"
              className="h-11 flex-1 text-[0.9375rem]"
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
                  className="h-12"
                  onClick={() => {
                    setSwapFrom(menuPlayer.id);
                    setMenuFor(null);
                  }}
                >
                  <ArrowLeftRight /> {menuStarts ? "Substitute" : "Bring on or reorder bench"}
                </Button>
                <Button asChild size="lg" variant="ghost" className="h-12">
                  <Link href="/fantasy/transfers">Transfer out</Link>
                </Button>
              </DrawerFooter>
            </>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
