import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { configuredPush, type PushPayload } from "./send";

// Personal notifications that aren't a reaction to something an official
// tapped, so there's nobody's session to send them with: kick-off reminders,
// fantasy deadline reminders and fantasy results. They run as the app (the
// secret key), from the minute-by-minute job (app/api/cron/notifications)
// and from the admin's Finalise. Each is logged in notification_log, so a
// reminder goes out once even if the job runs twice.

type Target = { endpoint: string; p256dh: string; auth: string; userId: string | null; topics: string[] };

const firstName = (name: string | null | undefined) => name?.trim().split(/\s+/)[0] || null;

/** Claims a notification key; false if it was already sent. */
async function claim(key: string): Promise<boolean> {
  const { data, error } = await createAdminClient()
    .from("notification_log")
    .upsert({ key }, { onConflict: "key", ignoreDuplicates: true })
    .select("key");
  return !error && (data?.length ?? 0) > 0;
}

async function deliver(targets: Target[], build: (t: Target) => PushPayload | null): Promise<number> {
  if (!configuredPush()) return 0;
  const gone: string[] = [];
  let sent = 0;
  await Promise.allSettled(
    targets.map(async (t) => {
      const payload = build(t);
      if (!payload) return;
      try {
        await webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } }, JSON.stringify(payload), {
          TTL: 60 * 30,
          urgency: "high",
        });
        sent += 1;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) gone.push(t.endpoint);
      }
    }),
  );
  if (gone.length) await createAdminClient().from("push_subscriptions").delete().in("endpoint", gone);
  return sent;
}

/** Display names by user id, for "Tayo, …". */
async function namesFor(userIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return new Map();
  const { data } = await createAdminClient().from("profiles").select("id, display_name").in("id", ids);
  return new Map((data ?? []).flatMap((p) => (firstName(p.display_name) ? [[p.id, firstName(p.display_name)!]] : [])));
}

// ---------------------------------------------------------------------------
// Kick-off reminders: 10 minutes before, to everyone following the match,
// either year, or all matches.
// ---------------------------------------------------------------------------
export async function sendKickoffReminders(now = new Date()): Promise<number> {
  const db = createAdminClient();
  const from = new Date(now.getTime() + 8 * 60_000).toISOString();
  const to = new Date(now.getTime() + 12 * 60_000).toISOString();
  const { data: fixtures } = await db
    .from("fixtures")
    .select(
      "id, kickoff_at, home_entrant, away_entrant, event:events!fixtures_event_id_fkey ( name, sport:sports!events_sport_id_fkey ( slug, name ) ), home:teams!fixtures_home_team_id_fkey ( id, name ), away:teams!fixtures_away_team_id_fkey ( id, name )",
    )
    .eq("status", "scheduled")
    .gt("kickoff_at", from)
    .lte("kickoff_at", to);

  let sent = 0;
  for (const f of fixtures ?? []) {
    if (!f.home || !f.away || !f.event?.sport) continue;
    if (!(await claim(`kickoff:${f.id}`))) continue;
    const topics = ["all", `fixture:${f.id}`, `team:${f.home.id}`, `team:${f.away.id}`];
    const { data: subs } = await db.from("push_subscriptions").select("endpoint, p256dh, auth, user_id, topics").overlaps("topics", topics);
    const targets: Target[] = (subs ?? []).map((s) => ({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth, userId: s.user_id, topics: s.topics }));
    const names = await namesFor(targets.flatMap((t) => (t.userId ? [t.userId] : [])));
    const what = f.event.sport.slug === "football" || f.event.name === f.event.sport.name ? f.event.sport.name : f.event.name;
    const vs = `${f.home_entrant ?? f.home.name} v ${f.away_entrant ?? f.away.name}`;
    sent += await deliver(targets, (t) => {
      const name = t.userId ? names.get(t.userId) : null;
      return {
        title: `${name ? `${name}, ` : ""}${vs} starts in 10 minutes`,
        body: `${what} · follow it live, and don't miss a goal.`,
        url: `/matches/${f.id}`,
        tag: `kickoff-${f.id}`,
      };
    });
  }
  return sent;
}

// ---------------------------------------------------------------------------
// Fantasy deadline reminders: an hour before, to every manager with
// notifications on.
// ---------------------------------------------------------------------------
export async function sendDeadlineReminders(now = new Date()): Promise<number> {
  const db = createAdminClient();
  const from = new Date(now.getTime() + 55 * 60_000).toISOString();
  const to = new Date(now.getTime() + 65 * 60_000).toISOString();
  const { data: matchdays } = await db.from("matchdays").select("id, number, deadline_at").gt("deadline_at", from).lte("deadline_at", to);

  let sent = 0;
  for (const md of matchdays ?? []) {
    if (!(await claim(`deadline:${md.id}`))) continue;
    const { data: managers } = await db.from("managers").select("user_id, team_name");
    const teamOf = new Map((managers ?? []).map((m) => [m.user_id, m.team_name]));
    if (teamOf.size === 0) continue;
    const { data: subs } = await db.from("push_subscriptions").select("endpoint, p256dh, auth, user_id, topics").in("user_id", [...teamOf.keys()]);
    const targets: Target[] = (subs ?? []).map((s) => ({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth, userId: s.user_id, topics: s.topics }));
    const names = await namesFor(targets.flatMap((t) => (t.userId ? [t.userId] : [])));
    sent += await deliver(targets, (t) => {
      const name = t.userId ? names.get(t.userId) : null;
      return {
        title: `${name ? `${name}, the` : "The"} Matchday ${md.number} deadline is in an hour`,
        body: `Is your captain set? Last changes for ${t.userId ? (teamOf.get(t.userId) ?? "your team") : "your team"}.`,
        url: "/fantasy/team",
        tag: `deadline-${md.id}`,
      };
    });
  }
  return sent;
}

// ---------------------------------------------------------------------------
// Fantasy results: when the admin finalises a matchday, each manager hears
// their score and overall rank.
// ---------------------------------------------------------------------------
export async function sendFantasyResults(matchdayId: string): Promise<number> {
  const db = createAdminClient();
  if (!(await claim(`fantasy-result:${matchdayId}`))) return 0;
  const [{ data: md }, { data: scores }] = await Promise.all([
    db.from("matchdays").select("number").eq("id", matchdayId).maybeSingle(),
    db.from("manager_matchday_points").select("net_points, manager:managers!inner ( user_id, team_name, overall_rank )").eq("matchday_id", matchdayId),
  ]);
  if (!md || !scores?.length) return 0;
  const byUser = new Map(scores.map((s) => [s.manager.user_id, { points: s.net_points, team: s.manager.team_name, rank: s.manager.overall_rank }]));
  const { data: subs } = await db.from("push_subscriptions").select("endpoint, p256dh, auth, user_id, topics").in("user_id", [...byUser.keys()]);
  const targets: Target[] = (subs ?? []).map((s) => ({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth, userId: s.user_id, topics: s.topics }));
  const names = await namesFor(targets.flatMap((t) => (t.userId ? [t.userId] : [])));
  return deliver(targets, (t) => {
    const r = t.userId ? byUser.get(t.userId) : undefined;
    if (!r) return null;
    const name = t.userId ? names.get(t.userId) : null;
    const rank = r.rank ? ` You're ${ordinal(r.rank)} overall.` : "";
    return {
      title: `${name ? `${name}, ` : ""}${r.team} scored ${r.points} ${r.points === 1 ? "point" : "points"}`,
      body: `Matchday ${md.number} is final.${rank}`,
      url: "/fantasy/points",
      tag: `fantasy-result-${matchdayId}`,
    };
  });
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/**
 * An announcement goes to every device with notifications on, whatever it
 * follows (a match, a year or all matches). Returns how many it reached.
 */
export async function sendToEveryDevice(payload: PushPayload): Promise<number> {
  const { data: subs } = await createAdminClient().from("push_subscriptions").select("endpoint, p256dh, auth, user_id, topics");
  const targets: Target[] = (subs ?? []).map((s) => ({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth, userId: s.user_id, topics: s.topics }));
  return deliver(targets, () => payload);
}
