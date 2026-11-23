import { SeesMark } from "@/components/brand/sees-mark";
import { cn } from "@/lib/utils";

// The loading screen: the SEES mark swaying with the ball bouncing in the
// middle, like a mobile app's launch screen. Pure CSS, so it works as a
// server-rendered Suspense fallback. It waits 300 ms before showing, so a
// fast load never flashes it. With reduced motion it sits still.

export function BrandLoader({ label = "Loading", className }: { label?: string; className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex min-h-[55dvh] flex-1 flex-col items-center justify-center gap-4 motion-safe:animate-sees-appear motion-reduce:opacity-100",
        className,
      )}
    >
      <SeesMark
        className="size-14 text-brand motion-safe:animate-sees-sway dark:text-brand-light"
        ballClassName="motion-safe:animate-sees-ball"
      />
      <span className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">{label}</span>
    </div>
  );
}
