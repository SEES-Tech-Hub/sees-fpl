"use client";

import { useId, type ReactNode } from "react";
import { motion, type Transition } from "motion/react";
import { PlayerRow } from "@/components/fantasy/player-bits";
import type { Player } from "@/lib/fantasy/types";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// Shared motion for the fantasy screens. Short and springy, never in the way.
// <MotionConfig reducedMotion="user"> in the fantasy layout turns movement
// off for anyone who asked their device to reduce motion.

export const SPRING: Transition = { type: "spring", stiffness: 500, damping: 38, mass: 0.8 };

/** Rows in a filtered list: fade and rise in, fade out, slide when reordered. */
export const rowMotion = {
  layout: "position" as const,
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, transition: { duration: 0.12 } },
  transition: { ...SPRING, opacity: { duration: 0.18 } },
};

/** A stagger for the first rows only, so long lists don't feel slow. */
export const rowDelay = (index: number) => ({ delay: Math.min(index, 8) * 0.025 });

/** Chips on the pitch: pop in when picked, shrink out when removed. */
export const chipMotion = {
  layout: true,
  initial: { opacity: 0, scale: 0.6 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.6, transition: { duration: 0.14 } },
  transition: { type: "spring", stiffness: 520, damping: 26 } as Transition,
};

/** shadcn Tabs whose active background slides between the tabs. */
export function SlidingTabs<T extends string>({
  value,
  onValueChange,
  items,
  label,
  className,
}: {
  value: T;
  onValueChange: (v: T) => void;
  items: { value: T; label: ReactNode }[];
  label: string;
  className?: string;
}) {
  const id = useId();
  return (
    <Tabs value={value} onValueChange={(v) => onValueChange(v as T)}>
      <TabsList aria-label={label} className={cn("h-12 w-48 rounded-lg p-1", className)}>
        {items.map((item) => (
          <TabsTrigger
            key={item.value}
            value={item.value}
            className="h-10 rounded-md text-[0.9375rem] text-muted-foreground data-active:bg-transparent data-active:shadow-none data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none dark:data-active:bg-transparent"
          >
            {value === item.value && (
              <motion.span
                layoutId={`tab-${id}`}
                className="absolute inset-0 rounded-md bg-background shadow-card"
                transition={SPRING}
              />
            )}
            <span className="relative">{item.label}</span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

/** A row of options with one active; the highlight slides to the new choice. */
export function SlidingChoice<T extends string | number | null>({
  value,
  onChange,
  options,
  label,
  variant = "segmented",
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  label: string;
  /** segmented: a grey track (positions). pills: separate rounded chips (years). */
  variant?: "segmented" | "pills";
  className?: string;
}) {
  const id = useId();
  const segmented = variant === "segmented";
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        segmented ? "grid rounded-lg bg-muted p-1" : "flex flex-wrap gap-2",
        className,
      )}
      style={segmented ? { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` } : undefined}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <motion.button
            key={String(o.value)}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            whileTap={{ scale: 0.95 }}
            transition={SPRING}
            className={cn(
              "relative font-semibold transition-colors duration-200 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              segmented
                ? "h-10 rounded-md text-sm text-muted-foreground"
                : "h-11 min-w-11 rounded-full border border-border px-3 text-[0.9375rem] font-medium",
              active && (segmented ? "text-foreground" : "border-transparent text-primary-foreground"),
            )}
          >
            {active && (
              <motion.span
                layoutId={`choice-${id}`}
                className={cn("absolute inset-0", segmented ? "rounded-md bg-background shadow-card" : "rounded-full bg-primary")}
                transition={SPRING}
              />
            )}
            <span className="relative">{o.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

/** A PlayerRow that animates in, out and into its new place in the list. */
export function AnimatedPlayerRow({
  index,
  ...props
}: {
  index: number;
  player: Player;
  reason?: ReactNode;
  action?: ReactNode;
  highlight?: boolean;
}) {
  return (
    <motion.li
      {...rowMotion}
      transition={{ ...rowMotion.transition, ...rowDelay(index) }}
      className="border-b border-border last:border-b-0"
    >
      <PlayerRow as="div" bordered={false} {...props} />
    </motion.li>
  );
}
