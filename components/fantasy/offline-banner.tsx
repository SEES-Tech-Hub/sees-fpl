"use client";

import { useSyncExternalStore } from "react";
import { CloudOff } from "lucide-react";

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/** Design system §9: thin muted banner under the header; cached content stays visible. */
export function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  if (online) return null;
  return (
    <p role="status" className="flex items-center justify-center gap-2 bg-muted px-4 py-1.5 text-xs font-medium">
      <CloudOff className="size-4" />
      You&apos;re offline. Showing the last data we had.
    </p>
  );
}
