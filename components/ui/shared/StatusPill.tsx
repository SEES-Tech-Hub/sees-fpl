import { formatWAT } from "@/lib/utils";
import { LiveDot } from "./LiveDot";

export type FixtureStatus =
  | "scheduled"
  | "live"
  | "half_time"
  | "full_time"
  | "postponed"
  | "walkover"
  | "cancelled"
  | "extra_time"
  | "penalties";

interface StatusPillProps {
  status: FixtureStatus | (string & {});
  minute?: number | string | null;
  period?: string | null;
  kickoffAt?: Date | string | number | null;
  pensScore?: string | null;
}

export function StatusPill({
  status,
  minute,
  period,
  kickoffAt,
  pensScore,
}: StatusPillProps) {
  if (status === "live" || status === "extra_time") {
    const label = period === "ET" ? `ET ${minute ?? ""}'` : `LIVE ${minute ?? ""}'`;
    return (
      <span
        aria-label={minute ? `Live, ${minute}th minute` : "Live"}
        className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-destructive"
      >
        <LiveDot />
        <span>{label.trim()}</span>
      </span>
    );
  }

  if (status === "half_time") {
    return (
      <span className="inline-flex items-center rounded-full bg-highlight px-2.5 py-0.5 text-xs font-semibold text-team-foreground">
        HT
      </span>
    );
  }

  if (status === "full_time" || status === "penalties") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <span>{pensScore ? `PENS ${pensScore}` : "FT"}</span>
      </span>
    );
  }

  if (status === "postponed") {
    return (
      <span className="inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
        PP
      </span>
    );
  }

  if (status === "walkover") {
    return (
      <span
        title="Awarded 3–0"
        className="inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold text-muted-foreground"
      >
        W/O
      </span>
    );
  }

  if (status === "cancelled") {
    return (
      <span className="inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold text-muted-foreground line-through">
        Cancelled
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold tabular-nums text-foreground">
      {kickoffAt ? formatWAT(kickoffAt, "time") : "TBD"}
    </span>
  );
}
