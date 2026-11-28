-- =============================================================================
-- Chess byes: a year without a match in a round gets 2 points
-- Owner: Tayo
--
-- The chess round robin has a bye each round (five years, two matches). The
-- organisers give the year with the bye 2 points: both boards' worth. Board
-- points are stored doubled (a board win 2, a draw 1), so chess's bye_score
-- is 4, which the table shows as 2 in its Boards column (the ranking).
--
-- events.bye_score (null: no byes) and event_standings adding it, once the
-- round has been played. event_standings is copied from
-- 20261125075848_live_boards_players_legs.sql with only the bye changes; its
-- columns are unchanged.
-- Safe to run twice.
-- =============================================================================

alter table public.events add column if not exists bye_score smallint;
comment on column public.events.bye_score is
  'Round robins in rounds: score a team gets for a round it sits out (stored like score_for; board games doubled). Null: no byes.';

update public.events set bye_score = 4 where slug = 'board-games-chess-men';

create or replace view public.event_standings
with (security_invoker = true)
as
with lf as (
  select f.id, f.event_id, f.home_team_id, f.away_team_id, f.home_score, f.away_score,
         f.status, f.winner_team_id, s.result_format, f.kickoff_at,
         coalesce(ev.win_points, 3) as win_points,
         coalesce(ev.draw_points, 1) as draw_points,
         coalesce(ev.loss_points, 0) as loss_points
  from public.fixtures f
  join public.events ev on ev.id = f.event_id
  join public.sports s on s.id = ev.sport_id
  where s.slug <> 'football' and s.result_format <> 'ranked'
    and f.stage in ('league', 'group')
    and f.home_team_id is not null and f.away_team_id is not null
),
teams_in as (
  select event_id, home_team_id as team_id from lf
  union
  select event_id, away_team_id from lf
),
rally as (
  select fixture_id, sum(home_points)::integer as home_points, sum(away_points)::integer as away_points
  from public.fixture_set_scores group by fixture_id
),
counted as (
  select lf.*,
         case when lf.result_format = 'sets' then coalesce(r.home_points, 0) else lf.home_score end as home_for,
         case when lf.result_format = 'sets' then coalesce(r.away_points, 0) else lf.away_score end as away_for
  from lf
  left join rally r on r.fixture_id = lf.id
  where lf.status in ('live', 'half_time', 'full_time', 'walkover')
),
res as (
  select event_id, id as fixture_id, home_team_id as team_id, away_team_id as opponent_id,
         coalesce(home_for, 0) as score_for, coalesce(away_for, 0) as score_against,
         coalesce(home_score, 0) as sets_for, coalesce(away_score, 0) as sets_against,
         status, winner_team_id, result_format, win_points, draw_points, loss_points
  from counted
  union all
  select event_id, id, away_team_id, home_team_id,
         coalesce(away_for, 0), coalesce(home_for, 0),
         coalesce(away_score, 0), coalesce(home_score, 0),
         status, winner_team_id, result_format, win_points, draw_points, loss_points
  from counted
),
res_outcome as (
  select r.*,
    case
      when r.status in ('full_time', 'walkover') then
        case when r.winner_team_id = r.team_id then 'W' when r.winner_team_id is null then 'D' else 'L' end
      -- In play: who's ahead now (sets won for a sets match, else the score).
      when r.result_format = 'sets' then
        case when r.sets_for > r.sets_against then 'W' when r.sets_for = r.sets_against then 'D' else 'L' end
      else
        case when r.score_for > r.score_against then 'W' when r.score_for = r.score_against then 'D' else 'L' end
    end as outcome
  from res r
),
res_pts as (
  select o.*,
    case o.outcome when 'W' then o.win_points when 'D' then o.draw_points else o.loss_points end as pts
  from res_outcome o
),
tot0 as (
  select
    t.event_id,
    t.team_id,
    count(r.team_id)::integer                            as played,
    count(*) filter (where r.outcome = 'W')::integer     as won,
    count(*) filter (where r.outcome = 'D')::integer     as drawn,
    count(*) filter (where r.outcome = 'L')::integer     as lost,
    coalesce(sum(r.score_for), 0)::integer               as score_for,
    coalesce(sum(r.score_against), 0)::integer           as score_against,
    coalesce(sum(r.sets_for) filter (where r.result_format = 'sets'), 0)::integer     as sets_for,
    coalesce(sum(r.sets_against) filter (where r.result_format = 'sets'), 0)::integer as sets_against,
    coalesce(sum(r.pts), 0)::integer                     as points,
    coalesce(bool_or(r.status in ('live', 'half_time')), false) as live
  from teams_in t
  left join res_pts r on r.event_id = t.event_id and r.team_id = t.team_id
  group by t.event_id, t.team_id
),
-- Byes: in a round robin played in rounds (fixtures sharing a kick-off time),
-- a team with no match in a round that has been played gets the event's
-- bye_score (chess: 2 boards' worth). Rounds count once any match in them is over.
played_rounds as (
  select event_id, kickoff_at from lf
  where status in ('full_time', 'walkover') and kickoff_at is not null
  group by event_id, kickoff_at
),
byes as (
  select t.event_id, t.team_id, count(*)::integer as byes
  from teams_in t
  join played_rounds pr on pr.event_id = t.event_id
  join public.events e on e.id = t.event_id and e.bye_score is not null
  where not exists (
    select 1 from lf
    where lf.event_id = t.event_id and lf.kickoff_at = pr.kickoff_at
      and t.team_id in (lf.home_team_id, lf.away_team_id)
  )
  group by t.event_id, t.team_id
),
tot as (
  select t0.event_id, t0.team_id, t0.played, t0.won, t0.drawn, t0.lost,
         (t0.score_for + coalesce(b.byes, 0) * coalesce(e.bye_score, 0))::integer as score_for,
         t0.score_against, t0.sets_for, t0.sets_against, t0.points, t0.live
  from tot0 t0
  join public.events e on e.id = t0.event_id
  left join byes b on b.event_id = t0.event_id and b.team_id = t0.team_id
),
h2h as (
  -- Points only from matches between teams level on points.
  select a.event_id, a.team_id, sum(r.pts)::integer as h2h_points
  from tot a
  join res_pts r on r.event_id = a.event_id and r.team_id = a.team_id
  join tot b on b.event_id = a.event_id and b.team_id = r.opponent_id
  where a.points = b.points
  group by a.event_id, a.team_id
),
ranked as (
  select
    tot.*,
    tot.score_for - tot.score_against as score_difference,
    coalesce(h.h2h_points, 0) as h2h_points,
    rank() over (
      partition by tot.event_id
      order by case when evx.rank_by_score then tot.score_for end desc nulls last,
               tot.points desc,
               coalesce(h.h2h_points, 0) desc,
               tot.score_for - tot.score_against desc,
               tot.score_for desc
    )::integer as position
  from tot
  left join h2h h on h.event_id = tot.event_id and h.team_id = tot.team_id
  join public.events evx on evx.id = tot.event_id
)
select
  r.event_id,
  r.position,
  count(*) over (partition by r.event_id, r.position) > 1 as position_shared,
  r.team_id,
  t.name       as team_name,
  t.short_name as team_short_name,
  t.year       as team_year,
  r.played,
  r.won,
  r.drawn,
  r.lost,
  r.score_for,
  r.score_against,
  r.score_difference,
  r.sets_for,
  r.sets_against,
  r.points,
  r.h2h_points,
  r.live
from ranked r
join public.teams t on t.id = r.team_id;

revoke insert, update, delete, truncate on public.event_standings from anon, authenticated;
grant select on public.event_standings to anon, authenticated;
