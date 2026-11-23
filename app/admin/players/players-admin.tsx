"use client";

import { useMemo, useState } from "react";
import { Lock, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { commitPlayersImport, commitPricesImport, previewPlayersImport, previewPricesImport } from "@/lib/admin/actions/imports";
import { createPlayer, setPlayerPrice, setPlayerStatus, updatePlayer } from "@/lib/admin/actions/players";
import type { AdminPlayer, PriceSettings } from "@/lib/admin/queries/players";
import type { AdminTeam } from "@/lib/admin/queries/sports";
import { PLAYER_POSITIONS, PLAYER_STATUSES } from "@/lib/admin/types";
import { cn } from "@/lib/utils";
import { Choice, FieldMessage, PageTitle, Row, useAdminAction } from "../_kit/admin-kit";
import { CsvImport } from "../_kit/csv-import";

const money = (t: number) => `₦${(t / 10).toFixed(1)}m`;

export function PlayersAdmin({ players, teams, prices }: { players: AdminPlayer[]; teams: AdminTeam[]; prices: PriceSettings }) {
  const [team, setTeam] = useState("all");
  const [pos, setPos] = useState("all");
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<AdminPlayer | null>(null);
  const [adding, setAdding] = useState(false);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return players.filter(
      (p) =>
        (team === "all" || p.teamId === team) &&
        (pos === "all" || p.position === pos) &&
        (status === "all" || p.status === status) &&
        (!s || p.fullName.toLowerCase().includes(s) || p.displayName.toLowerCase().includes(s)),
    );
  }, [players, team, pos, status, q]);

  const { rules, locked } = prices;
  const priceOptions = useMemo(() => {
    const out: number[] = [];
    for (let t = rules.minTenths; t <= rules.maxTenths; t += rules.stepTenths) out.push(t);
    return out;
  }, [rules]);

  return (
    <div className="flex flex-col gap-5">
      <PageTitle
        title="Players"
        description={
          <>
            {players.length} players. Prices run {money(rules.minTenths)} to {money(rules.maxTenths)}.{" "}
            {locked ? (
              <span className="inline-flex items-center gap-1 font-medium text-foreground">
                <Lock className="size-3.5" /> Prices are locked since the matchday 1 deadline; late additions join at {money(rules.minTenths)}.
              </span>
            ) : (
              "Prices lock at the matchday 1 deadline."
            )}
          </>
        }
        action={
          <div className="flex flex-wrap gap-2">
            <CsvImport
              title="Import players"
              columns="full_name, year, position, price, shirt_number, status, display_name"
              preview={previewPlayersImport}
              commit={commitPlayersImport}
            />
            {!locked && (
              <CsvImport title="Import prices" columns="full_name, year, price, display_name" preview={previewPricesImport} commit={commitPricesImport} />
            )}
            <Button className="gap-2" onClick={() => setAdding(true)}>
              <Plus className="size-4" /> Add player
            </Button>
          </div>
        }
      />

      <div className="grid gap-2 sm:grid-cols-4">
        <Input placeholder="Search names" value={q} onChange={(e) => setQ(e.target.value)} className="h-10" />
        <Choice label="Team" value={team} onChange={setTeam} options={[{ value: "all", label: "All years" }, ...teams.map((t) => ({ value: t.id, label: t.name }))]} />
        <Choice label="Position" value={pos} onChange={setPos} options={[{ value: "all", label: "All positions" }, ...PLAYER_POSITIONS.map((p) => ({ value: p, label: p }))]} />
        <Choice label="Status" value={status} onChange={setStatus} options={[{ value: "all", label: "Any status" }, ...PLAYER_STATUSES.map((s) => ({ value: s, label: s }))]} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="bg-muted text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-semibold">Name</th>
              <th className="px-3 py-2 font-semibold">Shown as</th>
              <th className="px-3 py-2 font-semibold">Year</th>
              <th className="px-3 py-2 font-semibold">Pos</th>
              <th className="px-3 py-2 font-semibold">No.</th>
              <th className="px-3 py-2 text-right font-semibold">Price</th>
              <th className="px-3 py-2 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {shown.map((p) => (
              <tr key={p.id} onClick={() => setEditing(p)} className={cn("cursor-pointer hover:bg-muted/60", p.status === "left" && "text-muted-foreground")}>
                <td className="px-3 py-2 font-medium">{p.fullName}</td>
                <td className="px-3 py-2">{p.displayName}</td>
                <td className="px-3 py-2">{p.teamShortName}</td>
                <td className="px-3 py-2">{p.position}</td>
                <td className="px-3 py-2 tabular-nums">{p.shirtNumber ?? "–"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{money(p.priceTenths)}</td>
                <td className="px-3 py-2">
                  <Badge variant={p.status === "available" ? "outline" : p.status === "left" ? "secondary" : "destructive"}>{p.status}</Badge>
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  No players match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <EditPlayer player={editing} onClose={() => setEditing(null)} priceOptions={priceOptions} locked={locked} />
      <AddPlayer open={adding} onClose={() => setAdding(false)} teams={teams} priceOptions={priceOptions} locked={locked} />
    </div>
  );
}

function EditPlayer({
  player,
  onClose,
  priceOptions,
  locked,
}: {
  player: AdminPlayer | null;
  onClose: () => void;
  priceOptions: number[];
  locked: boolean;
}) {
  return (
    <Drawer open={player !== null} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent>{player && <EditForm key={player.id} player={player} onClose={onClose} priceOptions={priceOptions} locked={locked} />}</DrawerContent>
    </Drawer>
  );
}

function EditForm({ player, onClose, priceOptions, locked }: { player: AdminPlayer; onClose: () => void; priceOptions: number[]; locked: boolean }) {
  const { run, pending, fieldErrors } = useAdminAction();
  const [fullName, setFullName] = useState(player.fullName);
  const [displayName, setDisplayName] = useState(player.displayName);
  const [position, setPosition] = useState(player.position);
  const [shirt, setShirt] = useState(player.shirtNumber === null ? "" : String(player.shirtNumber));
  const [status, setStatus] = useState(player.status);
  const [price, setPrice] = useState(player.priceTenths);

  function save() {
    run(
      async () => {
        const shirtNumber = shirt === "" ? null : Number(shirt);
        if (
          fullName !== player.fullName ||
          displayName !== player.displayName ||
          position !== player.position ||
          shirtNumber !== player.shirtNumber
        ) {
          const r = await updatePlayer({ playerId: player.id, fullName, displayName, position, shirtNumber });
          if (!r.ok) return r;
        }
        if (status !== player.status) {
          const r = await setPlayerStatus({ playerId: player.id, status });
          if (!r.ok) return r;
        }
        if (price !== player.priceTenths) {
          const r = await setPlayerPrice({ playerId: player.id, priceTenths: price });
          if (!r.ok) return r;
        }
        return { ok: true as const, data: null };
      },
      { success: `${displayName} saved`, onSuccess: onClose },
    );
  }

  return (
    <>
      <DrawerHeader>
        <DrawerTitle>{player.displayName}</DrawerTitle>
        <DrawerDescription>
          {player.teamShortName} · {player.position}
        </DrawerDescription>
      </DrawerHeader>
      <div className="flex flex-col gap-3 overflow-y-auto px-4">
        <Row label="Full name">
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <FieldMessage errors={fieldErrors} name="fullName" />
        </Row>
        <Row label="Shown as" hint="What fantasy and the live pages show.">
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          <FieldMessage errors={fieldErrors} name="displayName" />
        </Row>
        <div className="grid grid-cols-2 gap-3">
          <Row label="Position">
            <Choice label="Position" value={position} onChange={(v) => setPosition(v as AdminPlayer["position"])} options={PLAYER_POSITIONS.map((p) => ({ value: p, label: p }))} />
          </Row>
          <Row label="Shirt number">
            <Input inputMode="numeric" value={shirt} onChange={(e) => setShirt(e.target.value.replace(/\D/g, "").slice(0, 2))} />
          </Row>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Row label="Status" hint={status === "left" ? "Hidden from fantasy picks." : undefined}>
            <Choice label="Status" value={status} onChange={(v) => setStatus(v as AdminPlayer["status"])} options={PLAYER_STATUSES.map((s) => ({ value: s, label: s }))} />
          </Row>
          <Row label="Price" hint={locked ? "Locked since the matchday 1 deadline." : undefined}>
            <Choice label="Price" value={String(price)} disabled={locked} onChange={(v) => setPrice(Number(v))} options={priceOptions.map((t) => ({ value: String(t), label: money(t) }))} />
          </Row>
        </div>
      </div>
      <DrawerFooter className="flex-row">
        <Button variant="outline" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
        <Button className="flex-1" disabled={pending} onClick={save}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </DrawerFooter>
    </>
  );
}

function AddPlayer({
  open,
  onClose,
  teams,
  priceOptions,
  locked,
}: {
  open: boolean;
  onClose: () => void;
  teams: AdminTeam[];
  priceOptions: number[];
  locked: boolean;
}) {
  const { run, pending, fieldErrors } = useAdminAction();
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [fullName, setFullName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [position, setPosition] = useState<AdminPlayer["position"]>("MID");
  const [price, setPrice] = useState(priceOptions[Math.floor(priceOptions.length / 3)] ?? 50);

  function save() {
    run(
      () =>
        createPlayer({
          teamId,
          fullName,
          displayName: displayName || undefined,
          position,
          ...(locked ? {} : { priceTenths: price }),
        }),
      {
        success: `${fullName} added`,
        onSuccess: () => {
          setFullName("");
          setDisplayName("");
          onClose();
        },
      },
    );
  }

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Add a player</DrawerTitle>
          <DrawerDescription>{locked ? "Prices are locked, so new players join at the lowest price." : "They appear in fantasy straight away."}</DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-3 overflow-y-auto px-4">
          <Row label="Year team">
            <Choice label="Year team" value={teamId} onChange={setTeamId} options={teams.map((t) => ({ value: t.id, label: t.name, hint: t.classLabel }))} />
          </Row>
          <Row label="Full name">
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <FieldMessage errors={fieldErrors} name="fullName" />
          </Row>
          <Row label="Shown as" hint="Leave empty to use the first name, or the full name if that's taken.">
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </Row>
          <div className="grid grid-cols-2 gap-3">
            <Row label="Position">
              <Choice label="Position" value={position} onChange={(v) => setPosition(v as AdminPlayer["position"])} options={PLAYER_POSITIONS.map((p) => ({ value: p, label: p }))} />
            </Row>
            <Row label="Price">
              <Choice label="Price" value={String(price)} disabled={locked} onChange={(v) => setPrice(Number(v))} options={priceOptions.map((t) => ({ value: String(t), label: money(t) }))} />
            </Row>
          </div>
        </div>
        <DrawerFooter className="flex-row">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1" disabled={pending || fullName.trim().length < 2} onClick={save}>
            {pending ? "Adding…" : "Add player"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
