import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EmptyIllustration, type EmptyArt } from "./empty-art";

// The one empty state for the whole app: a small sports illustration, a
// heading, a line of explanation and an optional next step. Pick the art
// that fits the moment (see empty-art.tsx); `compact` is for small cards.

export function EmptyState({
  art = "net",
  title,
  description,
  href,
  cta,
  action,
  compact,
  className,
}: {
  art?: EmptyArt;
  title: string;
  description?: ReactNode;
  href?: string;
  cta?: string;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-2xl bg-card text-center shadow-card motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2",
        compact ? "px-4 py-6" : "px-6 py-10",
        className,
      )}
    >
      <EmptyIllustration art={art} className={compact ? "h-16" : "h-28"} />
      <p className={cn("mt-1 font-heading font-semibold text-foreground", compact ? "text-base" : "text-xl")}>{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {href && cta && (
        <Button asChild size="lg" className="mt-2 h-11 px-5 text-[0.9375rem]">
          <Link href={href}>{cta}</Link>
        </Button>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
