import { Info } from "lucide-react";
import { FANTASY_BACKEND_LIVE } from "@/lib/fantasy/api";

// Shown until the fantasy backend is wired in, so nobody mistakes sample
// points for real ones. Muted, not amber: amber is kept for "special".
export function StubBanner() {
  if (FANTASY_BACKEND_LIVE) return null;
  return (
    <p className="flex items-center justify-center gap-2 bg-muted px-4 py-1.5 text-center text-xs font-medium text-muted-foreground">
      <Info className="size-4 shrink-0" />
      Preview: points, rankings and leagues are sample data until launch.
    </p>
  );
}
