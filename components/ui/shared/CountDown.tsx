"use client";

import { useEffect, useState } from "react";

interface CountdownProps {
  targetAt: Date | string | number;
  serverOffsetMs?: number;
  showDeadlineLabel?: boolean;
  className?: string;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "00:00";

  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  if (days >= 1) return `${days}d ${hours}h`;
  if (hours >= 1) return `${hours}h ${mins}m`;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function Countdown({
  targetAt,
  serverOffsetMs = 0,
  showDeadlineLabel = true,
  className = "",
}: CountdownProps) {
  const targetMs = new Date(targetAt).getTime();
  const [now, setNow] = useState(() => Date.now() + serverOffsetMs);

  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now() + serverOffsetMs);
    }, 1000);
    return () => clearInterval(id);
  }, [serverOffsetMs]);

  const remaining = Math.max(0, targetMs - now);
  const isUrgent = remaining > 0 && remaining <= 2 * 60 * 60 * 1000;

  return (
    <span
      className={`inline-flex items-center gap-2 font-heading font-bold tabular-nums ${
        isUrgent ? "text-highlight" : "text-foreground"
      } ${className}`}
    >
      <span>{formatRemaining(remaining)}</span>
      {isUrgent && showDeadlineLabel && (
        <span className="rounded-full bg-highlight px-2 py-0.5 font-sans text-xs font-semibold text-team-foreground">
          Deadline soon
        </span>
      )}
    </span>
  );
}
