"use client";

import { useEffect, useState } from "react";
import { Clock, Lock } from "lucide-react";
import { formatCountdown, formatWAT } from "@/lib/fantasy/time";
import { cn } from "@/lib/utils";

/**
 * Live countdown to a deadline. Display only: the server enforces the lock.
 * Calls `onPassed` once when it reaches zero so the screen can switch to read-only.
 */
export function DeadlineCountdown({
  deadlineAt,
  label,
  onPassed,
  className,
}: {
  deadlineAt: string | null;
  label: string;
  onPassed?: () => void;
  className?: string;
}) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const target = deadlineAt ? new Date(deadlineAt).getTime() : null;
  const left = target !== null && now !== null ? target - now : null;
  const passed = left !== null && left <= 0;

  useEffect(() => {
    if (passed) onPassed?.();
  }, [passed, onPassed]);

  const urgent = left !== null && left > 0 && left < 2 * 60 * 60 * 1000;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2",
        urgent && "border-live/50",
        className,
      )}
    >
      {passed ? <Lock className="size-5 text-muted-foreground" /> : <Clock className={cn("size-5 text-brand", urgent && "text-live")} />}
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{formatWAT(deadlineAt)} WAT</p>
      </div>
      <p
        className={cn("font-heading text-lg font-semibold tabular-nums", urgent && "text-live")}
        aria-live="off"
        suppressHydrationWarning
      >
        {deadlineAt === null ? "TBC" : left === null ? "…" : passed ? "Locked" : formatCountdown(left)}
      </p>
    </div>
  );
}
