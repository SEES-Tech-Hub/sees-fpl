import type { ReactNode } from "react";
import { formatMoney } from "@/lib/fantasy/format";
import { POSITIONS, type FantasyRules, type Position } from "@/lib/fantasy/types";
import { cn } from "@/lib/utils";

/** Design system §11.3 SquadProgress: "1/2 GK · 3/5 DEF …", each turning success when complete. */
export function SquadProgress({ counts, rules }: { counts: Record<Position, number>; rules: FantasyRules }) {
  return (
    <ul className="grid grid-cols-4 gap-1" aria-label="Positions filled">
      {POSITIONS.map((pos) => {
        const full = counts[pos] === rules.squadPositions[pos];
        return (
          <li
            key={pos}
            className={cn(
              "rounded-full border border-border py-0.5 text-center text-xs font-semibold whitespace-nowrap tabular-nums",
              full && "border-success bg-success/10 text-success",
            )}
          >
            {counts[pos]}/{rules.squadPositions[pos]} {pos}
          </li>
        );
      })}
    </ul>
  );
}

const LOW_MONEY = 50; // ₦5.0m, design system §11.3

/** Design system §11.3 BudgetBar: sticky at the bottom of the squad builder. */
export function BudgetBar({
  leftTenths,
  progress,
  reason,
  reasonTone = "muted",
  action,
}: {
  leftTenths: number;
  progress?: ReactNode;
  reason: ReactNode;
  reasonTone?: "muted" | "error" | "ok";
  action: ReactNode;
}) {
  const negative = leftTenths < 0;
  const low = !negative && leftTenths < LOW_MONEY;
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 rounded-t-xl border-t border-border bg-background/80 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-raised backdrop-blur-md">
      <div className="mx-auto flex max-w-2xl flex-col gap-2">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Budget</p>
            <p className="font-heading text-[1.75rem] leading-none font-bold whitespace-nowrap tabular-nums">
              <span
                className={cn(
                  negative && "text-destructive",
                  low && "rounded-md bg-highlight px-1 text-highlight-foreground",
                )}
              >
                {formatMoney(leftTenths)}
              </span>{" "}
              <span className="font-sans text-sm font-medium text-muted-foreground">left</span>
            </p>
          </div>
        </div>
        {progress}
        <div className="flex items-center gap-3">
          <p
            className={cn(
              "min-w-0 flex-1 text-[0.8125rem] font-medium",
              reasonTone === "error" && "text-destructive",
              reasonTone === "ok" && "text-success",
              reasonTone === "muted" && "text-muted-foreground",
            )}
            aria-live="polite"
          >
            {reason}
          </p>
          {action}
        </div>
      </div>
    </div>
  );
}
