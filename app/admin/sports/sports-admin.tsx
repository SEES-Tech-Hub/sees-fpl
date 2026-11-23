"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { SportIcon } from "@/components/ui/shared/SportIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createEvent, createSport, updateEvent, updateSport } from "@/lib/admin/actions/sports";
import type { AdminEvent, AdminSport } from "@/lib/admin/queries/sports";
import { RESULT_FORMATS } from "@/lib/admin/types";
import { FieldMessage, PageTitle, Row, selectClass, useAdminAction } from "../_kit/admin-kit";

const FORMAT_LABEL: Record<string, string> = {
  timed: "Timed match",
  sets: "Sets",
  head_to_head: "Head-to-head",
  ranked: "Races and results",
};
const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const num = (v: string) => (v === "" ? null : Number(v));

export function SportsAdmin({ sports }: { sports: AdminSport[] }) {
  return (
    <div className="flex flex-col gap-5">
      <PageTitle
        title="Sports and events"
        description="Each sport has a result format and one or more events (for example 100 m men under athletics). A sport's format can't change once it has fixtures."
      />
      <ul className="flex flex-col gap-3">
        {sports.map((s) => (
          <SportCard key={s.id} sport={s} />
        ))}
      </ul>
      <AddSport nextOrder={(sports.at(-1)?.sortOrder ?? 0) + 10} />
    </div>
  );
}

function SportCard({ sport }: { sport: AdminSport }) {
  const { run, pending } = useAdminAction();
  const [name, setName] = useState(sport.name);
  const [order, setOrder] = useState(String(sport.sortOrder));
  const [adding, setAdding] = useState(false);
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-end gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg bg-secondary text-brand">
          <SportIcon sport={sport.slug.replace(/-/g, "_")} size={20} />
        </span>
        <Row label="Name" className="min-w-48 flex-1">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Row>
        <Row label="Order" className="w-20">
          <Input inputMode="numeric" value={order} onChange={(e) => setOrder(e.target.value.replace(/\D/g, ""))} />
        </Row>
        <Badge variant="outline" className="mb-2.5">
          {FORMAT_LABEL[sport.resultFormat]}
        </Badge>
        <Button
          variant="secondary"
          disabled={pending || (name === sport.name && order === String(sport.sortOrder))}
          onClick={() => run(() => updateSport({ sportId: sport.id, name, sortOrder: Number(order) }), { success: `${name} saved` })}
        >
          Save
        </Button>
      </div>
      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
        {sport.events.map((e) => (
          <EventRow key={e.id} event={e} timed={sport.resultFormat === "timed"} />
        ))}
      </ul>
      {adding ? (
        <AddEvent sport={sport} onDone={() => setAdding(false)} />
      ) : (
        <Button variant="ghost" size="sm" className="self-start gap-1.5" onClick={() => setAdding(true)}>
          <Plus className="size-4" /> Add an event
        </Button>
      )}
    </li>
  );
}

function EventRow({ event: e, timed }: { event: AdminEvent; timed: boolean }) {
  const { run, pending } = useAdminAction();
  const [name, setName] = useState(e.name);
  const [minutes, setMinutes] = useState(e.periodMinutes === null ? "" : String(e.periodMinutes));
  const [count, setCount] = useState(e.periodCount === null ? "" : String(e.periodCount));
  const [extra, setExtra] = useState(e.extraPeriodMinutes === null ? "" : String(e.extraPeriodMinutes));
  const changed =
    name !== e.name ||
    num(minutes) !== e.periodMinutes ||
    num(count) !== e.periodCount ||
    num(extra) !== e.extraPeriodMinutes;
  return (
    <li className="flex flex-wrap items-end gap-3 px-3 py-2.5">
      <Row label={`Event · ${e.fixtureCount} fixtures`} className="min-w-44 flex-1">
        <Input value={name} onChange={(x) => setName(x.target.value)} />
      </Row>
      {timed && (
        <>
          <Row label="Period min" className="w-24">
            <Input inputMode="numeric" value={minutes} onChange={(x) => setMinutes(x.target.value.replace(/\D/g, ""))} />
          </Row>
          <Row label="Periods" className="w-20">
            <Input inputMode="numeric" value={count} onChange={(x) => setCount(x.target.value.replace(/\D/g, ""))} />
          </Row>
          <Row label="Extra min" className="w-24">
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
    </li>
  );
}

function AddEvent({ sport, onDone }: { sport: AdminSport; onDone: () => void }) {
  const { run, pending, fieldErrors } = useAdminAction();
  const [name, setName] = useState("");
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Row label="New event name" className="min-w-56 flex-1">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={sport.resultFormat === "ranked" ? "200 m women" : "Doubles"} />
        <FieldMessage errors={fieldErrors} name="slug" />
      </Row>
      <Button
        disabled={pending || name.trim().length < 2}
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
  );
}

function AddSport({ nextOrder }: { nextOrder: number }) {
  const { run, pending, fieldErrors } = useAdminAction();
  const [name, setName] = useState("");
  const [format, setFormat] = useState<(typeof RESULT_FORMATS)[number]>("head_to_head");
  return (
    <section className="flex flex-wrap items-end gap-3 rounded-xl border border-dashed border-border p-4">
      <Row label="New sport" className="min-w-48 flex-1">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Chess" />
        <FieldMessage errors={fieldErrors} name="slug" />
      </Row>
      <Row label="Result format" className="w-48">
        <select className={selectClass} value={format} onChange={(e) => setFormat(e.target.value as typeof format)}>
          {RESULT_FORMATS.map((f) => (
            <option key={f} value={f}>
              {FORMAT_LABEL[f]}
            </option>
          ))}
        </select>
      </Row>
      <Button
        disabled={pending || name.trim().length < 2}
        onClick={() =>
          run(() => createSport({ name, slug: slugify(name), resultFormat: format, sortOrder: nextOrder }), {
            success: `${name} added. Add its events next.`,
            onSuccess: () => setName(""),
          })
        }
      >
        Add sport
      </Button>
    </section>
  );
}
