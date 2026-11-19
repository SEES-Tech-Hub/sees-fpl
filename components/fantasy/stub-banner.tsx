import { FANTASY_BACKEND_LIVE } from "@/lib/fantasy/api";

// Shown until Mary's backend is wired in, so nobody mistakes sample points for real ones.
export function StubBanner() {
  if (FANTASY_BACKEND_LIVE) return null;
  return (
    <p className="bg-highlight px-4 py-1.5 text-center text-xs font-medium text-highlight-foreground">
      Preview: fantasy points, rankings and leagues are sample data until launch.
    </p>
  );
}
