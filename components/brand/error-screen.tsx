"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RotateCw } from "lucide-react";
import { EmptyIllustration } from "@/components/brand/empty-art";
import { SeesMark } from "@/components/brand/sees-mark";
import { Button } from "@/components/ui/button";

// When a page fails to load (usually the server taking too long at a busy
// moment): a SEES screen in place of Next's default, that tries again by
// itself once after a few seconds, with Try again and a way back to the
// scores. Used by app/error.tsx, app/global-error.tsx and the fantasy error.

const AUTO_RETRY_S = 5;
// One automatic retry per page visit, so a page that keeps failing doesn't loop.
const retried = new Set<string>();

export function ErrorScreen({ error, retry, compact = false }: { error: unknown; retry: () => void; compact?: boolean }) {
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    console.error(error);
    const key = typeof window === "undefined" ? "" : window.location.pathname;
    if (retried.has(key)) return;
    retried.add(key);
    let n = AUTO_RETRY_S;
    const tick = () => {
      setLeft(n);
      if (n === 0) {
        retry();
        return;
      }
      n -= 1;
      timer = setTimeout(tick, 1000);
    };
    let timer = setTimeout(tick, 0);
    return () => clearTimeout(timer);
  }, [error, retry]);

  const body = (
    <>
      <EmptyIllustration art="whistle" className={compact ? "h-28" : "h-36 sm:h-44"} />
      <h1 className="mt-4 font-heading text-3xl font-bold text-brand uppercase dark:text-foreground">Time out</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">
        The page took too long. Lots of people are on SEES Games right now, so give it a moment.
      </p>
      {left !== null && left > 0 && (
        <p className="mt-2 text-sm font-semibold text-brand tabular-nums dark:text-foreground" aria-live="polite">
          Trying again in {left}…
        </p>
      )}
      <div className="mt-6 flex w-full max-w-sm flex-col gap-2 sm:max-w-none sm:flex-row sm:justify-center">
        <Button size="lg" className="h-12 gap-2 px-6" onClick={() => retry()}>
          <RotateCw className="size-4" aria-hidden /> Try again
        </Button>
        <Button asChild size="lg" variant="outline" className="h-12 px-6">
          <Link href="/">Back to the scores</Link>
        </Button>
      </div>
    </>
  );

  if (compact) {
    return (
      <div role="alert" className="flex flex-col items-center rounded-xl border border-border px-4 py-10 text-center">
        {body}
      </div>
    );
  }
  return (
    <main role="alert" className="relative flex min-h-[70dvh] flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <Link href="/" className="absolute top-4 left-4 flex items-center gap-2 font-heading text-lg font-semibold">
        <SeesMark className="size-7 text-brand" /> SEES Games
      </Link>
      {body}
    </main>
  );
}
