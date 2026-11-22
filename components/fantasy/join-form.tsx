"use client";

import { useActionState } from "react";
import { createManagerAction, type OnboardingState } from "@/app/fantasy/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { TeamDot } from "@/components/fantasy/team-badge";
import { cn } from "@/lib/utils";

const YEARS = [
  { value: "1", label: "Year 1", sub: "SEES 31" },
  { value: "2", label: "Year 2", sub: "SEES 30" },
  { value: "3", label: "Year 3", sub: "SEES 29" },
  { value: "4", label: "Year 4", sub: "SEES 28" },
  { value: "5", label: "Year 5", sub: "SEES 26" },
  { value: "none", label: "Not in a year team", sub: "Staff, alumni, guests" },
];

export function JoinForm({
  managerName,
  defaultYear,
  maxLength,
}: {
  managerName: string;
  defaultYear: number | null;
  maxLength: number;
}) {
  const [state, action, pending] = useActionState<OnboardingState, FormData>(createManagerAction, {});
  const year = state.yearGroup ?? (defaultYear ? String(defaultYear) : "");

  return (
    <form action={action} className="flex flex-col gap-6">
      <p className="text-sm">
        Signed in as <span className="font-medium">{managerName}</span>
      </p>

      <Field>
        <FieldLabel htmlFor="teamName">Team name</FieldLabel>
        <Input
          id="teamName"
          name="teamName"
          required
          minLength={3}
          maxLength={maxLength}
          autoComplete="off"
          placeholder="e.g. Ohm's Rangers"
          defaultValue={state.teamName}
          className="h-11 text-base"
        />
        <FieldDescription>3 to {maxLength} characters. Everyone sees it in the rankings.</FieldDescription>
      </Field>

      <FieldSet>
        <FieldLegend>Your year</FieldLegend>
        <FieldDescription>Used for the year rankings.</FieldDescription>
        <div className="grid grid-cols-2 gap-2">
          {YEARS.map((y) => (
            <label
              key={y.value}
              className={cn(
                "flex min-h-16 cursor-pointer flex-col justify-center gap-0.5 rounded-lg border-2 border-border px-3 py-2 has-checked:border-primary has-checked:bg-secondary has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                y.value === "none" && "col-span-2",
              )}
            >
              <input
                type="radio"
                name="yearGroup"
                value={y.value}
                defaultChecked={year === y.value}
                required
                className="sr-only"
              />
              <span className="flex items-center gap-2">
                {y.value !== "none" && <TeamDot year={Number(y.value)} />}
                <span className="text-[0.9375rem] font-semibold">{y.label}</span>
              </span>
              <span className="text-[0.8125rem] text-muted-foreground">{y.sub}</span>
            </label>
          ))}
        </div>
      </FieldSet>

      {state.error && <FieldError>{state.error}</FieldError>}

      <Button type="submit" size="lg" className="h-12 text-base" disabled={pending}>
        {pending ? "Creating…" : "Create team"}
      </Button>
    </form>
  );
}
