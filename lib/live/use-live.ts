"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { FixtureState } from "./live-state-types";

// Keeping public pages live by polling the cached endpoints in app/api/live
// (why polling, not Realtime: lib/live/live-state.ts).
//
// - Polls every POLL_MS while the tab is visible, and stops when it's hidden.
// - Coming back to the tab (or back online) fetches straight away.
// - After a failed poll it waits longer each time (up to a minute), and
//   reports "reconnecting" for a "Reconnecting…" pill.
//
// With the CDN holding each response for 4 s, a viewer is at most about
// POLL_MS + 4 s behind.

export const POLL_MS = 6000;
const MAX_BACKOFF_MS = 60_000;

export type LiveStatus = "live" | "reconnecting";

function usePoll<T>(url: string | null, onData: (data: T) => void): LiveStatus {
  const [status, setStatus] = useState<LiveStatus>("live");
  const onDataRef = useRef(onData);
  useEffect(() => {
    onDataRef.current = onData;
  });

  useEffect(() => {
    if (!url) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    let stopped = false;
    let controller: AbortController | undefined;

    const schedule = (ms: number) => {
      clearTimeout(timer);
      if (!stopped && document.visibilityState === "visible") timer = setTimeout(tick, ms);
    };

    async function tick() {
      controller?.abort();
      controller = new AbortController();
      try {
        const res = await fetch(url!, { cache: "no-store", signal: controller.signal });
        if (!res.ok) throw new Error(String(res.status));
        onDataRef.current((await res.json()) as T);
        failures = 0;
        setStatus("live");
        schedule(POLL_MS);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        failures += 1;
        setStatus("reconnecting");
        schedule(Math.min(POLL_MS * 2 ** failures, MAX_BACKOFF_MS));
      }
    }

    const wake = () => {
      if (document.visibilityState === "visible") void tick();
      else clearTimeout(timer);
    };

    schedule(POLL_MS);
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);
    return () => {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", wake);
    };
  }, [url]);

  return status;
}

/**
 * Live score, status and clock for many fixtures (home, sport pages).
 * Pass the states the server rendered; returns them kept up to date, keyed by id.
 */
export function useLiveFixtures(initial: FixtureState[]) {
  const [states, setStates] = useState(() => new Map(initial.map((f) => [f.id, f])));
  const status = usePoll<{ fixtures: FixtureState[] }>("/api/live", (data) => {
    setStates((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const f of data.fixtures) {
        const old = prev.get(f.id);
        if (!old || old.updatedAt !== f.updatedAt) {
          next.set(f.id, f);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  });
  return { states, status };
}

/**
 * One fixture (the match page). The score and clock update in place; when
 * anything else changes (a new event, a lineup, results) the page reloads its
 * server data with router.refresh().
 */
export function useLiveFixture(fixtureId: string, initial: FixtureState, initialVersion: string) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const versionRef = useRef(initialVersion);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const onData = useCallback(
    (data: { state: FixtureState; version: string }) => {
      setState(data.state);
      if (data.version !== versionRef.current) {
        versionRef.current = data.version;
        // Spread viewers' refreshes over 2 s so a goal doesn't hit the server
        // all at once, then refresh again 5 s later in case the first landed
        // on a server whose 4 s cache hadn't caught up yet.
        timers.current.forEach(clearTimeout);
        timers.current = [
          setTimeout(() => router.refresh(), Math.random() * 2000),
          setTimeout(() => router.refresh(), 5000 + Math.random() * 2000),
        ];
      }
    },
    [router],
  );
  const status = usePoll(`/api/live/${fixtureId}`, onData);
  return { state, status };
}
