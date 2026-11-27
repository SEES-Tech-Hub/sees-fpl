// Random ids kept on this device in localStorage, made the first time
// they're needed. Browser only.
//
// - visitId(): analytics (components/analytics/tracker.tsx). Linked to the
//   account when someone is signed in (see the privacy page).
// - reactionId(): live reactions (components/live/reactions.tsx). A separate
//   id on purpose: it is never linked to an account, so nothing ties a
//   reaction to a person, not even through the analytics tables.

function deviceId(key: string, fallback: "__seesVisit" | "__seesReaction"): string {
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(key, id);
    return id;
  } catch {
    // Private browsing: one id for this page load.
    const g = globalThis as { __seesVisit?: string; __seesReaction?: string };
    return (g[fallback] ??= crypto.randomUUID());
  }
}

export const visitId = () => deviceId("sees:visit-id", "__seesVisit");

export const reactionId = () => deviceId("sees:reaction-id", "__seesReaction");
