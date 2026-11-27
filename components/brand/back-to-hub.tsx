import Link from "next/link";
import { SeesMark } from "@/components/brand/sees-mark";
import { cn } from "@/lib/utils";

// The way out of the admin portal and the match console, back to the public
// Games Hub (scores, fantasy, the race). The SEES mark plus "Games Hub", so it
// reads as a link and not just a logo.

export function BackToHub({ className, label = "Games Hub" }: { className?: string; label?: string }) {
  return (
    <Link
      href="/"
      aria-label="Back to the SEES Games Hub"
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-brand transition-colors outline-none hover:text-brand/80 focus-visible:ring-3 focus-visible:ring-ring dark:text-foreground",
        className,
      )}
    >
      <SeesMark className="size-6 shrink-0" />
      {label}
    </Link>
  );
}
