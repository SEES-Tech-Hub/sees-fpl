"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { activateWildcardAction, makeTransfersAction } from "@/app/fantasy/actions";
import { DeadlineCard } from "@/components/fantasy/deadline-card";
import { BenchTray, Pitch, PitchRow } from "@/components/fantasy/pitch";
import { PositionTag, StatusFlag } from "@/components/fantasy/player-bits";
import { PlayerChip } from "@/components/fantasy/player-chip";
import { PlayerPickerList } from "@/components/fantasy/player-picker";
import { RoundButton } from "@/components/fantasy/squad-builder";
import { InlineError } from "@/components/fantasy/states";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ERROR_COPY } from "@/lib/fantasy/errors";
import { formatMoney, POSITION_LABEL, POSITION_PLURAL } from "@/lib/fantasy/format";
import type { FantasyRules, Player, Position, TransferState } from "@/lib/fantasy/types";
import { previewTransferCost, squadIssues } from "@/lib/fantasy/validate";
import { cn } from "@/lib/utils";

const PITCH_ORDER: Position[] = ["FWD", "MID", "DEF", "GK"];

type Props = {
  squad: Player[]; // 15 in slot order: 1–11 XI, 12–15 bench
  players: Player[];
  state: TransferState;
  rules: FantasyRules;
  deadlineAt: string | null;
  serverNow: number;
  matchdayName: string;
};

export function TransferPlanner({ squad, players, state, rules, deadlineAt, serverNow, matchdayName }: Props) {
  const router = useRouter();
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  // out player id → in player id (null while choosing)
  const [plan, setPlan] = useState<Map<string, string | null>>(new Map());
  const [sheetFor, setSheetFor] = useState<string | null>(null);
  const [pickFor, setPickFor] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [wildcardOpen, setWildcardOpen] = useState(false);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const complete = [...plan].filter((e): e is [string, string] => e[1] !== null);
  const newSquad = squad.map((p) => {
    const inId = plan.get(p.id);
    return inId ? byId.get(inId)! : p;
  });
  const cost = (list: Player[]) => list.reduce((s, p) => s + p.priceTenths, 0);
  const bankAfter = state.bankTenths + cost(squad) - cost(newSquad);
  const preview = previewTransferCost(state, complete.length, rules);
  const blocking = squadIssues(newSquad, rules).filter((i) => i.blocking);
  const unlimited = state.freeTransfers === null;
  const wildcardAllowed = state.wildcard.available && !unlimited;
  const totalCost = state.costPoints + preview.costPoints;

  const onPassed = useCallback(() => {
    setLocked(true);
    router.refresh();
  }, [router]);

  function cancel(outId: string) {
    const next = new Map(plan);
    next.delete(outId);
    setPlan(next);
    setError(null);
  }

  function choose(inId: string) {
    if (!pickFor) return;
    setPlan(new Map(plan).set(pickFor, inId));
    setPickFor(null);
    setError(null);
  }

  /** Why a replacement can't come in for `outId`, or null. */
  function reasonFor(outId: string, p: Player): string | null {
    const current = plan.get(outId) ?? outId;
    const base = newSquad.filter((x) => x.id !== current);
    const money = rules.budgetTenths - cost(base);
    if (p.priceTenths > money) return "Not enough budget";
    if (base.filter((x) => x.teamId === p.teamId).length >= rules.maxPerTeam) {
      return `Max ${rules.maxPerTeam} from Year ${p.teamYear}`;
    }
    return null;
  }

  function confirm() {
    startTransition(async () => {
      try {
        const result = await makeTransfersAction({ out: complete.map(([o]) => o), in: complete.map(([, i]) => i) });
        setConfirmOpen(false);
        if (!result.ok) {
          setError(result.error.message);
          toast.error(result.error.message);
          if (result.error.code === "DEADLINE_PASSED") onPassed();
          return;
        }
        toast.success(complete.length === 1 ? "Transfer confirmed" : "Transfers confirmed");
        setPlan(new Map());
        router.refresh();
      } catch {
        setError(ERROR_COPY.UNKNOWN);
        toast.error(ERROR_COPY.UNKNOWN);
      }
    });
  }

  function playWildcard() {
    startTransition(async () => {
      try {
        const result = await activateWildcardAction();
        setWildcardOpen(false);
        if (!result.ok) {
          toast.error(result.error.message);
          return;
        }
        toast.success("Wildcard played");
        router.refresh();
      } catch {
        toast.error(ERROR_COPY.UNKNOWN);
      }
    });
  }

  // Each slot shows the incoming player if one is planned.
  const slot = (p: Player) => {
    const inId = plan.get(p.id);
    const shown = inId ? byId.get(inId)! : p;
    return (
      <PlayerChip
        key={p.id}
        player={shown}
        tag={plan.has(p.id) ? (inId ? "IN" : "OUT") : formatMoney(shown.priceTenths)}
        tagLabel={plan.has(p.id) ? (inId ? `coming in for ${p.displayName}` : "transferring out") : undefined}
        selected={plan.has(p.id)}
        dimmed={plan.has(p.id) && !inId}
        onClick={locked ? undefined : () => setSheetFor(p.id)}
      />
    );
  };
  const xi = squad.slice(0, rules.startingSize);
  const bench = squad.slice(rules.startingSize);
  const sheetPlayer = sheetFor ? byId.get(sheetFor) : undefined;
  const sheetIn = sheetFor ? plan.get(sheetFor) : undefined;
  const pickOut = pickFor ? byId.get(pickFor) : undefined;
  const inSquad = new Set(newSquad.map((p) => p.id));

  return (
    <div className={cn("flex flex-col gap-3", plan.size > 0 && "pb-28")}>
      {/* Top bar: free transfers, cost so far, Wildcard */}
      <section aria-label="Transfer allowance" className="flex items-stretch gap-2">
        <div className="flex-1 rounded-xl bg-card px-3 py-2 shadow-card">
          <p className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Free</p>
          <p className="font-heading text-xl font-bold tabular-nums">
            {unlimited ? "Unlimited" : `${Math.max(0, (state.freeTransfers ?? 0) - complete.length)} free`}
          </p>
        </div>
        <div className="flex-1 rounded-xl bg-card px-3 py-2 shadow-card">
          <p className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Cost</p>
          <p className={cn("font-heading text-xl font-bold tabular-nums", totalCost > 0 && "text-destructive")}>
            {totalCost > 0 ? `▼ −${totalCost} pts` : "0 pts"}
          </p>
        </div>
        <div className="flex-1 rounded-xl bg-card px-3 py-2 shadow-card">
          <p className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Bank</p>
          <p className={cn("font-heading text-xl font-bold tabular-nums", bankAfter < 0 && "text-destructive")}>
            {formatMoney(bankAfter)}
          </p>
        </div>
      </section>

      {state.wildcard.activeThisMatchday ? (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-highlight px-3 py-2.5 text-sm font-semibold text-highlight-foreground">
          <Sparkles className="size-4 shrink-0" />
          Wildcard active: unlimited free transfers this matchday.
        </p>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-border px-3 py-2">
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold">Wildcard</p>
            <p className="text-xs text-muted-foreground">
              {state.wildcard.usedOnMatchday
                ? `Used on Matchday ${state.wildcard.usedOnMatchday}.`
                : unlimited
                  ? "Transfers are already free this matchday. Save it for later."
                  : "Unlimited free transfers for one matchday. Once a season."}
            </p>
          </div>
          {wildcardAllowed && !locked && (
            <Button
              variant="outline"
              className="h-11 border-2 border-highlight px-4 text-[0.9375rem]"
              onClick={() => setWildcardOpen(true)}
            >
              <Sparkles /> Play Wildcard
            </Button>
          )}
        </div>
      )}

      <DeadlineCard
        matchdayName={matchdayName}
        matchdayNumber={state.matchdayNumber}
        deadlineAt={deadlineAt}
        serverNow={serverNow}
        onPassed={onPassed}
      />

      <p className="text-sm text-muted-foreground">
        Tap a player to transfer them out. Replacements must play the same position.
      </p>

      <Pitch>
        {PITCH_ORDER.map((pos) => {
          const row = xi.filter((p) => p.position === pos);
          return (
            <PitchRow key={pos} count={row.length} label={POSITION_PLURAL[pos]}>
              {row.map((p) => slot(p))}
            </PitchRow>
          );
        })}
      </Pitch>
      <BenchTray items={bench.map((p) => ({ key: p.id, node: slot(p) }))} />

      {error && <InlineError title="Transfers not made" message={error} />}

      {plan.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/80 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-raised backdrop-blur-md">
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <div className="min-w-0 flex-1" aria-live="polite">
              <p className="font-heading text-lg font-semibold tabular-nums">
                {complete.length} transfer{complete.length === 1 ? "" : "s"} ·{" "}
                <span className={cn(preview.costPoints > 0 && "text-destructive")}>
                  {preview.costPoints > 0 ? `−${preview.costPoints} pts` : "free"}
                </span>
              </p>
              <p className={cn("truncate text-[0.8125rem]", blocking.length ? "text-destructive" : "text-muted-foreground")}>
                {blocking[0]?.message ??
                  (complete.length < plan.size ? "Choose a replacement for each player out." : `${formatMoney(bankAfter)} left in the bank`)}
              </p>
            </div>
            <Button
              size="lg"
              className="h-11 px-5 text-[0.9375rem]"
              disabled={locked || pending || complete.length === 0 || complete.length < plan.size || blocking.length > 0}
              onClick={() => setConfirmOpen(true)}
            >
              Review
            </Button>
          </div>
        </div>
      )}

      {/* Player sheet */}
      <Drawer open={sheetPlayer !== undefined} onOpenChange={(o) => !o && setSheetFor(null)}>
        <DrawerContent>
          {sheetPlayer && (
            <>
              <DrawerHeader>
                <DrawerTitle className="flex items-center justify-center gap-2">
                  {sheetPlayer.displayName} <StatusFlag status={sheetPlayer.status} />
                </DrawerTitle>
                <DrawerDescription>
                  {POSITION_LABEL[sheetPlayer.position]} · Year {sheetPlayer.teamYear} · sells for{" "}
                  {formatMoney(sheetPlayer.priceTenths)}
                  {sheetIn ? ` · replaced by ${byId.get(sheetIn)?.displayName}` : ""}
                </DrawerDescription>
              </DrawerHeader>
              <DrawerFooter>
                <Button
                  size="lg"
                  className="h-12 text-[0.9375rem]"
                  onClick={() => {
                    setPlan(new Map(plan).set(sheetPlayer.id, plan.get(sheetPlayer.id) ?? null));
                    setPickFor(sheetPlayer.id);
                    setSheetFor(null);
                  }}
                >
                  {plan.has(sheetPlayer.id) ? "Choose a different replacement" : "Transfer out"}
                </Button>
                {plan.has(sheetPlayer.id) && (
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 text-[0.9375rem]"
                    onClick={() => {
                      cancel(sheetPlayer.id);
                      setSheetFor(null);
                    }}
                  >
                    Keep {sheetPlayer.displayName}
                  </Button>
                )}
              </DrawerFooter>
            </>
          )}
        </DrawerContent>
      </Drawer>

      {/* Replacement picker: same position, affordable */}
      <Drawer
        open={pickOut !== undefined}
        onOpenChange={(o) => {
          if (o || !pickFor) return;
          if (!plan.get(pickFor)) cancel(pickFor);
          setPickFor(null);
        }}
      >
        <DrawerContent className="flex flex-col data-[vaul-drawer-direction=bottom]:max-h-[90dvh]">
          {pickOut && (
            <>
              <DrawerHeader>
                <DrawerTitle>Replace {pickOut.displayName}</DrawerTitle>
                <DrawerDescription>
                  {POSITION_PLURAL[pickOut.position]} you can afford · selling for {formatMoney(pickOut.priceTenths)}
                </DrawerDescription>
              </DrawerHeader>
              <PlayerPickerList
                key={pickOut.id}
                players={players.filter((p) => p.position === pickOut.position && !inSquad.has(p.id) && p.status !== "left")}
                position={pickOut.position}
                hideBlocked
                reasonFor={(p) => reasonFor(pickOut.id, p)}
                renderAction={(p, reason) => (
                  <RoundButton added={false} disabled={Boolean(reason)} name={p.displayName} onClick={() => choose(p.id)} />
                )}
              />
            </>
          )}
        </DrawerContent>
      </Drawer>

      {/* Confirm sheet */}
      <Drawer open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Confirm transfers</DrawerTitle>
            <DrawerDescription>
              {preview.costPoints > 0
                ? `${preview.extra} more than your free transfers: −${preview.costPoints} pts from ${matchdayName}.`
                : "These transfers are free."}{" "}
              They can&apos;t be undone.
            </DrawerDescription>
          </DrawerHeader>
          <ul className="flex flex-col gap-2 px-4">
            {complete.map(([o, i]) => {
              const out = byId.get(o)!;
              const inn = byId.get(i)!;
              return (
                <li key={o} className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
                  <PositionTag position={out.position} className="bg-background" />
                  <span className="min-w-0 flex-1 truncate text-destructive line-through">{out.displayName}</span>
                  <ArrowRight className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate font-semibold">{inn.displayName}</span>
                </li>
              );
            })}
          </ul>
          <DrawerFooter>
            <Button size="lg" className="h-12 text-[0.9375rem]" onClick={confirm} disabled={pending}>
              {pending ? "Confirming…" : complete.length === 1 ? "Confirm transfer" : `Confirm ${complete.length} transfers`}
            </Button>
            <DrawerClose asChild>
              <Button variant="outline" size="lg" className="h-12 text-[0.9375rem]">
                Back
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Wildcard: risky and permanent, so a dialog */}
      <Dialog open={wildcardOpen} onOpenChange={setWildcardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Play your Wildcard?</DialogTitle>
            <DialogDescription>
              Every transfer for {matchdayName} becomes free, including any you&apos;ve already made. You get one a
              season, and it can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="h-11">
                Not now
              </Button>
            </DialogClose>
            <Button className="h-11" onClick={playWildcard} disabled={pending}>
              {pending ? "Playing…" : "Play Wildcard"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
