"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function FantasyError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-destructive/40 px-4 py-10 text-center">
      <p className="font-heading text-lg font-semibold">We couldn&apos;t load this page</p>
      <p className="max-w-xs text-sm text-muted-foreground">
        Check your connection and try again. If it keeps happening, tell the SEES tech team.
      </p>
      <Button size="lg" className="h-11 px-5" onClick={() => retry()}>
        Try again
      </Button>
    </div>
  );
}
