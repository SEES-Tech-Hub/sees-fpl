import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { subscribeToFixture, subscribeToFixtures, uniqueChannelName } from "./realtime";

// A stand-in client that records channel names and removals.
function fakeClient() {
  const names: string[] = [];
  const removed: unknown[] = [];
  const client = {
    channel(name: string) {
      names.push(name);
      const channel = {
        on: () => channel,
        subscribe: () => channel,
      };
      return channel;
    },
    removeChannel(channel: unknown) {
      removed.push(channel);
      return Promise.resolve("ok");
    },
  };
  return { client: client as unknown as SupabaseClient<Database>, names, removed };
}

describe("uniqueChannelName", () => {
  it("keeps the base name and adds a unique suffix", () => {
    const a = uniqueChannelName("live:fixtures");
    const b = uniqueChannelName("live:fixtures");
    expect(a.startsWith("live:fixtures:")).toBe(true);
    expect(a).not.toBe(b);
  });
});

describe("subscriptions", () => {
  it("uses a separate channel for each subscription to the same fixture", () => {
    const { client, names } = fakeClient();
    subscribeToFixture(client, "f1", {});
    subscribeToFixture(client, "f1", {});
    expect(names).toHaveLength(2);
    expect(names[0]).not.toBe(names[1]);
    expect(names.every((n) => n.startsWith("live:fixture:f1:"))).toBe(true);
  });

  it("uses a separate channel for each fixtures-list subscription", () => {
    const { client, names } = fakeClient();
    subscribeToFixtures(client, {});
    subscribeToFixtures(client, {});
    expect(names[0]).not.toBe(names[1]);
  });

  it("removes its own channel when unsubscribed", () => {
    const { client, removed } = fakeClient();
    const unsubscribe = subscribeToFixture(client, "f1", {});
    unsubscribe();
    expect(removed).toHaveLength(1);
  });
});
