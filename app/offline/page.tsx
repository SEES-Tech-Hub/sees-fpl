import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import { RetryButton } from "./retry-button";

// Owner: Samuel (PWA). The service worker (public/sw.js) caches this page at
// install and shows it when a page can't load because the phone is offline.
// It must stay fully static: no cookies, headers or data fetching.
export const metadata: Metadata = {
  title: "Offline",
  robots: { index: false },
};

export default function OfflinePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <WifiOff aria-hidden className="size-10 text-muted-foreground" />
      <h1 className="font-heading text-3xl font-semibold text-brand">You&apos;re offline</h1>
      <p className="text-muted-foreground">
        This page needs a connection. Scores and fantasy points will load again as soon as you&apos;re back
        online.
      </p>
      <RetryButton />
    </main>
  );
}
