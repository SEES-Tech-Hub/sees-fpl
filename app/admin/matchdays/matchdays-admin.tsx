"use client";

import { useState } from "react";
import { Calculator, Flag } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { finaliseMatchday, recalculateMatchday } from "@/lib/admin/actions/corrections";
import { setMatchdayDeadline } from "@/lib/admin/actions/matchdays";
import type { AdminMatchday } from "@/lib/admin/queries/fixtures";
import { fromWatInput, PageTitle, toWatInput, useAdminAction } from "../_kit/admin-kit";
import { formatDay, formatTime } from "../wat";

export function MatchdaysAdmin({ matchdays, minutesBefore }: { matchdays: AdminMatchday[]; minutesBefore: number }) {
  return (
    <div className="flex flex-col gap-5">
      <PageTitle
        title="Matchdays"
        description={`Fantasy deadlines (WAT). The rule is at least ${minutesBefore} minutes before the matchday's first kickoff. After the matches, recalculate points (provisional) and finalise once results are checked.`}
      />
      <ul className="flex flex-col gap-3">
        {matchdays.map((m) => (
          <MatchdayCard key={m.id + (m.deadlineAt ?? "")} matchday={m} minutesBefore={minutesBefore} />
        ))}
      </ul>
    </div>
  );
}

function MatchdayCard({ matchday: m, minutesBefore }: { matchday: AdminMatchday; minutesBefore: number }) {
  const { run, pending } = useAdminAction();
  const [deadline, setDeadline] = useState(toWatInput(m.deadlineAt));
  const gap =
    m.deadlineAt && m.firstKickoffAt ? Math.round((new Date(m.firstKickoffAt).getTime() - new Date(m.deadlineAt).getTime()) / 60000) : null;
  const tooClose = gap !== null && gap < minutesBefore;

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-heading text-lg font-semibold">{m.name}</p>
          <p className="text-sm text-muted-foreground">
            {m.fixtureCount} fixtures
            {m.firstKickoffAt ? ` · first kickoff ${formatDay(m.firstKickoffAt)}, ${formatTime(m.firstKickoffAt)}` : " · no kickoff times yet"}
          </p>
        </div>
        <Badge variant={m.status === "finalised" ? "secondary" : m.status === "locked" ? "destructive" : "outline"}>{m.status}</Badge>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Deadline (WAT)</span>
          <Input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="w-56" />
        </label>
        <Button
          variant="secondary"
          disabled={pending || !deadline || deadline === toWatInput(m.deadlineAt)}
          onClick={() => run(() => setMatchdayDeadline({ matchdayId: m.id, deadlineAt: fromWatInput(deadline)! }), { success: "Deadline saved" })}
        >
          Save deadline
        </Button>
      </div>
      {tooClose && (
        <p className="text-sm font-medium text-destructive">
          Only {gap} minutes before the first kickoff. The rule is {minutesBefore}.
        </p>
      )}

      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
        <Button
          variant="outline"
          className="gap-2"
          disabled={pending}
          onClick={() =>
            run(() => recalculateMatchday({ matchdayId: m.id }), {
              success: (d) => `Points recalculated for ${d.managersUpdated} managers${d.finalised ? " (still final)" : " (provisional)"}`,
            })
          }
        >
          <Calculator className="size-4" /> Recalculate points
        </Button>
        {m.status !== "finalised" && <Finalise matchday={m} />}
      </div>
    </li>
  );
}

function Finalise({ matchday: m }: { matchday: AdminMatchday }) {
  const { run, pending } = useAdminAction();
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Flag className="size-4" /> Finalise
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Finalise {m.name}?</DialogTitle>
          <DialogDescription>
            Points stop being provisional and the rankings update. Do this once every match that matchday is finished and its events are checked.
            A correction later recalculates it again.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              run(() => finaliseMatchday({ matchdayId: m.id }), {
                success: (d) => `${m.name} finalised for ${d.managersUpdated} managers`,
                onSuccess: () => setOpen(false),
              })
            }
          >
            Finalise
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
