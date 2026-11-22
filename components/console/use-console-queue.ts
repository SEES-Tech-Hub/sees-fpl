"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { notify } from "./notify";
import { recordMatchEvent, setLineup, undoMatchEvent } from "@/lib/live/actions";
import type { LiveError, SetLineupInput } from "@/lib/live/types";
import { fromRecordInput, type ConsoleEvent } from "@/lib/console/match-state";
import { flushQueue, type QueueItem, type QueueSender, type QueueStore } from "@/lib/console/queue";
import { getQueueStore } from "@/lib/console/queue-store";

// Owner: Samuel (console). The offline queue, wired to IndexedDB, Bolu's
// server actions (lib/live/actions.ts) and the network.
//
// Every action goes through the queue, online or not. It sends when the page
// opens, when the phone comes back online, after every tap, and every 15 s
// while anything is waiting.

const RETRY_EVERY_MS = 15_000;

const sender: QueueSender = {
  record: (input) => recordMatchEvent(input),
  setLineup: (input) => setLineup(input),
  undo: (clientEventId) => undoMatchEvent({ clientEventId }),
};

export type SendState = "idle" | "sending" | "offline" | "retrying";

export type LostControl = { error: LiveError };

export function useConsoleQueue(fixtureId: string, { onSent }: { onSent: () => void }) {
  const storeRef = useRef<QueueStore | null>(null);
  const flushingRef = useRef(false);
  const inFlightRef = useRef<string | null>(null);
  const lostRef = useRef<LostControl | null>(null);
  const onSentRef = useRef(onSent);

  const [items, setItems] = useState<QueueItem[]>([]);
  const [ready, setReady] = useState(false);
  const [persistent, setPersistent] = useState(true);
  const [sendState, setSendState] = useState<SendState>("idle");
  const [lastError, setLastError] = useState<LiveError | null>(null);
  const [lostControl, setLostControlState] = useState<LostControl | null>(null);
  // Events the server confirmed, until the server timeline includes them.
  const [confirmed, setConfirmed] = useState<ConsoleEvent[]>([]);
  // Lineups the server confirmed, until the page data includes them.
  const [confirmedLineups, setConfirmedLineups] = useState<SetLineupInput[]>([]);
  // Events undone on this phone (queued or sent). Hidden straight away.
  const [undone, setUndone] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    onSentRef.current = onSent;
  }, [onSent]);

  const setLostControl = useCallback((value: LostControl | null) => {
    lostRef.current = value;
    setLostControlState(value);
  }, []);

  const reload = useCallback(async () => {
    if (!storeRef.current) return [];
    const list = await storeRef.current.list(fixtureId);
    setItems(list);
    return list;
  }, [fixtureId]);

  const flush = useCallback(async () => {
    const store = storeRef.current;
    if (!store || flushingRef.current || lostRef.current) return;
    flushingRef.current = true;
    setSendState("sending");
    let sentAny = false;

    try {
      for (;;) {
        const result = await flushQueue(store, sender, fixtureId, {
          onSending: (item) => {
            inFlightRef.current = item.id;
          },
          onSent: (item) => {
            sentAny = true;
            if (item.kind === "event") setConfirmed((list) => [...list, fromRecordInput(item.input, false)]);
            if (item.kind === "lineup") {
              setConfirmedLineups((list) => [...list.filter((l) => l.teamId !== item.input.teamId), item.input]);
            }
            void reload();
          },
          onDropped: (item, error) => {
            void reload();
            if (item.kind === "undo") {
              // The event stays recorded: show it again.
              setUndone((set) => without(set, item.targetId));
              if (error.code === "event_not_found") return; // The event itself was refused.
            }
            notify.error(`${item.label}: not recorded`, { description: error.message, duration: 10_000 });
          },
        });
        inFlightRef.current = null;

        if (result.outcome === "lost_control") {
          setLostControl({ error: result.error });
          setSendState("idle");
          break;
        }
        if (result.outcome === "stalled") {
          setLastError(result.error);
          setSendState(navigator.onLine ? "retrying" : "offline");
          break;
        }
        setLastError(null);
        setSendState("idle");
        // Something may have been added between the last read and now.
        if ((await store.list(fixtureId)).length === 0) break;
      }
    } finally {
      inFlightRef.current = null;
      flushingRef.current = false;
      await reload();
      if (sentAny) onSentRef.current();
    }
  }, [fixtureId, reload, setLostControl]);

  // Open the store, then send whatever was left from last time.
  useEffect(() => {
    let cancelled = false;
    void getQueueStore().then(async ({ store, persistent }) => {
      if (cancelled) return;
      storeRef.current = store;
      setPersistent(persistent);
      await reload();
      setReady(true);
      void flush();
    });
    return () => {
      cancelled = true;
    };
  }, [flush, reload]);

  // Send when the connection comes back, and keep trying while items wait.
  useEffect(() => {
    const onOnline = () => void flush();
    const onOffline = () => setSendState((s) => (s === "sending" ? s : "offline"));
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [flush]);

  const waiting = items.length;
  useEffect(() => {
    if (waiting === 0 || lostControl) return;
    const timer = window.setInterval(() => void flush(), RETRY_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [waiting, lostControl, flush]);

  // Warn before closing the page with actions still on the phone.
  useEffect(() => {
    if (waiting === 0) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [waiting]);

  const enqueue = useCallback(
    async (item: QueueItem) => {
      const store = storeRef.current;
      if (!store) return;
      await store.add(item);
      await reload();
      void flush();
    },
    [flush, reload],
  );

  /**
   * Undo an event. Still on the phone and nothing is sending: it's just
   * removed. Already sent, or a send is running: a void is queued after it.
   *
   * While a send is running, the queue may already have read this event from
   * the store without marking it in flight yet, so removing it here could
   * still let it reach the server while it disappears from this screen.
   * Queuing the void after it is always safe: the event is sent, then voided
   * (or the void is refused with event_not_found if the event never landed).
   */
  const undo = useCallback(
    async (targetId: string, label: string) => {
      const store = storeRef.current;
      if (!store) return;
      setUndone((set) => new Set(set).add(targetId));
      const queued = (await store.list(fixtureId)).some((i) => i.id === targetId);
      if (queued && !flushingRef.current) {
        await store.remove(targetId);
        await reload();
        return;
      }
      await enqueue({
        kind: "undo",
        id: crypto.randomUUID(),
        targetId,
        fixtureId,
        createdAt: new Date().toISOString(),
        label: `Undo ${label}`,
      });
    },
    [enqueue, fixtureId, reload],
  );

  /** After losing the match: throw away what's waiting. */
  const discardAll = useCallback(async () => {
    const store = storeRef.current;
    if (!store) return;
    for (const item of await store.list(fixtureId)) await store.remove(item.id);
    setLostControl(null);
    await reload();
  }, [fixtureId, reload, setLostControl]);

  /** After retaking the match (or a hiccup): send again. */
  const resume = useCallback(() => {
    setLostControl(null);
    void flush();
  }, [flush, setLostControl]);

  return {
    ready,
    persistent,
    items,
    sendState,
    lastError,
    lostControl,
    confirmed,
    confirmedLineups,
    undone,
    enqueue,
    undo,
    discardAll,
    resume,
    retryNow: flush,
  };
}

function without(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const next = new Set(set);
  next.delete(id);
  return next;
}
