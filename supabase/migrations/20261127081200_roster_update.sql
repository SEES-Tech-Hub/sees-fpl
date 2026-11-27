-- =============================================================================
-- Roster update from the captains' latest team list (27 Nov)
-- Author: Tayo, 27 Nov
--
-- The captains sent an updated "FPL name and prices" doc, which replaces the
-- 23 Nov list (20261123114953_player_prices_and_squads.sql). Against what's in
-- the database it changes:
--
--   Prices   Year 1 Ezekiel        N6.0m -> N5.0m
--            Year 1 Oluwadamilola  N6.0m -> N5.5m
--            Year 5 Korede         N6.0m -> N6.5m
--   Position Year 4 Marshall, Alvin and Success  FWD -> MID
--            Year 5 Fame                         FWD -> MID
--   New      Year 4 Malik, MID, N5.0m (Year 2 also has a Malik; different player)
--   Left     Year 4 Zeus (moved; not on the list). Kept, not deleted, so
--            nothing that points at them breaks.
--
-- A position change would leave a squad with the wrong shape (6 MID, 2 FWD),
-- which transfers can't fix (a player is only swapped for the same
-- position). Three managers held one of those players when this was written:
-- LDR, UltimateFC and ThePantheon. With Tayo's go-ahead, their squads and
-- lineups are cleared (the manager and team name stay), so they pick again
-- in the squad builder before the matchday 1 deadline. If any other squad
-- holds one of those players, this stops and names it instead.
--
-- Prices lock at the matchday 1 deadline; this runs as the migration role,
-- which the price lock lets through. Safe to run twice.
-- =============================================================================

-- The changes, by year and name (unique within a year).
drop table if exists pg_temp.roster_changes;
create temporary table roster_changes (year smallint, name text, position public.player_position, price_tenths smallint);
insert into roster_changes values
  (1, 'Ezekiel',       null,  50),
  (1, 'Oluwadamilola', null,  55),
  (5, 'Korede',        null,  65),
  (4, 'Marshall',      'MID', null),
  (4, 'Alvin',         'MID', null),
  (4, 'Success',       'MID', null),
  (5, 'Fame',          'MID', null);

do $$
declare
  -- Cleared with Tayo's go-ahead (27 Nov): LDR, UltimateFC, ThePantheon.
  v_cleared constant uuid[] := array[
    'c85feb21-36b9-435a-a7be-b1bf91786413',
    'efcfe217-4fa7-48d4-88d4-a0b4bf5dadc0',
    '43b77797-977a-442a-9300-59a1393b7ebc'
  ]::uuid[];
  v_clear   uuid[];
  v_held    text;
  v_missing text;
begin
  select string_agg(format('Year %s %s', c.year, c.name), ', ')
  into v_missing
  from roster_changes c
  where not exists (
    select 1 from public.players p join public.teams t on t.id = p.team_id
    where t.year = c.year and p.display_name = c.name
  );
  if v_missing is not null then
    raise exception 'Not found: %. Nothing changed.', v_missing;
  end if;

  select string_agg(format('%s (manager %s)', p.display_name, s.manager_id), ', ')
  into v_held
  from public.squads s
  join public.players p on p.id = s.player_id
  join public.teams t on t.id = p.team_id
  join roster_changes c on c.year = t.year and c.name = p.display_name
  where c.position is not null and p.position <> c.position
    and s.manager_id <> all (v_cleared);
  if v_held is not null then
    raise exception 'These players are in a squad and would change position: %. Nothing changed.', v_held;
  end if;

  -- Clear those three squads, only while they still hold a player whose
  -- position is about to change, so running this again never touches the
  -- squads they pick afterwards. Lineups first, then the squad.
  select coalesce(array_agg(distinct s.manager_id), '{}')
  into v_clear
  from public.squads s
  join public.players p on p.id = s.player_id
  join public.teams t on t.id = p.team_id
  join roster_changes c on c.year = t.year and c.name = p.display_name
  where c.position is not null and p.position <> c.position
    and s.manager_id = any (v_cleared);

  delete from public.picks  where manager_id = any (v_clear);
  delete from public.squads where manager_id = any (v_clear);
  raise notice 'Cleared % squad(s).', cardinality(v_clear);
end;
$$;

update public.players p
set position     = coalesce(c.position, p.position),
    price_tenths = coalesce(c.price_tenths, p.price_tenths)
from roster_changes c, public.teams t
where t.id = p.team_id and t.year = c.year and p.display_name = c.name;

drop table roster_changes;

-- Malik (Year 4), with a fixed id so a photo can follow by id.
insert into public.players (id, team_id, full_name, display_name, position, price_tenths, status)
select 'c6fb831a-482e-42f2-b95a-9a2c7efed327', t.id, 'Malik', 'Malik', 'MID', 50, 'available'
from public.teams t
where t.year = 4
on conflict do nothing;

-- Zeus (Year 4) has moved.
update public.players p set status = 'left'
from public.teams t
where t.id = p.team_id and t.year = 4 and p.display_name = 'Zeus';

-- =============================================================================
-- Verify (for Tayo, after applying)
-- =============================================================================
-- select t.year, p.display_name, p.position, p.price_tenths, p.status
-- from public.players p join public.teams t on t.id = p.team_id
-- where p.display_name in ('Ezekiel','Oluwadamilola','Korede','Marshall','Alvin','Success','Fame','Malik','Zeus')
-- order by t.year, p.display_name;
