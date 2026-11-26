import { timingSafeEqual } from "node:crypto";
import { sendDeadlineReminders, sendKickoffReminders } from "@/lib/push/personal";

// Called every minute by Supabase (pg_cron + pg_net, migration
// *_scheduled_notifications.sql) with "Authorization: Bearer <CRON_SECRET>".
// Sends the kick-off and fantasy deadline reminders that are due; each is
// logged, so a repeat call sends nothing twice.

function authorised(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!authorised(request)) return Response.json({ error: "unauthorised" }, { status: 401 });
  // Run each job on its own, so one failing doesn't hide the other, and say
  // what failed (only to a caller holding the secret).
  const run = async (job: () => Promise<number>) => {
    try {
      return { ok: true as const, sent: await job() };
    } catch (e) {
      console.error("[cron] notifications job failed:", e);
      return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
    }
  };
  const [kickoffs, deadlines] = await Promise.all([run(sendKickoffReminders), run(sendDeadlineReminders)]);
  const ok = kickoffs.ok && deadlines.ok;
  return Response.json({ ok, kickoffs, deadlines }, { status: ok ? 200 : 500 });
}
