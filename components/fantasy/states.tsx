import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BrandLoader } from "@/components/brand/brand-loader";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Design system §9 states. TODO(Henry): use Fortune's shared EmptyState once it lands.

/** Caption ("MATCHDAY 2 · DEADLINE IN 3H 12M") + Oswald title. */
export function PageHeader({
  title,
  caption,
  description,
  action,
  display,
}: {
  title: string;
  caption?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  /** Use the 36 px display size (hero-style screens like the squad builder). */
  display?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        {caption && (
          <p className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">{caption}</p>
        )}
        <h1
          className={cn(
            "font-heading text-brand dark:text-foreground",
            display ? "text-display font-bold uppercase" : "text-[1.75rem] leading-[1.1] font-semibold",
          )}
        >
          {title}
        </h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}


export { EmptyState } from "@/components/brand/empty-state";

export function InlineError({ title = "That didn't work", message }: { title?: string; message: string }) {
  return (
    <Alert variant="destructive" role="alert">
      <AlertCircle />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

const shimmer = "motion-reduce:animate-none";

/** Skeleton for list screens (rankings, leagues, transfers). */
export function LoadingPage({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3 motion-safe:animate-sees-appear" aria-busy="true" aria-label="Loading">
      <Skeleton className={cn("h-3 w-32", shimmer)} />
      <Skeleton className={cn("h-8 w-48", shimmer)} />
      <Skeleton className={cn("mt-2 h-24 w-full rounded-xl", shimmer)} />
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={cn("h-14 w-full", shimmer)} />
      ))}
    </div>
  );
}

/** Loading screen for the pitch screens (team, squad, points): the SEES mark. */
export function LoadingPitch() {
  return <BrandLoader />;
}
