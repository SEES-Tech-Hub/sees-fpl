"use client";

import { useEffect, useState } from "react";
import { Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { voidMatchEvent } from "@/lib/admin/actions/corrections";
import type { TimelineEntry } from "@/lib/live/types";
import { useAdminAction } from "../_kit/admin-kit";
import { loadFixtureEvents } from "./events-actions";

// Corrections after the official's 30-second undo: the admin voids any event
// with a reason (a goal ruled out, a card given to the wrong player). The
// score, table, stats and fantasy points recalculate from what's left. To
// put the right event in, the admin records it from the console.

const LABEL: Record<string, string> = {
  goal: "Goal",
  card: "Card",
  substitution: "Sub",
  penalty_miss: "Penalty missed",
  shootout_kick: "Shootout kick",
  man_of_the_match: "Player of the match",
  period_start: "Period start",
  period_end: "Period end",
  full_time: "Full time",
  walkover: "Walkover",
  point: "Point",
  set_end: "Set end",
};

function describe(e: TimelineEntry) {
  const who = e.playerName ?? "";
  if (e.type === "goal") return `${who || "Goal"}${e.isOwnGoal ? " (OG)" : e.isPenalty ? " (pen)" : ""}${e.otherPlayerName && !e.isOwnGoal ? `, assist ${e.otherPlayerName}` : ""}`;
  if (e.type === "card") return `${e.card === "red" ? "Red" : "Yellow"}: ${who}`;
  if (e.type === "substitution") return `${e.otherPlayerName ?? "?"} on for ${who}`;
  return who;
}

export function MatchEvents({ fixtureId }: { fixtureId: string }) {
  const [events, setEvents] = useState<TimelineEntry[] | null>(null);
  const [voiding, setVoiding] = useState<TimelineEntry | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    loadFixtureEvents(fixtureId).then((list) => live && setEvents(list)).catch(() => live && setEvents([]));
    return () => {
      live = false;
    };
  }, [fixtureId, reload]);

  if (events === null) return <p className="text-sm text-muted-foreground">Loading events…</p>;
  if (events.length === 0) return <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>;

  return (
    <>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {[...events].reverse().map((e) => (
          <li key={e.id} className="flex items-center gap-2 px-3 py-2 text-sm">
            <span className="w-10 shrink-0 text-xs font-semibold text-muted-foreground tabular-nums">
              {e.minute !== null ? `${e.minute}${e.addedMinutes ? `+${e.addedMinutes}` : ""}'` : ""}
            </span>
            <span className="min-w-0 flex-1">
              <span className="font-semibold">{LABEL[e.type] ?? e.type}</span>
              {e.teamShortName && <span className="text-muted-foreground"> · {e.teamShortName}</span>}
              <span className="block truncate text-xs text-muted-foreground">{describe(e)}</span>
            </span>
            <Button size="sm" variant="ghost" className="gap-1 text-destructive hover:text-destructive" onClick={() => setVoiding(e)}>
              <Ban className="size-3.5" /> Void
            </Button>
          </li>
        ))}
      </ul>
      <VoidDialog
        event={voiding}
        onClose={() => setVoiding(null)}
        onDone={() => {
          setVoiding(null);
          setReload((n) => n + 1);
        }}
      />
    </>
  );
}

function VoidDialog({ event, onClose, onDone }: { event: TimelineEntry | null; onClose: () => void; onDone: () => void }) {
  const { run, pending, fieldErrors } = useAdminAction();
  const [reason, setReason] = useState("");
  return (
    <Dialog open={event !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        {event && (
          <>
            <DialogHeader>
              <DialogTitle>Void this {LABEL[event.type]?.toLowerCase() ?? "event"}?</DialogTitle>
              <DialogDescription>
                {describe(event) || LABEL[event.type]}. It disappears from the match, and the score, table, stats and fantasy points recalculate.
                It stays in the audit log with your reason.
              </DialogDescription>
            </DialogHeader>
            <Input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason, e.g. goal ruled out for offside" />
            {fieldErrors.reason && <p className="text-xs font-medium text-destructive">{fieldErrors.reason.join(" ")}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={pending || reason.trim().length < 5}
                onClick={() =>
                  run(() => voidMatchEvent({ clientEventId: event.clientEventId, reason }), {
                    success: "Event voided",
                    onSuccess: () => {
                      setReason("");
                      onDone();
                    },
                  })
                }
              >
                Void it
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
