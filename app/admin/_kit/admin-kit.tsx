"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ActionResult, FieldErrors } from "@/lib/admin/result";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Shared pieces for the admin pages. Every write goes through Henry and
// Akeem's server actions in lib/admin/actions, which check the role again
// and return { ok, data } or { ok: false, error } (never throw).

/** Runs an admin action with a pending flag, a toast, and a page refresh on success. */
export function useAdminAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  function run<T>(
    action: () => Promise<ActionResult<T>>,
    options: { success?: string | ((data: T) => string); onSuccess?: (data: T) => void } = {},
  ) {
    setFieldErrors({});
    start(async () => {
      try {
        const result = await action();
        if (!result.ok) {
          setFieldErrors(result.error.fieldErrors ?? {});
          toast.error(result.error.message);
          return;
        }
        if (options.success) toast.success(typeof options.success === "function" ? options.success(result.data) : options.success);
        options.onSuccess?.(result.data);
        router.refresh();
      } catch {
        toast.error("Something went wrong. Check your connection and try again.");
      }
    });
  }

  return { run, pending, fieldErrors };
}

export function PageTitle({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-primary md:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function FieldMessage({ errors, name }: { errors: FieldErrors; name: string }) {
  const list = errors[name];
  if (!list?.length) return null;
  return <p className="text-xs font-medium text-destructive">{list.join(" ")}</p>;
}

/** A labelled form row. */
export function Row({ label, children, hint, className }: { label: string; children: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <label className={cn("flex flex-col gap-1.5 text-sm", className)}>
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

const WAT_OFFSET_MS = 60 * 60 * 1000;

/** An ISO time as the value of an <input type="datetime-local"> in WAT. */
export function toWatInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + WAT_OFFSET_MS);
  return d.toISOString().slice(0, 16);
}

/** A datetime-local value typed in WAT, as an ISO time with the +01:00 offset. */
export function fromWatInput(value: string): string | null {
  if (!value) return null;
  return `${value.length === 16 ? `${value}:00` : value}+01:00`;
}

export const selectClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

// ---------------------------------------------------------------------------
// Choice: the shadcn Select for every admin dropdown
// ---------------------------------------------------------------------------

/** Radix Select can't hold "", so "nothing chosen" travels as this. */
const NONE = "__none__";

export type ChoiceOption = { value: string; label: string; disabled?: boolean; hint?: string };

export function Choice({
  value,
  onChange,
  options,
  placeholder = "Choose…",
  noneLabel,
  disabled,
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: ChoiceOption[];
  placeholder?: string;
  /** Adds a "nothing" option with this label; it maps to "". */
  noneLabel?: string;
  disabled?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <Select value={value === "" ? (noneLabel ? NONE : undefined) : value} onValueChange={(v) => onChange(v === NONE ? "" : v)} disabled={disabled}>
      <SelectTrigger className={cn("h-10 w-full", className)} aria-label={label}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent position="popper" sideOffset={4}>
        {noneLabel && <SelectItem value={NONE}>{noneLabel}</SelectItem>}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
            {o.hint && <span className="ml-1 text-xs text-muted-foreground">{o.hint}</span>}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** The stages fixtures can have (the database accepts lowercase words and _). */
export const STAGES: ChoiceOption[] = [
  { value: "league", label: "League", hint: "counts in the table" },
  { value: "group", label: "Group stage" },
  { value: "preliminary", label: "Preliminary" },
  { value: "eliminator", label: "Eliminator" },
  { value: "round_1", label: "Round 1 (knockout)" },
  { value: "best_loser", label: "Best loser" },
  { value: "quarter_final", label: "Quarter-final" },
  { value: "semi_final", label: "Semi-final" },
  { value: "semi_final_a", label: "Semi-final A", hint: "filled by Fill knockouts" },
  { value: "semi_final_b", label: "Semi-final B", hint: "filled by Fill knockouts" },
  { value: "third_place", label: "Third-place match" },
  { value: "final", label: "Final" },
  { value: "heat_1", label: "Heat 1" },
  { value: "heat_2", label: "Heat 2" },
  { value: "heat_3", label: "Heat 3" },
  { value: "heat_4", label: "Heat 4" },
  { value: "friendly", label: "Friendly / test", hint: "counts nowhere" },
];
