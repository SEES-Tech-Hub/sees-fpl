-- =============================================================================
-- Keeper saves (part 1 of 2): the new event type
-- Owner: Tayo
--
-- Postgres can't use a new enum value in the same transaction that adds it,
-- so it lives in its own migration. Then 20261128121000_live_saves.sql.
--
--   match_event_type: save (a goalkeeper's save; timed sports)
--
-- Safe to run twice.
-- =============================================================================

alter type public.match_event_type add value if not exists 'save';
