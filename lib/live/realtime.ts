// Live scores: Realtime subscriptions for open pages and consoles.
//
// Use in Client Components with the browser client (lib/supabase/client.ts).
// Each function returns an unsubscribe function: call it in useEffect's
// cleanup. Full guide with an example: docs/live-scores.md, "Realtime guide".
//
// What arrives:
//   * fixtures UPDATE: the new score, status, period and clock start.
//     Apply it directly; it's the whole fixture row.
//   * match_events INSERT (a new event) and UPDATE (an event was voided).
//     These are raw rows without minutes or names. The simplest correct
//     response is router.refresh(), which reloads the server data
//     (the console action already expired the cache).
//   * lineups INSERT: a lineup was set. Refresh the lineups.
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/supabase/types";
import { toMatchEvent } from "./commands";
import type { MatchEvent } from "./types";

type Client = SupabaseClient<Database>;
type FixtureRow = Tables<"fixtures">;

export type ConnectionStatus = "connecting" | "live" | "reconnecting" | "closed";

export type FixtureSubscription = {
  /** The fixture row changed: score, status, period or clock. */
  onFixture?: (fixture: FixtureRow) => void;
  /** An event was recorded, or (voided: true) undone or corrected. */
  onEvent?: (event: MatchEvent, change: { voided: boolean }) => void;
  /** A lineup was set or replaced. */
  onLineup?: () => void;
  /** For a "Live" or "Reconnecting..." badge. */
  onStatus?: (status: ConnectionStatus) => void;
};

function toConnectionStatus(status: string): ConnectionStatus {
  switch (status) {
    case "SUBSCRIBED":
      return "live";
    case "CLOSED":
      return "closed";
    default:
      return "reconnecting"; // CHANNEL_ERROR, TIMED_OUT: supabase-js retries by itself
  }
}

function unsubscriber(supabase: Client, channel: RealtimeChannel) {
  return () => {
    void supabase.removeChannel(channel);
  };
}

/** Changes to one fixture: score and clock, events and lineups. */
export function subscribeToFixture(
  supabase: Client,
  fixtureId: string,
  handlers: FixtureSubscription,
): () => void {
  handlers.onStatus?.("connecting");
  const channel = supabase
    .channel(`live:fixture:${fixtureId}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "fixtures", filter: `id=eq.${fixtureId}` },
      (payload) => handlers.onFixture?.(payload.new as FixtureRow),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "match_events", filter: `fixture_id=eq.${fixtureId}` },
      (payload) => {
        if (payload.eventType === "DELETE") return;
        const row = payload.new as Tables<"match_events">;
        handlers.onEvent?.(toMatchEvent(row), { voided: row.voided_at !== null });
      },
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "lineups", filter: `fixture_id=eq.${fixtureId}` },
      () => handlers.onLineup?.(),
    )
    .subscribe((status) => handlers.onStatus?.(toConnectionStatus(status)));

  return unsubscriber(supabase, channel);
}

/**
 * Score and status changes for every fixture: for the home page's
 * "Live now" cards and lists of fixtures.
 */
export function subscribeToFixtures(
  supabase: Client,
  handlers: Pick<FixtureSubscription, "onFixture" | "onStatus">,
): () => void {
  handlers.onStatus?.("connecting");
  const channel = supabase
    .channel("live:fixtures")
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "fixtures" }, (payload) =>
      handlers.onFixture?.(payload.new as FixtureRow),
    )
    .subscribe((status) => handlers.onStatus?.(toConnectionStatus(status)));

  return unsubscriber(supabase, channel);
}
