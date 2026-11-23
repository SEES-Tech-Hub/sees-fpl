-- =============================================================================
-- Fantasy: "selected by" percentages, and no picking players who have left
-- Author: Tayo
--
-- 1. fantasy_player_selection(): for each player, the share of managers with
--    a squad whose squad holds that player (0 to 100, one decimal). Squads are
--    private (RLS), so this SECURITY DEFINER function returns only the
--    aggregate, never who picked whom.
-- 2. squads_reject_left_players: a trigger on squads. save_squad and
--    make_transfers both add players by inserting into squads, so this one
--    trigger stops either from bringing in a player whose status is 'left'.
--    A player who leaves while already in a squad stays there until the
--    manager transfers them out (that is a delete, which the trigger ignores).
-- Safe to run twice.
-- =============================================================================

create or replace function public.fantasy_player_selection()
returns table (player_id uuid, selected_by_pct numeric)
language sql
stable
security definer
set search_path = ''
as $$
  with total as (
    select count(distinct manager_id)::numeric as n from public.squads
  )
  select s.player_id,
         round(100 * count(*)::numeric / nullif((select n from total), 0), 1)
  from public.squads s
  group by s.player_id;
$$;

revoke all on function public.fantasy_player_selection() from public;
grant execute on function public.fantasy_player_selection() to anon, authenticated;

create or replace function public.squads_reject_left_players()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  select display_name into v_name
  from public.players
  where id = new.player_id and status = 'left';
  if found then
    perform public.fantasy_fail('PLAYER_UNAVAILABLE',
      format('%s has left their squad. Pick someone else.', v_name));
  end if;
  return new;
end;
$$;

revoke all on function public.squads_reject_left_players() from public, anon, authenticated;

drop trigger if exists squads_reject_left_players on public.squads;
create trigger squads_reject_left_players
  before insert or update of player_id on public.squads
  for each row execute function public.squads_reject_left_players();
