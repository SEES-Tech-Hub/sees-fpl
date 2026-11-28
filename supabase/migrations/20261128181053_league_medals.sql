-- =============================================================================
-- Medals for league-only events (chess)
-- Owner: Tayo
--
-- event_medals only gave medals from a final and a 3rd-place match (or a race
-- final). A round robin decided by its table, like chess, never produced any,
-- so the championship and medal tables ignored it. Now an event whose
-- fixtures are all league or group matches gives gold, silver and bronze to
-- the top three of event_standings once every one of those matches is over
-- (full time or walkover; cancelled ones don't block it). A shared place
-- shares the medal.
--
-- Official final placings: when the organisers send only a final table (no
-- match results), the admin records it in event_placings. An event with
-- placings takes its medals from them, ahead of anything worked out from
-- matches. Connect Four's (28 Nov) goes in here: the organisers' final score
-- table, Year 5 33, Year 4 21, Year 3 18, Year 2 6, Year 1 3.
--
-- event_medals is copied from 20261123065000_live_phase3_formats.sql with two
-- more unions; its columns are unchanged. Safe to run twice.
-- =============================================================================

create table if not exists public.event_placings (
  event_id   uuid not null references public.events (id) on delete cascade,
  team_id    uuid not null references public.teams (id) on delete restrict,
  position   smallint not null check (position between 1 and 20),
  score      numeric,
  note       text,
  created_at timestamptz not null default now(),
  primary key (event_id, team_id)
);
create index if not exists event_placings_team_id_idx on public.event_placings (team_id);
comment on table public.event_placings is
  'Official final placings for an event, when only a final table is known. They decide its medals (event_medals).';

alter table public.event_placings enable row level security;
drop policy if exists event_placings_read on public.event_placings;
create policy event_placings_read on public.event_placings for select using (true);
drop policy if exists event_placings_admin on public.event_placings;
create policy event_placings_admin on public.event_placings for all
  using (public.is_admin()) with check (public.is_admin());
grant select on public.event_placings to anon, authenticated;

insert into public.event_placings (event_id, team_id, position, score, note)
select e.id, t.id, v.position, v.score, 'Organisers'' final score table, 28 Nov'
from public.events e
cross join (values (5, 1, 33), (4, 2, 21), (3, 3, 18), (2, 4, 6), (1, 5, 3)) as v(year, position, score)
join public.teams t on t.year = v.year
where e.slug = 'board-games-connect-four'
on conflict (event_id, team_id) do update set position = excluded.position, score = excluded.score, note = excluded.note;

create or replace view public.event_medals
with (security_invoker = true)
as
with team_results as (
  select f.event_id, f.id as fixture_id, f.stage, f.winner_team_id,
         case when f.winner_team_id = f.home_team_id then f.away_team_id else f.home_team_id end as loser_team_id
  from public.fixtures f
  join public.events ev on ev.id = f.event_id
  join public.sports s on s.id = ev.sport_id
  where s.result_format <> 'ranked'
    and f.stage in ('final', 'third_place')
    and f.status in ('full_time', 'walkover')
    and f.winner_team_id is not null
)
select event_id, fixture_id, 'gold'::text as medal, 1 as place, winner_team_id as team_id, null::text as athlete_name
from team_results where stage = 'final'
union all
select event_id, fixture_id, 'silver', 2, loser_team_id, null::text
from team_results where stage = 'final'
union all
select event_id, fixture_id, 'bronze', 3, winner_team_id, null::text
from team_results where stage = 'third_place'
union all
select f.event_id, f.id, case r.position when 1 then 'gold' when 2 then 'silver' else 'bronze' end,
       r.position::integer, r.team_id, coalesce(p.display_name, r.athlete_name)
from public.race_entries r
left join public.players p on p.id = r.player_id
join public.fixtures f on f.id = r.fixture_id
join public.events ev on ev.id = f.event_id
join public.sports s on s.id = ev.sport_id
where s.result_format = 'ranked' and f.stage = 'final' and f.status = 'full_time'
  and r.outcome = 'finished' and r.position between 1 and 3
union all
-- Official placings (event_placings) decide the medals of their event.
select pl.event_id,
       (select f2.id from public.fixtures f2 where f2.event_id = pl.event_id
        order by f2.kickoff_at desc nulls last, f2.id desc limit 1),
       case pl.position when 1 then 'gold' when 2 then 'silver' else 'bronze' end,
       pl.position::integer, pl.team_id, null::text
from public.event_placings pl
where pl.position between 1 and 3
union all
-- League-only events (a round robin with no final, like chess): once every
-- league match is over, the top three of the table get the medals. Events
-- with a knockout stage keep getting theirs from the final and 3rd place.
select st.event_id,
       (select f2.id from public.fixtures f2
        where f2.event_id = st.event_id and f2.stage in ('league', 'group')
        order by f2.kickoff_at desc nulls last, f2.id desc limit 1),
       case st.position when 1 then 'gold' when 2 then 'silver' else 'bronze' end,
       st.position, st.team_id, null::text
from public.event_standings st
where st.position between 1 and 3
  and exists (
    select 1 from public.fixtures f where f.event_id = st.event_id and f.stage in ('league', 'group'))
  and not exists (select 1 from public.event_placings pl where pl.event_id = st.event_id)
  and not exists (
    select 1 from public.fixtures f where f.event_id = st.event_id and f.stage not in ('league', 'group'))
  and not exists (
    select 1 from public.fixtures f where f.event_id = st.event_id and f.stage in ('league', 'group')
      and f.status in ('scheduled', 'live', 'half_time', 'postponed'));

comment on view public.event_medals is
  'Gold, silver and bronze per event: final and third-place results, places 1-3 in a race final, or the top three of a finished league with no knockouts.';

revoke insert, update, delete, truncate on public.event_medals from anon, authenticated;
grant select on public.event_medals to anon, authenticated;
