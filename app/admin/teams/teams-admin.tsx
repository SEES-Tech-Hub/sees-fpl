"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateTeam } from "@/lib/admin/actions/sports";
import type { AdminTeam } from "@/lib/admin/queries/sports";
import { teamColour } from "@/lib/design/team-colour";
import { FieldMessage, PageTitle, Row, useAdminAction } from "../_kit/admin-kit";

export function TeamsAdmin({ teams }: { teams: AdminTeam[] }) {
  return (
    <div className="flex flex-col gap-5">
      <PageTitle title="Teams" description="The five year teams. Names show everywhere: fixtures, tables, fantasy and the console." />
      <ul className="grid gap-3 lg:grid-cols-2">
        {teams.map((t) => (
          <TeamCard key={t.id} team={t} />
        ))}
      </ul>
    </div>
  );
}

function TeamCard({ team }: { team: AdminTeam }) {
  const { run, pending, fieldErrors } = useAdminAction();
  const [name, setName] = useState(team.name);
  const [shortName, setShortName] = useState(team.shortName);
  const [classLabel, setClassLabel] = useState(team.classLabel);
  const [coaches, setCoaches] = useState(team.coaches.join(", "));
  const list = coaches
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  const changed = name !== team.name || shortName !== team.shortName || classLabel !== team.classLabel || list.join("|") !== team.coaches.join("|");

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border p-4" style={{ boxShadow: `inset 4px 0 0 ${teamColour(team.year)}` }}>
      <p className="font-heading text-lg font-semibold">Year {team.year}</p>
      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <Row label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
          <FieldMessage errors={fieldErrors} name="name" />
        </Row>
        <Row label="Short">
          <Input value={shortName} onChange={(e) => setShortName(e.target.value)} />
        </Row>
      </div>
      <Row label="Class">
        <Input value={classLabel} onChange={(e) => setClassLabel(e.target.value)} />
      </Row>
      <Row label="Coaches" hint="Separate names with commas.">
        <Input value={coaches} onChange={(e) => setCoaches(e.target.value)} />
        <FieldMessage errors={fieldErrors} name="coaches" />
      </Row>
      <Button
        className="self-start"
        disabled={pending || !changed}
        onClick={() => run(() => updateTeam({ teamId: team.id, name, shortName, classLabel, coaches: list }), { success: `${name} saved` })}
      >
        {pending ? "Saving…" : "Save"}
      </Button>
    </li>
  );
}
