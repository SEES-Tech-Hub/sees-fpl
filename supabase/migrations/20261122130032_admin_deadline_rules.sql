-- =============================================================================
-- Admin: deadline rules
-- Author: Akeem (admin backend)
-- PRD: "Deadlines and transfers" (the deadline is 30 min before the first
--      kickoff of each matchday); "Feature: Admin portal and match console",
--      item 6 (deadlines worked out from the first kickoff)
--
-- What this adds
--   * admin_deadline_rules(): how many minutes before a matchday's first
--     kickoff its deadline should be. The single place the admin backend reads
--     it, like admin_price_rules().
--
-- Deadlines are not recalculated when kickoffs move (agreed with Mary). The
-- admin portal uses this to warn when a matchday's first kickoff ends up less
-- than this many minutes after its deadline, or before it.
--
-- The value mirrors the PRD and the fantasy rules page. fantasy_rules has no
-- column for it yet. When Mary adds one, change only this function to read it.
--
-- Safe to run twice.
-- =============================================================================

create or replace function public.admin_deadline_rules()
returns table (minutes_before_kickoff smallint)
language sql
immutable
set search_path = ''
as $$
  select 30::smallint;
$$;

-- Public: the fantasy pages can show the same rule.
grant execute on function public.admin_deadline_rules() to anon, authenticated;

-- =============================================================================
-- Verify (for Tayo, after applying)
-- =============================================================================
-- select * from public.admin_deadline_rules();   -- 30
-- As anon (or in the app, signed out): the same result.
