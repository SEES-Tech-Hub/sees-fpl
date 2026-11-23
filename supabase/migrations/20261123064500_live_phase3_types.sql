-- =============================================================================
-- Live scores, phase 3 (part 1 of 2): new enum values
-- Owner: Bolu (live scores backend)
--
-- Postgres can't use a new enum value in the same transaction that adds it,
-- so the values live in their own migration. Run this file on its own, then
-- 20261123065000_live_phase3_formats.sql.
--
--   match_event_type: point (sets and head-to-head scoring), set_end
--   match_period:     basketball quarters and overtime
--   race_outcome:     finished, dnf, dns, dq (ranked results)
--
-- Safe to run twice.
-- =============================================================================

alter type public.match_event_type add value if not exists 'point';
alter type public.match_event_type add value if not exists 'set_end';

alter type public.match_period add value if not exists 'first_quarter';
alter type public.match_period add value if not exists 'second_quarter';
alter type public.match_period add value if not exists 'third_quarter';
alter type public.match_period add value if not exists 'fourth_quarter';
alter type public.match_period add value if not exists 'overtime';

do $$ begin
  create type public.race_outcome as enum ('finished', 'dnf', 'dns', 'dq');
exception when duplicate_object then null; end $$;
