"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Clock, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCountdown, formatWAT } from "@/lib/fantasy/time";
import { cn } from "@/lib/utils";

const SOON_MS = 2 * 60 * 60 * 1000;

/**
 * Ticks once a second, corrected by the server's clock so a wrong phone clock
 * doesn't mislead anyone (the server still enforces the deadline).
 * Returns ms left, or null before the first tick.
 */
export function useDeadline(deadlineAt: string | null, serverNow: number, onPassed?: () => void) {
  const offset = useRef<number | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const fired = useRef(false);

  useEffect(() => {
    if (offset.current === null) offset.current = serverNow - Date.now();
    if (!deadlineAt) return;
    const target = new Date(deadlineAt).getTime();
    const tick = () => {
      const ms = target - (Date.now() + (offset.current ?? 0));
      setLeft(ms);
      if (ms <= 0 && !fired.current) {
        fired.current = true;
        onPassed?.();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadlineAt, serverNow, onPassed]);

  return left;
}

/** "Deadline in 3d 21h" for captions. */
export function DeadlineIn({ deadlineAt, serverNow }: { deadlineAt: string | null; serverNow: number }) {
  const left = useDeadline(deadlineAt, serverNow);
  if (!deadlineAt) return <>Deadline TBC</>;
  if (left === null) return <>Deadline {formatWAT(deadlineAt)}</>;
  if (left <= 0) return <>Deadline passed</>;
  return (
    <>
      Deadline in{" "}
      <span
        className={cn("tabular-nums", left < SOON_MS && "rounded-sm bg-highlight px-1 text-highlight-foreground")}
      >
        {formatCountdown(left)}
      </span>
    </>
  );
}

/** Design system §11.3 DeadlineCard. */
export function DeadlineCard({
  matchdayName,
  matchdayNumber,
  deadlineAt,
  serverNow,
  action,
  onPassed,
  className,
}: {
  matchdayName: string;
  matchdayNumber: number;
  deadlineAt: string | null;
  serverNow: number;
  action?: { href: string; label: string };
  onPassed?: () => void;
  className?: string;
}) {
  const left = useDeadline(deadlineAt, serverNow, onPassed);
  const passed = left !== null && left <= 0;
  const soon = left !== null && left > 0 && left < SOON_MS;

  return (
    <section
      aria-label={`${matchdayName} deadline`}
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-card",
        soon && "border-highlight bg-highlight text-highlight-foreground",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {passed ? (
          <Lock className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        ) : (
          <Clock className={cn("mt-0.5 size-5 shrink-0 text-brand", soon && "text-highlight-foreground")} />
        )}
        <div className="min-w-0 flex-1">
          <p className={cn("text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase", soon && "text-highlight-foreground/80")}>
            Matchday {matchdayNumber} deadline
          </p>
          <p className="text-sm font-medium">{formatWAT(deadlineAt)} WAT</p>
          {soon && <p className="text-xs font-semibold">Deadline soon</p>}
        </div>
        <p
          className="font-heading text-3xl font-bold tabular-nums"
          suppressHydrationWarning
        >
          {deadlineAt === null ? "TBC" : left === null ? "–" : passed ? "Locked" : formatCountdown(left)}
        </p>
      </div>
      {passed ? (
        <p className="text-sm text-muted-foreground">
          Deadline passed. Your team is locked for Matchday {matchdayNumber}.
        </p>
      ) : action ? (
        <Button asChild size="lg" className="h-11 text-[0.9375rem]">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      ) : null}
    </section>
  );
}
