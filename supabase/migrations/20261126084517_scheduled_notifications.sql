-- =============================================================================
-- Scheduled notifications: kick-off and fantasy deadline reminders
-- Author: Tayo
--
-- What this adds
--   * notification_log: one row per personal notification sent (kick-off
--     reminder, deadline reminder, fantasy result), so each goes out once.
--     No policies: only the app's secret key reads or writes it.
--   * A pg_cron job that, every minute, calls the site's
--     /api/cron/notifications with a secret. The site sends whatever is due
--     (lib/push/personal.ts). The address and the secret live in Supabase
--     Vault, set once in the SQL editor (not in this file):
--
--       select vault.create_secret('https://games.seesunilag.com/api/cron/notifications', 'notify_cron_url');
--       select vault.create_secret('<the CRON_SECRET from Vercel>', 'notify_cron_secret');
--
--     Until both exist, the job does nothing.
--
-- pg_cron and pg_net are on Supabase's free plan. Safe to run twice; on a
-- database without them (a local test), the schedule step is skipped.
-- =============================================================================

create table if not exists public.notification_log (
  key     text primary key check (char_length(key) between 1 and 120),
  sent_at timestamptz not null default now()
);
alter table public.notification_log enable row level security;

do $outer$
begin
  create extension if not exists pg_cron;
  create extension if not exists pg_net;

  perform cron.schedule(
    'sees-notifications',
    '* * * * *',
    $job$
      select net.http_post(
        url     := (select decrypted_secret from vault.decrypted_secrets where name = 'notify_cron_url'),
        headers := jsonb_build_object(
                     'Content-Type', 'application/json',
                     'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'notify_cron_secret')),
        body    := '{}'::jsonb,
        timeout_milliseconds := 20000
      )
      where exists (select 1 from vault.decrypted_secrets where name = 'notify_cron_url')
        and exists (select 1 from vault.decrypted_secrets where name = 'notify_cron_secret');
    $job$
  );
exception
  when undefined_function or undefined_object or feature_not_supported or insufficient_privilege or invalid_schema_name then
    raise notice 'pg_cron or pg_net not available here: skipping the notification schedule.';
end;
$outer$;

-- =============================================================================
-- Verify (for Tayo, after applying and setting the two Vault secrets)
-- =============================================================================
-- select jobname, schedule, active from cron.job where jobname = 'sees-notifications';
-- select status_code, created from net._http_response order by created desc limit 3;   -- 200s
-- To stop it: select cron.unschedule('sees-notifications');
