"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Minus, Plus, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { saveSquadAction } from "@/app/fantasy/actions";
import { InlineError } from "@/components/fantasy/states";
import { PlayerRow, PositionTag } from "@/components/fantasy/player-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ERROR_COPY } from "@/lib/fantasy/errors";
import { formatMoney } from "@/lib/fantasy/format";
import { POSITIONS, type FantasyRules, type Player, type Position, type Team } from "@/lib/fantasy/types";
import { cannotAddReason, countByPosition, squadCost, squadIssues } from "@/lib/fantasy/validate";
import { cn } from "@/lib/utils";

type Sort = "price-desc" | "price-asc" | "points" | "picked" | "name";

export function SquadBuilder({
  players,
  teams,
  rules,
  draftKey,
}: {
  players: Player[];
  teams: Team[];
  rules: FantasyRules;
  draftKey: string;
}) {
  const router = useRouter();
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [view, setView] = useState<"list" | "pitch">("list");
  const [position, setPosition] = useState<Position | "ALL">("ALL");
  const [teamId, setTeamId] = useState("all");
  const [sort, setSort] = useState<Sort>("price-desc");
  const [search, setSearch] = useState("");
  const [serverError, setServerError] = useState<{ message: string; playerIds?: string[] } | null>(null);
  const [saving, startSaving] = useTransition();

  // Keep an unsaved draft on this phone, so a dropped connection doesn't lose picks.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(draftKey);
      const ids = raw ? (JSON.parse(raw) as string[]) : [];
      const valid = ids.filter((id) => byId.has(id));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring browser-only state after hydration
      if (valid.length) setSelectedIds(valid);
    } catch {
      // Storage blocked or corrupt: start empty.
    }
  }, [draftKey, byId]);

  function update(ids: string[]) {
    setSelectedIds(ids);
    setServerError(null);
    try {
      window.localStorage.setItem(draftKey, JSON.stringify(ids));
    } catch {
      // Ignore: the draft is a convenience.
    }
  }

  const selected = selectedIds.map((id) => byId.get(id)).filter((p): p is Player => Boolean(p));
  const counts = countByPosition(selected);
  const cost = squadCost(selected);
  const left = rules.budgetTenths - cost;
  const issues = squadIssues(selected, rules);
  const blocking = issues.filter((i) => i.blocking);
  const complete = selected.length === rules.squadSize && blocking.length === 0;
  const flagged = new Set([...blocking.flatMap((i) => i.playerIds ?? []), ...(serverError?.playerIds ?? [])]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = players.filter(
      (p) =>
        (position === "ALL" || p.position === position) &&
        (teamId === "all" || p.teamId === teamId) &&
        (!q || p.displayName.toLowerCase().includes(q) || p.fullName.toLowerCase().includes(q)),
    );
    const cmp: Record<Sort, (a: Player, b: Player) => number> = {
      "price-desc": (a, b) => b.priceTenths - a.priceTenths,
      "price-asc": (a, b) => a.priceTenths - b.priceTenths,
      points: (a, b) => b.totalPoints - a.totalPoints,
      picked: (a, b) => b.selectedByPct - a.selectedByPct,
      name: () => 0,
    };
    return list.sort((a, b) => cmp[sort](a, b) || a.displayName.localeCompare(b.displayName));
  }, [players, position, teamId, sort, search]);

  function toggle(player: Player) {
    if (selectedIds.includes(player.id)) update(selectedIds.filter((id) => id !== player.id));
    else if (!cannotAddReason(player, selected, rules)) update([...selectedIds, player.id]);
  }

  function save() {
    startSaving(async () => {
      try {
        const result = await saveSquadAction(selectedIds);
        if (!result.ok) {
          setServerError({ message: result.error.message, playerIds: result.error.playerIds });
          toast.error(result.error.message);
          return;
        }
        try {
          window.localStorage.removeItem(draftKey);
        } catch {}
        toast.success("Squad saved. Now set your lineup and captain.");
        router.push("/fantasy/team");
      } catch {
        setServerError({ message: ERROR_COPY.UNKNOWN });
        toast.error(ERROR_COPY.UNKNOWN);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Budget and squad shape */}
      <section aria-label="Squad summary" className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-border bg-card px-3 py-2">
          <p className="text-xs text-muted-foreground">Players</p>
          <p className="font-heading text-2xl font-semibold tabular-nums">
            {selected.length}
            <span className="text-base text-muted-foreground">/{rules.squadSize}</span>
          </p>
        </div>
        <div className={cn("rounded-xl border border-border bg-card px-3 py-2", left < 0 && "border-destructive")}>
          <p className="text-xs text-muted-foreground">Money left</p>
          <p className={cn("font-heading text-2xl font-semibold tabular-nums", left < 0 && "text-destructive")}>
            {formatMoney(left)}
          </p>
        </div>
        <ul className="col-span-2 grid grid-cols-4 gap-2">
          {POSITIONS.map((pos) => {
            const full = counts[pos] === rules.squadPositions[pos];
            return (
              <li key={pos}>
                <button
                  type="button"
                  onClick={() => {
                    setPosition(pos);
                    setView("list");
                  }}
                  className={cn(
                    "flex h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-border text-sm tabular-nums",
                    full && "border-primary bg-secondary",
                  )}
                  aria-label={`${pos}: ${counts[pos]} of ${rules.squadPositions[pos]}. Show ${pos}`}
                >
                  <PositionTag position={pos} className="w-8" />
                  {counts[pos]}/{rules.squadPositions[pos]}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* View switch */}
      <div role="tablist" aria-label="View" className="grid grid-cols-2 rounded-lg bg-muted p-1">
        {(["list", "pitch"] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={cn(
              "h-10 rounded-md text-sm font-medium text-muted-foreground",
              view === v && "bg-background text-foreground shadow-sm",
            )}
          >
            {v === "list" ? "Player list" : `Pitch (${selected.length})`}
          </button>
        ))}
      </div>

      {view === "pitch" ? (
        <SquadPitch
          selected={selected}
          rules={rules}
          flagged={flagged}
          onRemove={(p) => update(selectedIds.filter((id) => id !== p.id))}
          onPickSlot={(pos) => {
            setPosition(pos);
            setView("list");
          }}
        />
      ) : (
        <section aria-label="Players" className="flex flex-col gap-3">
          <div className="grid grid-cols-5 gap-1">
            {(["ALL", ...POSITIONS] as const).map((pos) => (
              <button
                key={pos}
                type="button"
                aria-pressed={position === pos}
                onClick={() => setPosition(pos)}
                className={cn(
                  "h-10 rounded-lg border border-border text-sm font-medium",
                  position === pos && "border-primary bg-primary text-primary-foreground",
                )}
              >
                {pos === "ALL" ? "All" : pos}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger className="h-11 w-full" aria-label="Year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All years</SelectItem>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} ({selected.filter((p) => p.teamId === t.id).length}/{rules.maxPerTeam})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
              <SelectTrigger className="h-11 w-full" aria-label="Sort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="price-desc">Price: high to low</SelectItem>
                <SelectItem value="price-asc">Price: low to high</SelectItem>
                <SelectItem value="points">Most points</SelectItem>
                <SelectItem value="picked">Most picked</SelectItem>
                <SelectItem value="name">Name</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search players"
            aria-label="Search players"
            className="h-11 text-base"
          />
          {visible.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No players match these filters.</p>
          ) : (
            <ul className="rounded-xl border border-border bg-card px-2">
              {visible.map((p) => {
                const isIn = selectedIds.includes(p.id);
                const reason = isIn ? null : cannotAddReason(p, selected, rules);
                return (
                  <PlayerRow
                    key={p.id}
                    player={p}
                    highlight={isIn}
                    note={reason ? <span className="text-destructive">{reason}</span> : undefined}
                    action={
                      <Button
                        type="button"
                        size="icon-lg"
                        variant={isIn ? "secondary" : "outline"}
                        className="size-11 shrink-0"
                        disabled={!isIn && Boolean(reason)}
                        onClick={() => toggle(p)}
                        aria-label={isIn ? `Remove ${p.displayName}` : `Add ${p.displayName}`}
                      >
                        {isIn ? <Minus /> : <Plus />}
                      </Button>
                    }
                  />
                );
              })}
            </ul>
          )}
        </section>
      )}

      {serverError && <InlineError title="Squad not saved" message={serverError.message} />}

      {/* Sticky save bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <div className="min-w-0 flex-1 text-sm" aria-live="polite">
            {blocking.length > 0 ? (
              <p className="text-destructive">{blocking[0].message}</p>
            ) : issues.length > 0 ? (
              <p className="text-muted-foreground">{issues[0].message}</p>
            ) : (
              <p className="flex items-center gap-1 text-success">
                <Check className="size-4" /> Squad complete
              </p>
            )}
          </div>
          {selected.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              className="size-11"
              onClick={() => update([])}
              aria-label="Clear squad"
            >
              <RotateCcw />
            </Button>
          )}
          <Button type="button" size="lg" className="h-11 px-5" disabled={!complete || saving} onClick={save}>
            {saving ? "Saving…" : "Save squad"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SquadPitch({
  selected,
  rules,
  flagged,
  onRemove,
  onPickSlot,
}: {
  selected: Player[];
  rules: FantasyRules;
  flagged: Set<string>;
  onRemove: (p: Player) => void;
  onPickSlot: (pos: Position) => void;
}) {
  return (
    <section aria-label="Your squad" className="flex flex-col gap-3 rounded-xl bg-brand p-3">
      {POSITIONS.map((pos) => {
        const inPos = selected.filter((p) => p.position === pos);
        const empty = rules.squadPositions[pos] - inPos.length;
        return (
          <div
            key={pos}
            className="grid justify-center gap-1.5"
            style={{ gridTemplateColumns: `repeat(${rules.squadPositions[pos]}, minmax(0, 4.5rem))` }}
          >
            {inPos.map((p) => (
              <div
                key={p.id}
                className={cn(
                  "flex min-w-0 flex-col items-center rounded-lg bg-card px-1 py-1.5 text-center text-card-foreground",
                  flagged.has(p.id) && "ring-2 ring-destructive",
                )}
              >
                <PositionTag position={p.position} className="h-4 w-8 text-[0.6rem]" />
                <p className="mt-1 w-full truncate text-xs font-medium">{p.displayName}</p>
                <p className="text-[0.65rem] text-muted-foreground">
                  {p.teamShort} · {formatMoney(p.priceTenths)}
                </p>
                <button
                  type="button"
                  onClick={() => onRemove(p)}
                  className="mt-1 flex h-8 w-full items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                  aria-label={`Remove ${p.displayName}`}
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
            {Array.from({ length: Math.max(0, empty) }, (_, i) => (
              <button
                key={`empty-${i}`}
                type="button"
                onClick={() => onPickSlot(pos)}
                className="flex h-[6.5rem] min-w-0 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-brand-foreground/40 text-brand-foreground/80"
                aria-label={`Add a ${pos}`}
              >
                <Plus className="size-5" />
                <span className="text-xs font-medium">{pos}</span>
              </button>
            ))}
          </div>
        );
      })}
    </section>
  );
}
