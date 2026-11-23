"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { SportIcon } from "@/components/ui/shared/SportIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createEvent, createSport, updateEvent, updateSport } from "@/lib/admin/actions/sports";
import type { AdminEvent, AdminSport } from "@/lib/admin/queries/sports";
import { RESULT_FORMATS } from "@/lib/admin/types";
import { Choice, FieldMessage, PageTitle, Row, useAdminAction } from "../_kit/admin-kit";

const FORMAT: Record<string, { label: string; about: string }> = {
  timed: { label: "Timed match", about: "Two teams, a clock and periods. Goals or points, cards and subs are recorded in the console." },
  sets: { label: "Sets", about: "Two teams, scored set by set. The match ends when a team wins enough sets." },
  head_to_head: { label: "Head-to-head", about: "Two entrants, a winner and an optional score. Shown as results and a bracket." },
  ranked: { label: "Races and results", about: "Many entrants in finishing order with times or distances. Medals for the top three." },
};
const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const num = (v: string) => (v === "" ? null : Number(v));
const icon = (slug: string) => slug.replace(/-/g, "_");

export function SportsAdmin({ sports }: { sports: AdminSport[] }) {
  const [tab, setTab] = useState(sports[0]?.id ?? "new");
  return (
    <div className="flex flex-col gap-5">
      <PageTitle
        title="Sports and events"
        description={
          <>
            Each <strong>sport</strong> has a result format and one or more <strong>events</strong>, the actual competitions (for example Football
            (men), or 100 m and 200 m under Athletics). Matches are added per event on the <Link href="/admin/fixtures" className="underline underline-offset-4">Fixtures</Link> page.
          </>
        }
      />
      <Tabs value={tab} onValueChange={setTab} orientation="vertical" className="flex flex-col gap-4 md:flex-row">
        <TabsList className="h-auto w-full flex-row justify-start gap-1 overflow-x-auto bg-muted p-1 md:w-56 md:shrink-0 md:flex-col md:items-stretch">
          {sports.map((s) => (
            <TabsTrigger key={s.id} value={s.id} className="h-10 shrink-0 justify-start gap-2 px-3 md:w-full">
              <SportIcon sport={icon(s.slug)} size={16} />
              {s.name}
              <span className="ml-auto pl-2 text-xs text-muted-foreground tabular-nums">{s.events.reduce((n, e) => n + e.fixtureCount, 0)}</span>
            </TabsTrigger>
          ))}
          <TabsTrigger value="new" className="h-10 shrink-0 justify-start gap-2 px-3 md:w-full">
            <Plus className="size-4" /> New sport
          </TabsTrigger>
        </TabsList>
        <div className="min-w-0 flex-1">
          {sports.map((s) => (
            <TabsContent key={s.id} value={s.id} className="mt-0">
              <SportPanel sport={s} />
            </TabsContent>
          ))}
          <TabsContent value="new" className="mt-0">
            <AddSport nextOrder={(sports.at(-1)?.sortOrder ?? 0) + 10} onAdded={() => setTab(sports[0]?.id ?? "new")} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function SportPanel({ sport }: { sport: AdminSport }) {
  const { run, pending } = useAdminAction();
  const [name, setName] = useState(sport.name);
  const [order, setOrder] = useState(String(sport.sortOrder));
  const [adding, setAdding] = useState(false);
  const fixtures = sport.events.reduce((n, e) => n + e.fixtureCount, 0);
  const format = FORMAT[sport.resultFormat];

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border p-4 motion-safe:animate-in motion-safe:fade-in">
      <div className="flex items-start gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-pitch text-brand-light">
          <SportIcon sport={icon(sport.slug)} size={24} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-heading text-2xl leading-tight font-semibold">{sport.name}</p>
          <p className="text-sm text-muted-foreground">
            <Badge variant="outline" className="mr-2">
              {format.label}
            </Badge>
            {fixtures} {fixtures === 1 ? "fixture" : "fixtures"} across {sport.events.length} {sport.events.length === 1 ? "event" : "events"}
          </p>
        </div>
      </div>
      <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">{format.about}</p>

      <div className="grid gap-3 sm:grid-cols-[1fr_6rem_auto] sm:items-end">
        <Row label="Sport name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Row>
        <Row label="Order" hint="Lower comes first.">
          <Input inputMode="numeric" value={order} onChange={(e) => setOrder(e.target.value.replace(/\D/g, ""))} />
        </Row>
        <Button
          variant="secondary"
          disabled={pending || (name === sport.name && order === String(sport.sortOrder))}
          onClick={() => run(() => updateSport({ sportId: sport.id, name, sortOrder: Number(order) }), { success: `${name} saved` })}
        >
          Save
        </Button>
      </div>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Events</h3>
          <Button variant="ghost" size="sm" className="gap-1.5" asChild>
            <Link href="/admin/fixtures">
              Add fixtures <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
        {sport.events.length === 0 && <p className="text-sm text-muted-foreground">No events yet. Add one below before adding fixtures.</p>}
        <ul className="flex flex-col gap-2">
          {sport.events.map((e) => (
            <EventCard key={e.id} event={e} timed={sport.resultFormat === "timed"} />
          ))}
        </ul>
        {adding ? (
          <AddEvent sport={sport} onDone={() => setAdding(false)} />
        ) : (
          <Button variant="outline" size="sm" className="gap-1.5 self-start" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> Add an event
          </Button>
        )}
      </section>
    </div>
  );
}

function EventCard({ event: e, timed }: { event: AdminEvent; timed: boolean }) {
  const { run, pending } = useAdminAction();
  const [name, setName] = useState(e.name);
  const [minutes, setMinutes] = useState(e.periodMinutes === null ? "" : String(e.periodMinutes));
  const [count, setCount] = useState(e.periodCount === null ? "" : String(e.periodCount));
  const [extra, setExtra] = useState(e.extraPeriodMinutes === null ? "" : String(e.extraPeriodMinutes));
  const changed = name !== e.name || num(minutes) !== e.periodMinutes || num(count) !== e.periodCount || num(extra) !== e.extraPeriodMinutes;
  const missingClock = timed && (e.periodMinutes === null || e.periodCount === null);
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold">{e.name}</p>
        <Badge variant={e.fixtureCount ? "secondary" : "outline"}>
          {e.fixtureCount} {e.fixtureCount === 1 ? "fixture" : "fixtures"}
        </Badge>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_repeat(3,6rem)_auto] sm:items-end">
        <Row label="Event name">
          <Input value={name} onChange={(x) => setName(x.target.value)} />
        </Row>
        {timed && (
          <>
            <Row label="Period (min)">
              <Input inputMode="numeric" value={minutes} onChange={(x) => setMinutes(x.target.value.replace(/\D/g, ""))} />
            </Row>
            <Row label="Periods">
              <Input inputMode="numeric" value={count} onChange={(x) => setCount(x.target.value.replace(/\D/g, ""))} />
            </Row>
            <Row label="Extra (min)">
              <Input inputMode="numeric" value={extra} onChange={(x) => setExtra(x.target.value.replace(/\D/g, ""))} />
            </Row>
          </>
        )}
        <Button
          variant="outline"
          disabled={pending || !changed}
          onClick={() =>
            run(
              () =>
                updateEvent({
                  eventId: e.id,
                  name,
                  ...(timed ? { periodMinutes: num(minutes), periodCount: num(count), extraPeriodMinutes: num(extra) } : {}),
                }),
              { success: `${name} saved` },
            )
          }
        >
          Save
        </Button>
      </div>
      {missingClock && (
        <p className="text-xs font-medium text-destructive">Set the period length and number of periods, or the match clock can&apos;t run.</p>
      )}
    </li>
  );
}

function AddEvent({ sport, onDone }: { sport: AdminSport; onDone: () => void }) {
  const { run, pending, fieldErrors } = useAdminAction();
  const [name, setName] = useState("");
  const taken = sport.events.some((e) => e.name.trim().toLowerCase() === name.trim().toLowerCase());
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-3">
      <div className="flex flex-wrap items-end gap-2">
        <Row label="New event name" className="min-w-56 flex-1">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={sport.resultFormat === "ranked" ? "200 m women" : `${sport.name} (women)`}
          />
          <FieldMessage errors={fieldErrors} name="slug" />
        </Row>
        <Button
          disabled={pending || name.trim().length < 2 || taken}
          onClick={() =>
            run(() => createEvent({ sportId: sport.id, name, slug: slugify(`${sport.slug}-${name}`) }), {
              success: `${name} added`,
              onSuccess: onDone,
            })
          }
        >
          Add
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
      {taken && <p className="text-xs font-medium text-destructive">{sport.name} already has an event with that name.</p>}
    </div>
  );
}

function AddSport({ nextOrder, onAdded }: { nextOrder: number; onAdded: () => void }) {
  const { run, pending, fieldErrors } = useAdminAction();
  const [name, setName] = useState("");
  const [format, setFormat] = useState<(typeof RESULT_FORMATS)[number]>("head_to_head");
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border p-4">
      <p className="font-heading text-xl font-semibold">Add a sport</p>
      <Row label="Name">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Chess" />
        <FieldMessage errors={fieldErrors} name="slug" />
      </Row>
      <Row label="Result format" hint={FORMAT[format].about}>
        <Choice
          label="Result format"
          value={format}
          onChange={(v) => setFormat(v as typeof format)}
          options={RESULT_FORMATS.map((f) => ({ value: f, label: FORMAT[f].label }))}
        />
      </Row>
      <Button
        className="self-start"
        disabled={pending || name.trim().length < 2}
        onClick={() =>
          run(() => createSport({ name, slug: slugify(name), resultFormat: format, sortOrder: nextOrder }), {
            success: `${name} added. Add its events next.`,
            onSuccess: () => {
              setName("");
              onAdded();
            },
          })
        }
      >
        Add sport
      </Button>
    </div>
  );
}
