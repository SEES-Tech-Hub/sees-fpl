import "server-only";
import webpush from "web-push";
import { getLiveFixture, getMatchTimeline } from "@/lib/live/queries";
import type { MatchEvent } from "@/lib/live/types";
import { createClient } from "@/lib/supabase/server";

// Web Push for match moments: kick-off, goals, half-time and full time.
//
// Sent from the console's recordMatchEvent with next/server's after(), so
// the official's tap isn't slowed down. It reads the subscribers through
// push_targets(), which only officials and admins may call, with the
// official's own session. Without VAPID keys (local dev before setup) it
// does nothing.

export type PushPayload = { title: string; body: string; url: string; tag: string };

const GOAL_DELAY_MS = 12_000;

function configured() {
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
  if (!configured()) return;
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

/** Decides whether a just-recorded event is worth a notification, and sends it. */
export async function notifyMatchEvent(event: MatchEvent): Promise<void> {
  const interesting =
    event.type === "goal" ||
    event.type === "full_time" ||
    (event.type === "period_start" && (event.period === "first_half" || event.period === "first_quarter")) ||
    (event.type === "period_end" && (event.period === "first_half" || event.period === "second_quarter"));
  if (!interesting) return;

  // Officials can undo a mis-tap for 30 s; wait a little and check a goal still stands.
  if (event.type === "goal") {
    await new Promise((r) => setTimeout(r, GOAL_DELAY_MS));
    const timeline = await getMatchTimeline(event.fixtureId);
    if (!timeline.some((e) => e.clientEventId === event.clientEventId)) return;
  }

  const fixture = await getLiveFixture(event.fixtureId);
  if (!fixture?.home || !fixture.away) return;
  const score = `${fixture.home.shortName} ${fixture.homeScore ?? 0}–${fixture.awayScore ?? 0} ${fixture.away.shortName}`;
  const vs = `${fixture.home.name} v ${fixture.away.name}`;
  const sport = fixture.sport.name;

  let title = "";
  let body = "";
  if (event.type === "goal") {
    const timeline = await getMatchTimeline(event.fixtureId);
    const goal = timeline.find((e) => e.clientEventId === event.clientEventId);
    const scorer = goal?.playerName ?? "Goal";
    const minute = goal?.minute !== null && goal?.minute !== undefined ? ` ${goal.minute}'` : "";
    title = `GOAL! ${score}`;
    body = `${scorer}${goal?.isOwnGoal ? " (own goal)" : goal?.isPenalty ? " (pen)" : ""}${minute} · ${sport}`;
  } else if (event.type === "period_start") {
    title = `Kick-off: ${vs}`;
    body = `${sport} is under way. Follow it live.`;
  } else if (event.type === "period_end") {
    title = `Half-time: ${score}`;
    body = sport;
  } else {
    title = `Full time: ${score}`;
    body = `${sport} · ${vs}`;
  }

  await sendPush(["all", `fixture:${fixture.id}`, `team:${fixture.home.id}`, `team:${fixture.away.id}`], {
    title,
    body,
    url: `/matches/${fixture.id}`,
    tag: `fx-${fixture.id}-${event.type}`,
  });
}
