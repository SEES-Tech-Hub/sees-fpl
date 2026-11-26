import "server-only";
import webpush from "web-push";
import { getLiveFixture, getMatchTimeline } from "@/lib/live/queries";
import type { MatchEvent } from "@/lib/live/types";
import { matchMessage } from "./messages";
import { createClient } from "@/lib/supabase/server";

// Web Push for match moments (lib/push/messages.ts says which, and what they say)
// and for announcements.
//
// Sent from the console's recordMatchEvent with next/server's after(), so
// the official's tap isn't slowed down. It reads the subscribers through
// push_targets(), which only officials and admins may call, with the
// official's own session. Without VAPID keys (local dev before setup) it
// does nothing.

export type PushPayload = { title: string; body: string; url: string; tag: string };

const GOAL_DELAY_MS = 12_000;

/** True when the VAPID keys are set (they are on Vercel; not on a laptop before setup). */
export function configuredPush() {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  // The VAPID subject must be an https: or mailto: address.
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/^http:\/\//, "https://");
  const subject = site ? (site.startsWith("https://") ? site : `https://${site}`) : "https://games.seesunilag.com";
  webpush.setVapidDetails(subject, pub, priv);
  return true;
}

export async function sendPush(topics: string[], payload: PushPayload): Promise<void> {
  if (!configuredPush()) return;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("push_targets", { p_topics: topics });
  if (error || !data?.length) return;

  const gone: string[] = [];
  const body = JSON.stringify(payload);
  await Promise.allSettled(
    data.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, {
          TTL: 60 * 30,
          urgency: "high",
          topic: payload.tag.slice(0, 32).replace(/[^A-Za-z0-9_-]/g, ""),
        });
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) gone.push(s.endpoint);
      }
    }),
  );
  if (gone.length) await supabase.rpc("push_forget", { p_endpoints: gone });
}

/** Events an official can undo: wait out the window and check it still stands. */
const UNDOABLE = new Set(["goal", "card", "penalty_miss", "man_of_the_match", "set_end"]);

/** Decides whether a just-recorded event is worth a notification, and sends it. */
export async function notifyMatchEvent(event: MatchEvent): Promise<void> {
  if (UNDOABLE.has(event.type)) {
    await new Promise((r) => setTimeout(r, GOAL_DELAY_MS));
    const timeline = await getMatchTimeline(event.fixtureId);
    if (!timeline.some((e) => e.clientEventId === event.clientEventId)) return;
  }

  const [fixture, timeline] = await Promise.all([getLiveFixture(event.fixtureId), getMatchTimeline(event.fixtureId)]);
  if (!fixture?.home || !fixture.away) return;
  const entry = timeline.find((e) => e.clientEventId === event.clientEventId) ?? null;
  const message = matchMessage(event, fixture, entry, timeline);
  if (!message) return;

  const followers = [`fixture:${fixture.id}`, `team:${fixture.home.id}`, `team:${fixture.away.id}`];
  await sendPush(message.audience === "major" ? ["all", ...followers] : followers, {
    title: message.title,
    body: message.body,
    url: `/matches/${fixture.id}`,
    tag: `fx-${fixture.id}-${event.type}-${event.id}`,
  });
}

/**
 * An announcement goes to every device with notifications on (not only "All
 * matches" followers). Returns how many devices it reached.
 */
export async function notifyAnnouncement(a: { id: string; message: string; tone: "info" | "warning" }): Promise<number> {
  const { sendToEveryDevice } = await import("./personal");
  return sendToEveryDevice({
    title: a.tone === "warning" ? "Heads up from SEES Games" : "SEES Games",
    body: a.message,
    url: "/",
    tag: `ann-${a.id}`,
  });
}
