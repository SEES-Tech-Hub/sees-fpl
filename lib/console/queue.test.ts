import { describe, expect, it, vi } from "vitest";
import type { ActionResult, LiveError, MatchEvent } from "@/lib/live/types";
import { createMemoryStore, flushQueue, type QueueItem, type QueueSender } from "./queue";

const FIXTURE = "33333333-3333-4333-8333-333333333333";

function item(id: string, kind: QueueItem["kind"] = "event"): QueueItem {
  const base = { id, fixtureId: FIXTURE, createdAt: "2026-11-28T09:00:00Z", label: id };
  if (kind === "undo") return { ...base, kind, targetId: `target-${id}` };
  if (kind === "lineup") return { ...base, kind, input: { fixtureId: FIXTURE, teamId: "t", starters: ["p"], bench: [] } };
  return { ...base, kind, input: { fixtureId: FIXTURE, clientEventId: id, type: "period_end" } };
}

const ok: ActionResult<MatchEvent> = { ok: true, data: {} as MatchEvent };
const fail = (code: LiveError["code"], retryable = false): ActionResult<MatchEvent> => ({
  ok: false,
  error: { code, message: `${code} message`, retryable },
});

/** A sender that answers each call from a script, in order, and records what it was sent. */
function scriptedSender(...answers: Array<ActionResult<MatchEvent> | "throw">) {
  const sent: string[] = [];
  const next = async (label: string) => {
    sent.push(label);
    const answer = answers.shift() ?? ok;
    if (answer === "throw") throw new TypeError("Failed to fetch");
    return answer;
  };
  const sender: QueueSender = {
    record: (input) => next(input.clientEventId),
    setLineup: () => next("lineup"),
    undo: (id) => next(`undo:${id}`),
  };
  return { sender, sent };
}

async function storeWith(...items: QueueItem[]) {
  const store = createMemoryStore();
  for (const i of items) await store.add(i);
  return store;
}

const ids = async (store: Awaited<ReturnType<typeof storeWith>>) => (await store.list(FIXTURE)).map((i) => i.id);

describe("flushQueue", () => {
  it("sends everything in order and empties the queue", async () => {
    const store = await storeWith(item("a"), item("b", "lineup"), item("c", "undo"));
    const { sender, sent } = scriptedSender();
    const onSent = vi.fn();
    expect(await flushQueue(store, sender, FIXTURE, { onSent })).toEqual({ outcome: "done" });
    expect(sent).toEqual(["a", "lineup", "undo:target-c"]);
    expect(onSent).toHaveBeenCalledTimes(3);
    expect(await ids(store)).toEqual([]);
  });

  it("stops and keeps the rest when the network is down", async () => {
    const store = await storeWith(item("a"), item("b"), item("c"));
    const { sender, sent } = scriptedSender(ok, "throw");
    const result = await flushQueue(store, sender, FIXTURE);
    expect(result).toMatchObject({ outcome: "stalled", item: { id: "b" }, error: null });
    expect(sent).toEqual(["a", "b"]);
    expect(await ids(store)).toEqual(["b", "c"]);
  });

  it("stops and keeps the rest when the server says try again", async () => {
    const store = await storeWith(item("a"), item("b"));
    const { sender } = scriptedSender(fail("unavailable", true));
    const result = await flushQueue(store, sender, FIXTURE);
    expect(result).toMatchObject({ outcome: "stalled", error: { code: "unavailable" } });
    expect(await ids(store)).toEqual(["a", "b"]);
  });

  it("drops an action the server refuses for good, reports it, and carries on", async () => {
    const store = await storeWith(item("a"), item("b"), item("c"));
    const { sender, sent } = scriptedSender(ok, fail("invalid_state"));
    const onDropped = vi.fn();
    expect(await flushQueue(store, sender, FIXTURE, { onDropped })).toEqual({ outcome: "done" });
    expect(sent).toEqual(["a", "b", "c"]);
    expect(onDropped).toHaveBeenCalledWith(expect.objectContaining({ id: "b" }), expect.objectContaining({ code: "invalid_state" }));
    expect(await ids(store)).toEqual([]);
  });

  it.each(["not_holder", "forbidden", "not_signed_in"] as const)(
    "stops and keeps everything when the phone lost the match (%s)",
    async (code) => {
      const store = await storeWith(item("a"), item("b"), item("c"));
      const { sender, sent } = scriptedSender(ok, fail(code));
      const onDropped = vi.fn();
      const result = await flushQueue(store, sender, FIXTURE, { onDropped });
      expect(result).toMatchObject({ outcome: "lost_control", item: { id: "b" }, error: { code } });
      expect(sent).toEqual(["a", "b"]);
      expect(onDropped).not.toHaveBeenCalled();
      expect(await ids(store)).toEqual(["b", "c"]);
    },
  );

  it("picks up items added while it is sending", async () => {
    const store = await storeWith(item("a"));
    const { sender, sent } = scriptedSender();
    await flushQueue(store, sender, FIXTURE, {
      onSending: (i) => {
        if (i.id === "a") void store.add(item("b"));
      },
    });
    expect(sent).toEqual(["a", "b"]);
  });

  it("only sends the given fixture's items", async () => {
    const store = await storeWith(item("a"), { ...item("other"), fixtureId: "another-fixture" });
    const { sender, sent } = scriptedSender();
    await flushQueue(store, sender, FIXTURE);
    expect(sent).toEqual(["a"]);
    expect((await store.list("another-fixture")).map((i) => i.id)).toEqual(["other"]);
  });
});
