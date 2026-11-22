// TODO(Henry): swap for Fortune's components/shared/patterns.tsx once it
// lands. Design system §6.5: a faint circuit trace, hero surfaces only.

import { cn } from "@/lib/utils";

export function CircuitPattern({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 h-full w-full stroke-brand-light/15", className)}
      preserveAspectRatio="xMidYMid slice"
      viewBox="0 0 360 200"
      fill="none"
      strokeWidth="1"
    >
      <path d="M0 40 H70 V90 H120" />
      <circle cx="124" cy="90" r="4" />
      <path d="M360 30 H290 V70" />
      <circle cx="290" cy="74" r="4" />
      <path d="M250 200 V150 H320 V120" />
      <circle cx="320" cy="116" r="4" />
      <path d="M20 200 V160 H90" />
      <circle cx="94" cy="160" r="4" />
      <path d="M200 0 V24 H240" />
      <circle cx="244" cy="24" r="3" />
    </svg>
  );
}
