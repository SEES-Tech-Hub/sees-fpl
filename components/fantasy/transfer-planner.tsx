"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { activateWildcardAction, makeTransfersAction } from "@/app/fantasy/actions";
import { DeadlineCountdown } from "@/components/fantasy/deadline-countdown";
import { PlayerRow, PositionTag } from "@/components/fantasy/player-bits";
import { InlineError } from "@/components/fantasy/states";
import { Badge } from "@/components/ui/badge";
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
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { ERROR_COPY } from "@/lib/fantasy/errors";
import { formatMoney, POSITION_PLURAL } from "@/lib/fantasy/format";
import { POSITIONS, type FantasyRules, type Player, type TransferState } from "@/lib/fantasy/types";
import { previewTransferCost, squadIssues } from "@/lib/fantasy/validate";
import { cn } from "@/lib/utils";

type Props = {
  squad: Player[];
  players: Player[];
  state: TransferState;
  rules: FantasyRules;
  deadlineAt: string | null;
  matchdayName: string;
};

export function TransferPlanner({ squad, players, state, rules, deadlineAt, matchdayName }: Props) {
  const router = useRouter();
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  // out player id → in player id (null while choosing)
  const [plan, setPlan] = useState<Map<string, string | null>>(new Map());
  const [choosingFor, setChoosingFor] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [wildcardOpen, setWildcardOpen] = useState(false);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const complete = [...plan].filter((entry): entry is [string, string] => entry[1] !== null);
  const newSquad = squad.map((p) => {
    const inId = plan.get(p.id);
    return inId ? byId.get(inId)! : p;
  });
  const bankAfter = state.bankTenths + squad.reduce((s, p) => s + p.priceTenths, 0) - newSquad.reduce((s, p) => s + p.priceTenths, 0);
  const preview = previewTransferCost(state, complete.length, rules);
  const blocking = squadIssues(newSquad, rules).filter((i) => i.blocking);
  const unlimited = state.freeTransfers === null;
  const wildcardAllowed = state.wildcard.available && !unlimited;

  const onPassed = useCallback(() => {
    setLocked(true);
    router.refresh();
  }, [router]);

  function toggleOut(id: string) {
    const next = new Map(plan);
    if (next.has(id)) next.delete(id);
    else {
      next.set(id, null);
      setChoosingFor(id);
      setSearch("");
    }
    setPlan(next);
    setError(null);
  }

  function choose(inId: string) {
    if (!choosingFor) return;
    setPlan(new Map(plan).set(choosingFor, inId));
    setChoosingFor(null);
  }

  // Candidates for the player being replaced: same position, not already in the squad.
  const outPlayer = choosingFor ? byId.get(choosingFor) : undefined;
  const candidates = useMemo(() => {
    if (!outPlayer) return [];
    const inSquad = new Set(newSquad.map((p) => p.id));
    const q = search.trim().toLowerCase();
    return players
      .filter((p) => p.position === outPlayer.position && !inSquad.has(p.id))
      .filter((p) => !q || p.displayName.toLowerCase().includes(q) || p.teamShort.toLowerCase().includes(q))
      .sort((a, b) => b.priceTenths - a.priceTenths || a.displayName.localeCompare(b.displayName));
  }, [outPlayer, newSquad, players, search]);

  function candidateProblem(p: Player): string | null {
    if (!outPlayer) return null;
    const current = plan.get(outPlayer.id);
    const base = newSquad.filter((x) => x.id !== (current ?? outPlayer.id));
    const money = rules.budgetTenths - base.reduce((s, x) => s + x.priceTenths, 0);
    if (p.priceTenths > money) return `Only ${formatMoney(money)} to spend`;
    if (base.filter((x) => x.teamId === p.teamId).length >= rules.maxPerTeam) {
      return `Already ${rules.maxPerTeam} from Year ${p.teamYear}`;
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
        toast.success(
          `${complete.length} transfer${complete.length === 1 ? "" : "s"} made. Check your lineup and captain.`,
        );
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
        toast.success("Wildcard played. All transfers are free this matchday.");
        router.refresh();
      } catch {
        toast.error(ERROR_COPY.UNKNOWN);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <DeadlineCountdown deadlineAt={deadlineAt} label={`${matchdayName} deadline`} onPassed={onPassed} />

      {/* Allowance */}
      <section aria-label="Transfer allowance" className="grid grid-cols-3 gap-2">
        <Stat label="Free transfers" value={unlimited ? "∞" : String(state.freeTransfers)} hint={unlimited ? "Unlimited" : undefined} />
        <Stat label="Already made" value={String(state.made)} hint={state.costPoints ? `−${state.costPoints} pts` : undefined} />
        <Stat label="In the bank" value={formatMoney(bankAfter)} danger={bankAfter < 0} />
      </section>

      {/* Wildcard */}
      <section
        aria-label="Wildcard"
        className={cn(
          "flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2",
          state.wildcard.activeThisMatchday && "border-highlight bg-highlight/15",
        )}
      >
        <Sparkles className="size-5 shrink-0 text-brand" />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-medium">Wildcard</p>
          <p className="text-xs text-muted-foreground">
            {state.wildcard.activeThisMatchday
              ? "Active: every transfer this matchday is free."
              : state.wildcard.usedOnMatchday
                ? `Used on Matchday ${state.wildcard.usedOnMatchday}.`
                : unlimited
                  ? "Transfers are already free this matchday, so save it."
                  : "Unlimited free transfers for one matchday. Once per season."}
          </p>
        </div>
        {state.wildcard.activeThisMatchday ? (
          <Badge className="bg-highlight text-highlight-foreground">Active</Badge>
        ) : wildcardAllowed && !locked ? (
          <Button variant="outline" className="h-11" onClick={() => setWildcardOpen(true)}>
            Play
          </Button>
        ) : null}
      </section>

      {/* Squad */}
      {POSITIONS.map((pos) => (
        <section key={pos} aria-label={POSITION_PLURAL[pos]}>
          <h2 className="mb-1 font-heading text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            {POSITION_PLURAL[pos]}
          </h2>
          <ul className="rounded-xl border border-border bg-card px-2">
            {squad
              .filter((p) => p.position === pos)
              .map((p) => {
                const isOut = plan.has(p.id);
                const inId = plan.get(p.id);
                const incoming = inId ? byId.get(inId) : undefined;
                return (
                  <li key={p.id} className="border-b border-border last:border-b-0 [&>div]:border-b-0">
                    <PlayerRow
                      as="div"
                      player={p}
                      highlight={isOut}
                      action={
                        <Button
                          variant={isOut ? "destructive" : "outline"}
                          className="h-11 w-16 shrink-0"
                          disabled={locked}
                          onClick={() => toggleOut(p.id)}
                          aria-label={isOut ? `Keep ${p.displayName}` : `Transfer out ${p.displayName}`}
                        >
                          {isOut ? <Undo2 /> : "Out"}
                        </Button>
                      }
                    />
                    {isOut && (
                      <button
                        type="button"
                        onClick={() => {
                          setChoosingFor(p.id);
                          setSearch("");
                        }}
                        className="mb-2 flex min-h-12 w-full items-center gap-2 rounded-lg border border-dashed border-primary px-3 text-left text-sm"
                      >
                        <ArrowRight className="size-4 shrink-0 text-primary" />
                        {incoming ? (
                          <span className="flex-1 truncate">
                            In: <strong>{incoming.displayName}</strong> ({incoming.teamShort}, {formatMoney(incoming.priceTenths)})
                          </span>
                        ) : (
                          <span className="flex-1 font-medium text-primary">Choose a replacement</span>
                        )}
                      </button>
                    )}
                  </li>
                );
              })}
          </ul>
        </section>
      ))}

      {error && <InlineError title="Transfers not made" message={error} />}

      {plan.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <div className="min-w-0 flex-1 text-sm" aria-live="polite">
              <p className="font-medium">
                {complete.length} transfer{complete.length === 1 ? "" : "s"} ·{" "}
                <span className={cn(preview.costPoints > 0 && "text-destructive")}>
                  {preview.costPoints > 0 ? `−${preview.costPoints} pts` : "free"}
                </span>
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {blocking[0]?.message ??
                  (complete.length < plan.size ? "Choose a replacement for each player out." : `Bank after: ${formatMoney(bankAfter)}`)}
              </p>
            </div>
            <Button
              size="lg"
              className="h-11 px-5"
              disabled={locked || pending || complete.length === 0 || complete.length < plan.size || blocking.length > 0}
              onClick={() => setConfirmOpen(true)}
            >
              Review
            </Button>
          </div>
        </div>
      )}

      {/* Replacement picker */}
      <Drawer open={outPlayer !== undefined} onOpenChange={(open) => !open && setChoosingFor(null)}>
        <DrawerContent className="max-h-[88vh]">
          {outPlayer && (
            <>
              <DrawerHeader>
                <DrawerTitle>Replace {outPlayer.displayName}</DrawerTitle>
                <DrawerDescription>
                  {POSITION_PLURAL[outPlayer.position]} · selling for {formatMoney(outPlayer.priceTenths)}
                </DrawerDescription>
              </DrawerHeader>
              <div className="px-4 pb-2">
                <Input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name or year (Y3)"
                  aria-label="Search replacements"
                  className="h-11 text-base"
                />
              </div>
              <ul className="overflow-y-auto px-4 pb-6">
                {candidates.length === 0 && (
                  <li className="py-6 text-center text-sm text-muted-foreground">No players match.</li>
                )}
                {candidates.map((p) => {
                  const problem = candidateProblem(p);
                  return (
                    <PlayerRow
                      key={p.id}
                      player={p}
                      note={problem ? <span className="text-destructive">{problem}</span> : undefined}
                      action={
                        <Button
                          className="h-11 w-16 shrink-0"
                          variant="outline"
                          disabled={Boolean(problem)}
                          onClick={() => choose(p.id)}
                          aria-label={`Bring in ${p.displayName}`}
                        >
                          In
                        </Button>
                      }
                    />
                  );
                })}
              </ul>
            </>
          )}
        </DrawerContent>
      </Drawer>

      {/* Confirm transfers */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm transfers</DialogTitle>
            <DialogDescription>
              {preview.costPoints > 0
                ? `${preview.extra} more than your free transfers: −${preview.costPoints} points on ${matchdayName}.`
                : "These transfers are free."}{" "}
              Transfers can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <ul className="flex flex-col gap-2">
            {complete.map(([o, i]) => {
              const out = byId.get(o)!;
              const inn = byId.get(i)!;
              return (
                <li key={o} className="flex items-center gap-2 text-sm">
                  <PositionTag position={out.position} />
                  <span className="min-w-0 flex-1 truncate text-destructive line-through">{out.displayName}</span>
                  <ArrowRight className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate font-medium">{inn.displayName}</span>
                </li>
              );
            })}
          </ul>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="h-11">
                Back
              </Button>
            </DialogClose>
            <Button className="h-11" onClick={confirm} disabled={pending}>
              {pending ? "Making transfers…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Wildcard */}
      <Dialog open={wildcardOpen} onOpenChange={setWildcardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Play your Wildcard?</DialogTitle>
            <DialogDescription>
              Every transfer for {matchdayName} becomes free, including any you&apos;ve already made. You only get one,
              and it can&apos;t be undone.
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

function Stat({ label, value, hint, danger }: { label: string; value: string; hint?: string; danger?: boolean }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card px-3 py-2", danger && "border-destructive")}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("font-heading text-xl font-semibold tabular-nums", danger && "text-destructive")}>{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
