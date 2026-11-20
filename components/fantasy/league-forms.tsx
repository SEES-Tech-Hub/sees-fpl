"use client";

import { useActionState, useState } from "react";
import { createLeagueAction, joinLeagueAction, type LeagueFormState } from "@/app/fantasy/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function JoinLeagueForm({ codeLength }: { codeLength: number }) {
  const [state, action, pending] = useActionState<LeagueFormState, FormData>(joinLeagueAction, {});
  const [code, setCode] = useState(state.value?.toUpperCase() ?? "");
  const clean = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, codeLength);

  return (
    <form action={action} className="flex flex-col gap-3">
      <Field>
        <FieldLabel htmlFor="code">Join with a code</FieldLabel>
        {/* One real input drawn as six boxes, so paste, autofill and screen readers all work. */}
        <div className="group relative">
          <div className="grid grid-cols-6 gap-2" aria-hidden>
            {Array.from({ length: codeLength }, (_, i) => (
              <span
                key={i}
                className={cn(
                  "flex h-14 items-center justify-center rounded-lg border-2 border-input bg-background font-heading text-2xl font-bold uppercase",
                  i === Math.min(code.length, codeLength - 1) && "group-focus-within:border-ring group-focus-within:shadow-glow",
                  code[i] && "border-primary",
                )}
              >
                {code[i] ?? ""}
              </span>
            ))}
          </div>
          <input
            id="code"
            name="code"
            value={code}
            onChange={(e) => setCode(clean(e.target.value))}
            required
            minLength={codeLength}
            maxLength={codeLength}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            inputMode="text"
            aria-describedby="code-help"
            className="absolute inset-0 h-full w-full rounded-lg bg-transparent text-transparent caret-transparent outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
        <FieldDescription id="code-help">Ask the league&apos;s creator for its {codeLength}-character code.</FieldDescription>
        {state.error && <FieldError>{state.error}</FieldError>}
      </Field>
      <Button type="submit" size="lg" className="h-12 text-[0.9375rem]" disabled={pending || code.length !== codeLength}>
        {pending ? "Joining…" : "Join league"}
      </Button>
    </form>
  );
}

export function CreateLeagueForm() {
  const [state, action, pending] = useActionState<LeagueFormState, FormData>(createLeagueAction, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <Field>
        <FieldLabel htmlFor="name">Start a league</FieldLabel>
        <div className="flex gap-2">
          <Input
            id="name"
            name="name"
            required
            minLength={3}
            maxLength={30}
            defaultValue={state.value}
            autoComplete="off"
            placeholder="e.g. 300L Hostel B"
            className="h-11 flex-1 text-base"
          />
          <Button type="submit" variant="secondary" className="h-11 px-5 text-[0.9375rem]" disabled={pending}>
            {pending ? "Creating…" : "Create league"}
          </Button>
        </div>
        <FieldDescription>You&apos;ll get a code to share with friends.</FieldDescription>
        {state.error && <FieldError>{state.error}</FieldError>}
      </Field>
    </form>
  );
}
