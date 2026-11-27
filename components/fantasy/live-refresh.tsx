"use client";

import { useRefreshOnLiveChange } from "@/lib/live/use-live";

/**
 * While a matchday's matches are on: watches the cached live scores and
 * refreshes the page's points whenever a score or status changes (a goal, a
 * card, full time), spread over a few seconds so managers don't all reload
 * at once. Renders nothing.
 */
export function LiveRefresh() {
  useRefreshOnLiveChange();
  return null;
}
