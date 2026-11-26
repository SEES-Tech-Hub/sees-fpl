-- =============================================================================
-- SEES Fantasy: 5 free transfers per matchday
-- Author: Tayo (agreed with the fantasy team, 26 Nov)
--
-- Six matchdays, and a different year rests each one, so one free transfer
-- left managers stuck with players who weren't playing. Now:
--   * 5 free transfers per matchday (free_transfers_per_md)
--   * up to 10 banked (max_saved_transfers caps the total available)
--   * extra transfers still cost 4 points; unlimited before MD1 and MD6 and
--     the Wildcard are unchanged.
--
-- Managers who haven't reached Matchday 2 yet (last_rollover_matchday 1)
-- get 5 for it now. create_manager() starts new teams on 1, so a trigger sets
-- a new team's starting free transfers from the rules instead.
--
-- Safe to run twice.
-- =============================================================================

update public.fantasy_rules
set free_transfers_per_md = 5,
    max_saved_transfers   = 10
where id = 1;

update public.managers m
set free_transfers = greatest(m.free_transfers, r.free_transfers_per_md)
from public.fantasy_rules r
where r.id = 1 and m.last_rollover_matchday <= 1;

create or replace function public.managers_initial_free_transfers()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select r.free_transfers_per_md into new.free_transfers from public.fantasy_rules r where r.id = 1;
  return new;
end;
$$;

revoke all on function public.managers_initial_free_transfers() from public, anon, authenticated;

drop trigger if exists managers_initial_free_transfers on public.managers;
create trigger managers_initial_free_transfers
  before insert on public.managers
  for each row execute function public.managers_initial_free_transfers();

-- =============================================================================
-- Verify (for Tayo, after applying)
-- =============================================================================
-- select free_transfers_per_md, max_saved_transfers, extra_transfer_cost from public.fantasy_rules;   -- 5, 10, 4
-- select free_transfers, last_rollover_matchday from public.managers;   -- 5 each before Matchday 2
