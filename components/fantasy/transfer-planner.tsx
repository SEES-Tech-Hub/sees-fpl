"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { toast } from "sonner";
import { activateWildcardAction, makeTransfersAction } from "@/app/fantasy/actions";
import { useSaveCelebration } from "@/components/brand/save-celebration";
import { DeadlineCard } from "@/components/fantasy/deadline-card";
import { chipMotion, SPRING } from "@/components/fantasy/motion-bits";
import { BenchTray, Pitch, PitchRow } from "@/components/fantasy/pitch";
import { PositionTag, StatusFlag } from "@/components/fantasy/player-bits";
import { PlayerChip } from "@/components/fantasy/player-chip";
import { PlayerPickerList } from "@/components/fantasy/player-picker";
import { useLocalStorageState } from "@/hooks/use-local-storage-state";
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

const TRANSFER_LINES = ["Signing the paperwork…", "Shaking hands on the deal…", "Handing over the new kits…", "Updating the team sheet…"];

/** Each block of the screen rises in, one after another. */
const rise = (i: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { ...SPRING, delay: i * 0.05 },
});

/** A number that drops in when it changes. */
function Ticker({ value, className }: { value: string; className?: string }) {
  return (
    <span className="relative block overflow-hidden">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          className={cn("block", className)}
          initial={{ y: "-60%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "60%", opacity: 0 }}
          transition={SPRING}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

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
  // out player id → in player id (null while choosing). Kept in this browser
  // per matchday, so a reload carries on with the same plan.
  const squadIds = new Set(squad.map((p) => p.id));
  const [savedPlan, setSavedPlan, clearPlan] = useLocalStorageState<[string, string | null][]>(
    `sees-fantasy:transfer-plan:md${state.matchdayNumber}`,
    [],
    {
      validate: (entries) =>
        entries.filter(([out, inn]) => squadIds.has(out) && (inn === null || (byId.has(inn) && !squadIds.has(inn)))),
    },
  );
  const plan = new Map(savedPlan);
  const setPlan = (next: Map<string, string | null>) => setSavedPlan([...next]);
  const [sheetFor, setSheetFor] = useState<string | null>(null);
  const [pickFor, setPickFor] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [wildcardOpen, setWildcardOpen] = useState(false);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { run, overlay, busy } = useSaveCelebration();

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

  async function confirm() {
    setConfirmOpen(false);
    const n = complete.length;
    try {
      const result = await run(() => makeTransfersAction({ out: complete.map(([o]) => o), in: complete.map(([, i]) => i) }), {
        lines: TRANSFER_LINES,
        done: {
          title: n === 1 ? "Transfer done!" : `${n} transfers done!`,
          subtitle: `Your new signings are ready for ${matchdayName}`,
        },
        onSuccess: () => {
          clearPlan();
          router.refresh();
        },
      });
      if (!result.ok) {
        setError(result.error.message);
        toast.error(result.error.message);
        if (result.error.code === "DEADLINE_PASSED") onPassed();
      }
    } catch {
      setError(ERROR_COPY.UNKNOWN);
      toast.error(ERROR_COPY.UNKNOWN);
    }
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
      <AnimatePresence key={p.id} mode="popLayout" initial={false}>
        <motion.div key={shown.id} {...chipMotion}>
          <PlayerChip
        player={shown}
        tag={plan.has(p.id) ? (inId ? "IN" : "OUT") : formatMoney(shown.priceTenths)}
        tagLabel={plan.has(p.id) ? (inId ? `coming in for ${p.displayName}` : "transferring out") : undefined}
        selected={plan.has(p.id)}
        dimmed={plan.has(p.id) && !inId}
        onClick={locked ? undefined : () => setSheetFor(p.id)}
          />
        </motion.div>
      </AnimatePresence>
    );
  };
  const xi = squad.slice(0, rules.startingSize);
  const bench = squad.slice(rules.startingSize);
  const sheetPlayer = sheetFor ? byId.get(sheetFor) : undefined;
  const sheetIn = sheetFor ? plan.get(sheetFor) : undefined;
  const pickOut = pickFor ? byId.get(pickFor) : undefined;
  const inSquad = new Set(newSquad.map((p) => p.id));

  return (
    <MotionConfig reducedMotion="user">
    <div className={cn("flex flex-col gap-3", plan.size > 0 && "pb-28")}>
      {/* Top bar: free transfers, cost so far, Wildcard */}
      <motion.section {...rise(0)} aria-label="Transfer allowance" className="flex items-stretch gap-2">
        <div className="flex-1 rounded-xl bg-card px-3 py-2 shadow-card">
          <p className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Free</p>
          <Ticker
            className="font-heading text-xl font-bold tabular-nums"
            value={unlimited ? "Unlimited" : `${Math.max(0, (state.freeTransfers ?? 0) - complete.length)} free`}
          />
        </div>
        <div className="flex-1 rounded-xl bg-card px-3 py-2 shadow-card">
          <p className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Cost</p>
          <Ticker
            className={cn("font-heading text-xl font-bold tabular-nums", totalCost > 0 && "text-destructive")}
            value={totalCost > 0 ? `▼ −${totalCost} pts` : "0 pts"}
          />
        </div>
        <div className="flex-1 rounded-xl bg-card px-3 py-2 shadow-card">
          <p className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Bank</p>
          <Ticker
            className={cn("font-heading text-xl font-bold tabular-nums", bankAfter < 0 && "text-destructive")}
            value={formatMoney(bankAfter)}
          />
        </div>
      </motion.section>

      {state.wildcard.activeThisMatchday ? (
        <motion.p {...rise(1)} role="status" className="flex items-center gap-2 rounded-xl bg-highlight px-3 py-2.5 text-sm font-semibold text-highlight-foreground">
          <Sparkles className="size-4 shrink-0" />
          Wildcard active: unlimited free transfers this matchday.
        </motion.p>
      ) : (
        <motion.div {...rise(1)} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2">
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
        </motion.div>
      )}

      <motion.div {...rise(2)}>
      <DeadlineCard
        matchdayName={matchdayName}
        matchdayNumber={state.matchdayNumber}
        deadlineAt={deadlineAt}
        serverNow={serverNow}
        onPassed={onPassed}
      />
      </motion.div>

      <motion.p {...rise(3)} className="text-sm text-muted-foreground">
        Tap a player to transfer them out. Replacements must play the same position.
      </motion.p>

      <motion.div {...rise(4)} className="flex flex-col gap-3">
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
      </motion.div>

      {error && <InlineError title="Transfers not made" message={error} />}

      <AnimatePresence>
      {plan.size > 0 && (
        <motion.div
          key="plan-bar"
          initial={{ y: "110%" }}
          animate={{ y: 0 }}
          exit={{ y: "110%", transition: { duration: 0.18 } }}
          transition={SPRING}
          className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/80 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-raised backdrop-blur-md">
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <div className="min-w-0 flex-1" aria-live="polite">
              <motion.p
                key={complete.length}
                initial={{ scale: 1.08 }}
                animate={{ scale: 1 }}
                transition={SPRING}
                className="origin-left font-heading text-lg font-semibold tabular-nums"
              >
                {complete.length} transfer{complete.length === 1 ? "" : "s"} ·{" "}
                <span className={cn(preview.costPoints > 0 && "text-destructive")}>
                  {preview.costPoints > 0 ? `−${preview.costPoints} pts` : "free"}
                </span>
              </motion.p>
              <p className={cn("truncate text-[0.8125rem]", blocking.length ? "text-destructive" : "text-muted-foreground")}>
                {blocking[0]?.message ??
                  (complete.length < plan.size ? "Choose a replacement for each player out." : `${formatMoney(bankAfter)} left in the bank`)}
              </p>
            </div>
            <Button
              size="lg"
              className="h-11 px-5 text-[0.9375rem]"
              disabled={locked || pending || busy || complete.length === 0 || complete.length < plan.size || blocking.length > 0}
              onClick={() => setConfirmOpen(true)}
            >
              Review
            </Button>
          </div>
        </motion.div>
      )}
      </AnimatePresence>

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
                storageKey="sees-fantasy:transfer-picker-filters"
                reasonFor={(p) => reasonFor(pickOut.id, p)}
                verb="Bring in"
                onChoose={(p) => choose(p.id)}
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
            {complete.map(([o, i], n) => {
              const out = byId.get(o)!;
              const inn = byId.get(i)!;
              return (
                <motion.li
                  key={o}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ ...SPRING, delay: 0.08 + n * 0.05 }}
                  className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm"
                >
                  <PositionTag position={out.position} className="bg-background" />
                  <span className="min-w-0 flex-1 truncate text-destructive line-through">{out.displayName}</span>
                  <ArrowRight className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate font-semibold">{inn.displayName}</span>
                </motion.li>
              );
            })}
          </ul>
          <DrawerFooter>
            <Button size="lg" className="h-12 text-[0.9375rem]" onClick={() => void confirm()} disabled={busy}>
              {busy ? "Confirming…" : complete.length === 1 ? "Confirm transfer" : `Confirm ${complete.length} transfers`}
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
      {overlay}
    </div>
    </MotionConfig>
  );
}
