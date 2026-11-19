"use client";

import { useActionState } from "react";
import { createLeagueAction, joinLeagueAction, type LeagueFormState } from "@/app/fantasy/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function JoinLeagueForm({ codeLength }: { codeLength: number }) {
  const [state, action, pending] = useActionState<LeagueFormState, FormData>(joinLeagueAction, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <Field>
        <FieldLabel htmlFor="code">Join with a code</FieldLabel>
        <div className="flex gap-2">
          <Input
            id="code"
            name="code"
            required
            minLength={codeLength}
            maxLength={codeLength}
            defaultValue={state.value}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="ABC123"
            className="h-11 flex-1 font-mono text-base tracking-widest uppercase"
          />
          <Button type="submit" className="h-11 px-5" disabled={pending}>
            {pending ? "Joining…" : "Join"}
          </Button>
        </div>
        <FieldDescription>Ask the league&apos;s creator for its {codeLength}-character code.</FieldDescription>
        {state.error && <FieldError>{state.error}</FieldError>}
      </Field>
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
          <Button type="submit" variant="secondary" className="h-11 px-5" disabled={pending}>
            {pending ? "Creating…" : "Create"}
          </Button>
        </div>
        <FieldDescription>You&apos;ll get a code to share with friends.</FieldDescription>
        {state.error && <FieldError>{state.error}</FieldError>}
      </Field>
    </form>
  );
}
