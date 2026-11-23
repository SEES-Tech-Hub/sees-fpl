// Match console: the offline queue.
//
// Every console action goes into the queue first, then is sent from there,
// so the same path works online and offline. Items are sent one at a time,
// in the order they were tapped, following the rules in docs/live-scores.md
// ("Offline queue rules"):
//
//   - The action throws (no network) or returns retryable: stop, keep it and
//     everything after it, and try again later.
//   - ok: remove it.
//   - Not retryable: remove it, report it, carry on with the next one.
//
// One exception, agreed for the console: if the server says this phone is no
// longer allowed to record the match (not_holder, forbidden, not_signed_in),
// stop and keep everything. Every later action would fail the same way, and
// dropping them one by one would lose them silently. The console shows them
// so the official can retake the match or tell the admin.
//
// Pure logic with the storage and the server calls passed in, so it can be
// tested without IndexedDB or a network. Tests: queue.test.ts.
import type { ActionResult, LiveError, MatchEvent, RecordEventInput, SetLineupInput } from "@/lib/live/types";

type ItemBase = {
  /** Unique per item. For events, this is the clientEventId sent to the server. */
  id: string;
  fixtureId: string;
  /** When it was tapped (ISO). */
  createdAt: string;
  /** Short text for the official: "Goal, Lions" or "Undo: Yellow card". */
  label: string;
};

export type QueueItem =
  | (ItemBase & { kind: "event"; input: RecordEventInput })
  | (ItemBase & { kind: "lineup"; input: SetLineupInput })
  /** Undo of an event the server already has. */
  | (ItemBase & { kind: "undo"; targetId: string });

export interface QueueStore {
  /** Items for one fixture, oldest first. */
  list(fixtureId: string): Promise<QueueItem[]>;
  add(item: QueueItem): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface QueueSender {
  record(input: RecordEventInput): Promise<ActionResult<MatchEvent>>;
  setLineup(input: SetLineupInput): Promise<ActionResult<unknown>>;
  undo(clientEventId: string): Promise<ActionResult<MatchEvent>>;
}

/** Errors that mean this phone can't record the match any more. */
export const LOST_CONTROL_CODES: ReadonlySet<LiveError["code"]> = new Set([
  "not_holder",
  "forbidden",
  "not_signed_in",
]);

export type FlushHooks = {
  /** Called just before an item is sent (so undo knows it's in flight). */
  onSending?: (item: QueueItem) => void;
  onSent?: (item: QueueItem, data: unknown) => void;
  /** The server refused the item for good; it has been removed. */
  onDropped?: (item: QueueItem, error: LiveError) => void;
};

export type FlushResult =
  | { outcome: "done" }
  /** No network, or the server was busy. Try again later. */
  | { outcome: "stalled"; item: QueueItem; error: LiveError | null }
  /** This phone lost the match. Nothing more was sent; everything is kept. */
  | { outcome: "lost_control"; item: QueueItem; error: LiveError };

async function send(sender: QueueSender, item: QueueItem): Promise<ActionResult<unknown>> {
  switch (item.kind) {
    case "event":
      return sender.record(item.input);
    case "lineup":
      return sender.setLineup(item.input);
    case "undo":
      return sender.undo(item.targetId);
  }
}

/** Sends a fixture's queue, oldest first, until it's empty or has to stop. */
export async function flushQueue(
  store: QueueStore,
  sender: QueueSender,
  fixtureId: string,
  hooks: FlushHooks = {},
): Promise<FlushResult> {
  // Re-read after every item: the official may tap or undo while we send.
  for (;;) {
    const [item] = await store.list(fixtureId);
    if (!item) return { outcome: "done" };

    hooks.onSending?.(item);
    let result: ActionResult<unknown>;
    try {
      result = await send(sender, item);
    } catch {
      return { outcome: "stalled", item, error: null };
    }

    if (result.ok) {
      await store.remove(item.id);
      hooks.onSent?.(item, result.data);
      continue;
    }
    if (result.error.retryable) return { outcome: "stalled", item, error: result.error };
    if (LOST_CONTROL_CODES.has(result.error.code)) {
      return { outcome: "lost_control", item, error: result.error };
    }
    await store.remove(item.id);
    hooks.onDropped?.(item, result.error);
  }
}

/** A store in memory: for tests, and when the browser has no IndexedDB. */
export function createMemoryStore(): QueueStore {
  const items: QueueItem[] = [];
  return {
    async list(fixtureId) {
      return items.filter((i) => i.fixtureId === fixtureId);
    },
    async add(item) {
      items.push(item);
    },
    async remove(id) {
      const index = items.findIndex((i) => i.id === id);
      if (index >= 0) items.splice(index, 1);
    },
  };
}
