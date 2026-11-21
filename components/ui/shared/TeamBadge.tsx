import { teamTone, type TeamId } from "@/lib/design/teams";

const TEAM_META: Record<TeamId, { short: string; name: string; classLabel: string }> = {
  1: { short: "Y1", name: "Year 1", classLabel: "SEES 31" },
  2: { short: "Y2", name: "Year 2", classLabel: "SEES 30" },
  3: { short: "Y3", name: "Year 3", classLabel: "SEES 29" },
  4: { short: "Y4", name: "Year 4", classLabel: "SEES 28" },
  5: { short: "Y5", name: "Year 5", classLabel: "SEES 26" },
};

interface TeamBadgeProps {
  year: TeamId;
  variant?: "dot" | "badge" | "kit";
  size?: 20 | 28 | 40;
  className?: string;
}

export function TeamBadge({
  year,
  variant = "badge",
  size = 28,
  className = "",
}: TeamBadgeProps) {
  const tone = teamTone[year];
  const meta = TEAM_META[year];

  const sizeClasses = {
    20: "h-5 w-5 text-[11px]",
    28: "h-7 w-7 text-xs",
    40: "h-10 w-10 text-base",
  }[size];

  if (variant === "kit") {
    return (
      <div
        aria-label={`${meta.name}, ${meta.classLabel}`}
        className={`relative inline-flex h-11 w-12 items-center justify-center ${className}`}
      >
        <svg viewBox="0 0 48 44" className="h-full w-full" aria-hidden="true">
          <path
            d="M14 3 L20 7 H28 L34 3 L45 11 L40 20 L35 17 V41 H13 V17 L8 20 L3 11 Z"
            className="stroke-border stroke-1"
            fill="currentColor"
          />
        </svg>
        <span
          className={`absolute inset-x-3 inset-y-2 flex items-center justify-center rounded-sm font-heading text-xs font-semibold text-team-foreground ${tone.fill}`}
        >
          {meta.short}
        </span>
      </div>
    );
  }

  const circle = (
    <span
      aria-label={variant === "dot" ? `${meta.name}, ${meta.classLabel}` : undefined}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-heading font-semibold text-team-foreground ${tone.fill} ${sizeClasses}`}
    >
      {meta.short}
    </span>
  );

  if (variant === "dot") {
    return <span className={`inline-flex items-center ${className}`}>{circle}</span>;
  }

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {circle}
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-semibold text-foreground">{meta.name}</span>
        <span className="text-[13px] font-medium text-muted-foreground">{meta.classLabel}</span>
      </span>
    </span>
  );
}
