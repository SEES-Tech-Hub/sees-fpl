"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { recordWalkover } from "@/lib/admin/actions/corrections";
import {
  cancelFixture,
  createFixture,
  postponeFixture,
  rescheduleFixture,
  restoreFixture,
  updateFixture,
  type FixtureWriteResult,
} from "@/lib/admin/actions/fixtures";
import { commitFixturesImport, previewFixturesImport } from "@/lib/admin/actions/imports";
import { fillKnockouts } from "@/lib/admin/actions/knockouts";
import { setConsoleHolder } from "@/lib/admin/actions/officials";
import type { AdminFixture, AdminMatchday } from "@/lib/admin/queries/fixtures";
import type { AdminProfile } from "@/lib/admin/queries/officials";
import type { AdminSport, AdminTeam } from "@/lib/admin/queries/sports";
import { cn } from "@/lib/utils";
import { fromWatInput, PageTitle, Row, selectClass, toWatInput, useAdminAction } from "../_kit/admin-kit";
import { CsvImport } from "../_kit/csv-import";
import { formatDay, formatTime } from "../wat";

type Props = {
  fixtures: AdminFixture[];
  sports: AdminSport[];
  teams: AdminTeam[];
  matchdays: AdminMatchday[];
  officials: AdminProfile[];
};

const STATUS_TONE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  scheduled: "outline",
  live: "destructive",
  half_time: "destructive",
  full_time: "secondary",
  walkover: "secondary",
  postponed: "default",
  cancelled: "default",
};

/** Shows a fixture write's deadline warning, if any. */
function warnDeadline(r: FixtureWriteResult) {
  if (r.deadlineWarning) toast.warning(r.deadlineWarning.message, { duration: 10000 });
}

export function FixturesAdmin(props: Props) {
  const { fixtures, sports } = props;
  const [sport, setSport] = useState("all");
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState<AdminFixture | null>(null);
  const [creating, setCreating] = useState(false);

  const shown = fixtures.filter((f) => (sport === "all" || f.sportId === sport) && (status === "all" || f.status === status));
  const byDay = useMemo(() => {
    const m = new Map<string, AdminFixture[]>();
    for (const f of shown) {
      const k = f.kickoffAt ? formatDay(f.kickoffAt) : "No time yet";
      m.set(k, [...(m.get(k) ?? []), f]);
    }
    return [...m];
  }, [shown]);
  const football = sports.find((s) => s.slug === "football");

  return (
    <div className="flex flex-col gap-5">
      <PageTitle
        title="Fixtures"
        description="All times are WAT. Changes show on the live pages within seconds. Open a fixture to reschedule it, give it a console holder or award a walkover."
        action={
          <div className="flex flex-wrap gap-2">
            {football?.events[0] && <FillKnockouts eventId={football.events[0].id} />}
            <CsvImport
              title="Import fixtures"
              columns="sport, event, stage, home, away, date, kickoff_wat, venue, matchday"
              preview={previewFixturesImport}
              commit={async (input) => {
                const r = await commitFixturesImport(input);
                if (r.ok) r.data.deadlineWarnings.forEach((w) => toast.warning(w.message, { duration: 10000 }));
                return r;
              }}
            />
            <Button className="gap-2" onClick={() => setCreating(true)}>
              <Plus className="size-4" /> Add fixture
            </Button>
          </div>
        }
      />

      <div className="grid gap-2 sm:grid-cols-3">
        <select className={selectClass} value={sport} onChange={(e) => setSport(e.target.value)} aria-label="Sport">
          <option value="all">All sports</option>
          {sports.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="all">Any status</option>
          {Object.keys(STATUS_TONE).map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>
      </div>

      {byDay.length === 0 && <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No fixtures match.</p>}
      {byDay.map(([day, list]) => (
        <section key={day} className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">{day}</h2>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {list.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => setEditing(f)}
                  className="grid w-full grid-cols-[4.5rem_1fr_auto] items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-muted/60"
                >
                  <span className="tabular-nums">{f.kickoffAt ? formatTime(f.kickoffAt) : "TBD"}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">
                      {f.label}
                      {f.homeScore !== null && f.status !== "scheduled" ? ` · ${f.homeScore}–${f.awayScore}` : ""}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {f.sportName} · {f.eventName} · {f.stage.replace(/_/g, " ")}
                      {f.matchdayNumber ? ` · MD${f.matchdayNumber}` : ""}
                      {f.venue ? ` · ${f.venue}` : ""}
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <Badge variant={STATUS_TONE[f.status] ?? "outline"}>{f.status.replace("_", " ")}</Badge>
                    <span className={cn("text-xs", f.holderName ? "text-muted-foreground" : "font-medium text-destructive")}>
                      {f.holderName ?? "No holder"}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <Drawer open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DrawerContent className="data-[vaul-drawer-direction=bottom]:max-h-[92dvh]">
          {editing && <EditFixture key={editing.id + editing.updatedAt} fixture={editing} {...props} onClose={() => setEditing(null)} />}
        </DrawerContent>
      </Drawer>
      <Drawer open={creating} onOpenChange={setCreating}>
        <DrawerContent className="data-[vaul-drawer-direction=bottom]:max-h-[92dvh]">
          {creating && <CreateFixture {...props} onClose={() => setCreating(false)} />}
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function TeamSelect({ teams, value, onChange, label }: { teams: AdminTeam[]; value: string; onChange: (v: string) => void; label: string }) {
  return (
    <Row label={label}>
      <select className={selectClass} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">To be decided</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </Row>
  );
}

function MatchdaySelect({ matchdays, value, onChange }: { matchdays: AdminMatchday[]; value: string; onChange: (v: string) => void }) {
  return (
    <Row label="Fantasy matchday" hint="Football only.">
      <select className={selectClass} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">None</option>
        {matchdays.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    </Row>
  );
}

function CreateFixture({ sports, teams, matchdays, onClose }: Props & { onClose: () => void }) {
  const { run, pending } = useAdminAction();
  const events = sports.flatMap((s) => s.events.map((e) => ({ ...e, label: s.events.length > 1 ? `${s.name}: ${e.name}` : s.name })));
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [stage, setStage] = useState("league");
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [kickoff, setKickoff] = useState("");
  const [venue, setVenue] = useState("");
  const [matchday, setMatchday] = useState("");

  const save = () =>
    run(
      () =>
        createFixture({
          eventId,
          stage,
          homeTeamId: home || null,
          awayTeamId: away || null,
          kickoffAt: fromWatInput(kickoff),
          venue: venue || undefined,
          matchdayId: matchday || null,
        }),
      {
        success: "Fixture added",
        onSuccess: (r) => {
          warnDeadline(r);
          onClose();
        },
      },
    );

  return (
    <>
      <DrawerHeader>
        <DrawerTitle>Add a fixture</DrawerTitle>
        <DrawerDescription>Leave both teams empty for a final whose teams aren&apos;t known yet.</DrawerDescription>
      </DrawerHeader>
      <div className="flex flex-col gap-3 overflow-y-auto px-4">
        <Row label="Event">
          <select className={selectClass} value={eventId} onChange={(e) => setEventId(e.target.value)}>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
        </Row>
        <Row label="Stage" hint="league, group, semi_final, third_place, final, heat_1…">
          <Input value={stage} onChange={(e) => setStage(e.target.value.toLowerCase().replace(/\s+/g, "_"))} />
        </Row>
        <div className="grid grid-cols-2 gap-3">
          <TeamSelect teams={teams} value={home} onChange={setHome} label="Home" />
          <TeamSelect teams={teams} value={away} onChange={setAway} label="Away" />
        </div>
        <Row label="Kickoff (WAT)">
          <Input type="datetime-local" value={kickoff} onChange={(e) => setKickoff(e.target.value)} />
        </Row>
        <Row label="Venue">
          <Input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="UNILAG Sports Centre" />
        </Row>
        <MatchdaySelect matchdays={matchdays} value={matchday} onChange={setMatchday} />
      </div>
      <DrawerFooter className="flex-row">
        <Button variant="outline" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
        <Button className="flex-1" disabled={pending || !eventId} onClick={save}>
          {pending ? "Adding…" : "Add fixture"}
        </Button>
      </DrawerFooter>
    </>
  );
}

function EditFixture({ fixture: f, teams, matchdays, officials, onClose }: Props & { fixture: AdminFixture; onClose: () => void }) {
  const { run, pending } = useAdminAction();
  const [stage, setStage] = useState(f.stage);
  const [home, setHome] = useState(f.homeTeamId ?? "");
  const [away, setAway] = useState(f.awayTeamId ?? "");
  const [venue, setVenue] = useState(f.venue ?? "");
  const [matchday, setMatchday] = useState(f.matchdayId ?? "");
  const [kickoff, setKickoff] = useState(toWatInput(f.kickoffAt));
  const [holder, setHolder] = useState(f.consoleHolderId ?? "");
  const started = !["scheduled", "postponed", "cancelled"].includes(f.status);

  const saveDetails = () =>
    run(
      async () => {
        if (toWatInput(f.kickoffAt) !== kickoff) {
          const r = await rescheduleFixture({ fixtureId: f.id, kickoffAt: fromWatInput(kickoff) });
          if (!r.ok) return r;
          warnDeadline(r.data);
        }
        if (!started) {
          const r = await updateFixture({
            fixtureId: f.id,
            stage,
            homeTeamId: home || null,
            awayTeamId: away || null,
            venue: venue || undefined,
            matchdayId: matchday || null,
          });
          if (!r.ok) return r;
          warnDeadline(r.data);
        }
        return { ok: true as const, data: null };
      },
      { success: "Fixture saved" },
    );

  const saveHolder = () =>
    run(() => setConsoleHolder({ fixtureId: f.id, profileId: holder || null }), {
      success: holder ? "Console holder set" : "Console holder cleared",
    });

  return (
    <>
      <DrawerHeader>
        <DrawerTitle>{f.label}</DrawerTitle>
        <DrawerDescription>
          {f.sportName} · {f.eventName} · {f.status.replace("_", " ")}
        </DrawerDescription>
      </DrawerHeader>
      <div className="flex flex-col gap-5 overflow-y-auto px-4 pb-2">
        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Details</h3>
          <Row label="Kickoff (WAT)">
            <Input type="datetime-local" value={kickoff} onChange={(e) => setKickoff(e.target.value)} />
          </Row>
          {started ? (
            <p className="text-xs text-muted-foreground">The match has started, so only the kickoff time can change here.</p>
          ) : (
            <>
              <Row label="Stage">
                <Input value={stage} onChange={(e) => setStage(e.target.value.toLowerCase().replace(/\s+/g, "_"))} />
              </Row>
              <div className="grid grid-cols-2 gap-3">
                <TeamSelect teams={teams} value={home} onChange={setHome} label="Home" />
                <TeamSelect teams={teams} value={away} onChange={setAway} label="Away" />
              </div>
              <Row label="Venue">
                <Input value={venue} onChange={(e) => setVenue(e.target.value)} />
              </Row>
              <MatchdaySelect matchdays={matchdays} value={matchday} onChange={setMatchday} />
            </>
          )}
          <Button disabled={pending} onClick={saveDetails}>
            {pending ? "Saving…" : "Save details"}
          </Button>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Console</h3>
          <Row label="Console holder" hint="The official who records this match. Only officials are listed.">
            <select className={selectClass} value={holder} onChange={(e) => setHolder(e.target.value)}>
              <option value="">Nobody</option>
              {officials.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.displayName ?? o.email}
                </option>
              ))}
            </select>
          </Row>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" disabled={pending} onClick={saveHolder}>
              Save holder
            </Button>
            <Button variant="outline" className="flex-1" asChild>
              <Link href={`/console/${f.id}`}>Open console</Link>
            </Button>
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Status</h3>
          <div className="flex flex-wrap gap-2">
            {f.status === "scheduled" && (
              <>
                <Button variant="outline" disabled={pending} onClick={() => run(() => postponeFixture(f.id), { success: "Postponed" })}>
                  Postpone
                </Button>
                <Button variant="outline" disabled={pending} onClick={() => run(() => cancelFixture(f.id), { success: "Cancelled" })}>
                  Cancel fixture
                </Button>
              </>
            )}
            {(f.status === "postponed" || f.status === "cancelled") && (
              <Button variant="outline" disabled={pending} onClick={() => run(() => restoreFixture(f.id), { success: "Back on the schedule" })}>
                Put back on the schedule
              </Button>
            )}
            {f.status === "scheduled" && f.homeTeamId && f.awayTeamId && (
              <Walkover fixture={f} teams={teams} onDone={onClose} />
            )}
          </div>
        </section>
      </div>
      <DrawerFooter>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </DrawerFooter>
    </>
  );
}

function Walkover({ fixture: f, teams, onDone }: { fixture: AdminFixture; teams: AdminTeam[]; onDone: () => void }) {
  const { run, pending } = useAdminAction();
  const [open, setOpen] = useState(false);
  const [team, setTeam] = useState(f.homeTeamId ?? "");
  const [clientEventId] = useState(() => crypto.randomUUID());
  const name = (id: string | null) => teams.find((t) => t.id === id)?.name ?? "?";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">Award a walkover</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Award a walkover</DialogTitle>
          <DialogDescription>
            The other team wasn&apos;t ready 15 minutes after kickoff. The match ends 3–0 to the team you pick. This can only be undone from the audit log.
          </DialogDescription>
        </DialogHeader>
        <select className={selectClass} value={team} onChange={(e) => setTeam(e.target.value)}>
          <option value={f.homeTeamId ?? ""}>{name(f.homeTeamId)}</option>
          <option value={f.awayTeamId ?? ""}>{name(f.awayTeamId)}</option>
        </select>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              run(() => recordWalkover({ fixtureId: f.id, awardedTeamId: team, clientEventId }), {
                success: `Walkover to ${name(team)}`,
                onSuccess: () => {
                  setOpen(false);
                  onDone();
                },
              })
            }
          >
            Award to {name(team)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FillKnockouts({ eventId }: { eventId: string }) {
  const { run, pending } = useAdminAction();
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Trophy className="size-4" /> Fill football knockouts
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fill the final and third-place match</DialogTitle>
          <DialogDescription>
            Uses the final league table: 1st v 2nd in the final, 3rd v 4th for third place. Only works once all 10 league matches have finished and
            nobody is tied on every tie-breaker.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={pending}
            onClick={() => run(() => fillKnockouts({ eventId }), { success: "Knockouts filled", onSuccess: () => setOpen(false) })}
          >
            Fill knockouts
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
