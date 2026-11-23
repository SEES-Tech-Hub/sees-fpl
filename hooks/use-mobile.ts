"use client";

import { useSyncExternalStore } from "react";

// Phones and small tablets: below Tailwind's `md` breakpoint (768 px).
const QUERY = "(max-width: 767px)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/** True on phone-sized screens. The server (and first paint) assume a phone. */
export function useIsMobile() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => true,
  );
}
