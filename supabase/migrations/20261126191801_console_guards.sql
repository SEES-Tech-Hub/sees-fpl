-- =============================================================================
-- Console guards: no early kick-offs, and the admin's undo works
-- Author: Tayo, 26 Nov
--
-- On 26 Nov an admin looking around the console kicked off Year 5 v Year 3
-- two days early, and Undo refused because it asked the admin for a reason
-- the console never sends. The console now makes everyone, the admin
-- included, take a match before recording it (app/console). Here:
--
--   1. A match's first event (kick-off, first point, first move) is refused
--      until 2 hours before its scheduled start, from any console and for the
--      admin too, with live.too_early. Walkovers are exempt, and so is a
--      fixture with no time. If a match really starts earlier, change its time
--      in Admin → Fixtures first. lib/live/kickoff-window.ts has the same
--      window for the console's message.
--   2. void_match_event: the admin's undo without a reason follows the
--      official's rule (your own latest event, within 30 seconds). A
--      correction with a reason (Admin → Fixtures) works as before.
--
-- Safe to run twice.
-- =============================================================================

create or replace function public.match_events_kickoff_window()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kickoff timestamptz;
begin
  -- Migrations and scripts (no signed-in user) and walkovers are not limited.
  if auth.uid() is null or new.type = 'walkover' then
    return new;
  end if;

  -- Only the first active event of a match opens it.
  if exists (select 1 from public.match_events where fixture_id = new.fixture_id and voided_at is null) then
    return new;
  end if;

  select kickoff_at into v_kickoff from public.fixtures where id = new.fixture_id;
  if v_kickoff is not null and now() < v_kickoff - interval '2 hours' then
    perform public.live_fail('live.too_early', format(
      'Too early. This match starts %s, and kick-off opens 2 hours before. If the time has changed, update it in Admin → Fixtures first.',
      to_char(v_kickoff at time zone 'Africa/Lagos', 'Dy FMDD Mon, FMHH12:MI am')));
  end if;

  return new;
end;
$$;

revoke all on function public.match_events_kickoff_window() from public, anon, authenticated;

drop trigger if exists match_events_kickoff_window on public.match_events;
create trigger match_events_kickoff_window
  before insert on public.match_events
  for each row execute function public.match_events_kickoff_window();

-- -----------------------------------------------------------------------------
-- void_match_event: as in 20261119203500_live_match_events.sql, except that
-- the admin's undo without a reason follows the official's rule.
-- -----------------------------------------------------------------------------
create or replace function public.void_match_event(
  p_client_event_id uuid,
  p_reason          text default null
)
returns public.match_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_event   public.match_events%rowtype;
  v_latest  bigint;
  v_reason  text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  select * into v_event from public.match_events where client_event_id = p_client_event_id;
  if not found then
    perform public.live_fail('live.event_not_found', 'That event wasn''t found. It may not have been sent yet.');
  end if;

  perform public.live_lock_fixture_for_console(v_event.fixture_id);

  -- Re-read under the fixture lock.
  select * into v_event from public.match_events where client_event_id = p_client_event_id;
  if v_event.voided_at is not null then
    return v_event;
  end if;

  if public.is_admin() and v_reason is not null then
    -- A correction from Admin → Fixtures: any event, with a reason.
    if length(v_reason) < 3 then
      perform public.live_fail('live.reason_required', 'Give a short reason for the correction.');
    end if;
  else
    -- Undo on the console (officials and the admin): your own latest event,
    -- within 30 seconds.
    if v_event.recorded_by is distinct from v_uid then
      perform public.live_fail('live.undo_not_allowed', 'You can only undo events you recorded.');
    end if;
    if v_event.recorded_at < now() - interval '30 seconds' then
      perform public.live_fail('live.undo_expired', 'Too late to undo. Void it in Admin → Fixtures instead.');
    end if;
    select id into v_latest
    from public.match_events
    where fixture_id = v_event.fixture_id and voided_at is null
    order by occurred_at desc, id desc
    limit 1;
    if v_latest <> v_event.id then
      perform public.live_fail('live.undo_not_latest', 'Only the most recent event can be undone.');
    end if;
  end if;

  update public.match_events
  set voided_at   = now(),
      voided_by   = v_uid,
      void_reason = coalesce(v_reason, 'Undone on the console')
  where id = v_event.id
  returning * into v_event;

  return v_event;
end;
$$;

-- =============================================================================
-- Verify (for Tayo, after applying)
-- =============================================================================
-- select tgname from pg_trigger where tgrelid = 'public.match_events'::regclass and not tgisinternal;
--   -- includes match_events_kickoff_window
