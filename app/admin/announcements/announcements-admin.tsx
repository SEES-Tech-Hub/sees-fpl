"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createAnnouncement, endAnnouncement } from "@/lib/admin/actions/announcements";
import type { AdminAnnouncement } from "@/lib/admin/queries/announcements";
import { cn } from "@/lib/utils";
import { FieldMessage, fromWatInput, PageTitle, Row, Choice, toWatInput, useAdminAction } from "../_kit/admin-kit";
import { formatDay, formatTime } from "../wat";

const when = (iso: string) => `${formatDay(iso)}, ${formatTime(iso)}`;

export function AnnouncementsAdmin({ announcements, now }: { announcements: AdminAnnouncement[]; now: string }) {
  const { run, pending, fieldErrors } = useAdminAction();
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"info" | "warning">("info");
  const [startsAt, setStartsAt] = useState(toWatInput(now));
  const [endsAt, setEndsAt] = useState(toWatInput(new Date(new Date(now).getTime() + 6 * 3600_000).toISOString()));

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        title="Announcements"
        description="A one-line banner at the top of every public and fantasy page, for example a venue change or a delay. One shows at a time: the newest that's running."
      />

      <section className="flex flex-col gap-3 rounded-xl border border-border p-4">
        <h2 className="font-heading text-lg font-semibold">New announcement</h2>
        <Row label="Message" hint={`${message.length}/280`}>
          <textarea
            value={message}
            maxLength={280}
            rows={3}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Y2 v Y3 now kicks off at 4:30 pm."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <FieldMessage errors={fieldErrors} name="message" />
        </Row>
        <div className="grid gap-3 sm:grid-cols-3">
          <Row label="Style">
            <Choice
              label="Style"
              value={tone}
              onChange={(v) => setTone(v as "info" | "warning")}
              options={[
                { value: "info", label: "Information" },
                { value: "warning", label: "Warning", hint: "amber" },
              ]}
            />
          </Row>
          <Row label="Starts (WAT)">
            <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </Row>
          <Row label="Ends (WAT)">
            <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            <FieldMessage errors={fieldErrors} name="endsAt" />
          </Row>
        </div>
        <Button
          className="self-start"
          disabled={pending || message.trim().length < 2 || !startsAt || !endsAt}
          onClick={() =>
            run(() => createAnnouncement({ message, tone, startsAt: fromWatInput(startsAt), endsAt: fromWatInput(endsAt) }), {
              success: "Announcement saved",
              onSuccess: () => setMessage(""),
            })
          }
        >
          Publish
        </Button>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">All announcements</h2>
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {announcements.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">None yet.</li>}
          {announcements.map((a) => (
            <li key={a.id} className={cn("flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm", a.state === "ended" && "text-muted-foreground")}>
              <span className="min-w-0 flex-1">
                <span className="block">{a.message}</span>
                <span className="block text-xs text-muted-foreground">
                  {when(a.startsAt)} to {when(a.endsAt)}
                </span>
              </span>
              <Badge variant={a.state === "showing" ? "default" : a.state === "scheduled" ? "secondary" : "outline"}>{a.state}</Badge>
              {a.state !== "ended" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => run(() => endAnnouncement({ announcementId: a.id }), { success: "Announcement ended" })}
                >
                  End now
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
