-- =============================================================================
-- Live scores, phase 2: derived football data
-- Owner: Bolu (live scores backend)
-- PRD: "Feature: Live scores and results" (standings, football stats),
--      "Tournament facts" (points, tie-breakers, 1-match ban),
--      "Team and ownership" (Bolu -> Mary: player_match_stats)
-- Guide for the team: docs/live-scores.md
--
-- What this adds
--   * player_match_stats (view): one row per player per fixture, worked out
--     from match_events and lineups. Mary's fantasy engine reads only this.
--   * football_standings (view): the league table in rulebook order
--     (3/1/0, goal difference, goals scored, head-to-head), live during play.
--   * football_player_totals (view): goals, assists, clean sheets, cards and
--     minutes per player per event, for top scorers and the stats pages.
--   * football_suspensions (view): a red card means a 1-match ban in the
--     team's next fixture. set_lineup now refuses a banned player.
--   * fill_football_knockouts(): puts 1st v 2nd into the final and 3rd v 4th
--     into the third-place match once the league is finished (admin only;
--     Henry's fillKnockouts action calls it).
--
-- Everything here is calculated when it is read. Nothing is stored, so a
-- voided or corrected event changes stats, the table and top scorers at once.
--
-- Error handling: as in phase 1, rule violations raise SQLSTATE P0001 with a
-- stable code in HINT (live.*).
--
-- Safe to run twice.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- The match-clock minute at which a period ends (football: first half 25,
-- second half 50, extra time 57 and 64). Penalties have no minute.
-- -----------------------------------------------------------------------------
create or replace function public.live_period_end_minute(
  p_period               public.match_period,
  p_period_minutes       integer,
  p_extra_period_minutes integer
)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_period
    when 'first_half'   then p_period_minutes
    when 'second_half'  then 2 * p_period_minutes
    when 'extra_first'  then 2 * p_period_minutes + p_extra_period_minutes
    when 'extra_second' then 2 * p_period_minutes + 2 * p_extra_period_minutes
  end;
$$;

-- -----------------------------------------------------------------------------
-- player_match_stats: one row per player per fixture (timed sports)
--
-- Who gets a row: everyone in the fixture's lineups, plus any player named in
-- an event (so a match recorded without lineups still has stats).
--
-- Minutes use the match clock, the minute the referee would call: half time
-- and stoppage time don't count, extra time does. A starter is on from 0'.
-- A substitute is on from the minute they came on. A player stops at the
-- minute they were subbed off or sent off, otherwise at the end of the last
-- period played (50' in a league match, 64' after extra time). During a
-- match, minutes run up to the current clock minute.
--     Came on at 20' and played to full time in a 50-minute match: 30.
--     Subbed off at 29': 29.
--
-- Goals conceded on the pitch: goals for the other team while the player was
-- on, in the order events were recorded. Own goals by teammates count (they
-- are goals for the other team); own_goals_conceded_on_pitch says how many
-- of those were own goals, so the fantasy rules can leave them out.
--
-- red_from_second_yellow: the player already had a yellow in this match when
-- the red was shown. The console records a second yellow as a red card.
--
-- Facts only: rule values (points, the 30-minute threshold) stay in the
-- fantasy rules table. Penalty shootout kicks never count.
-- Without a lineup for their team, a player named in an event is assumed to
-- have started (lineup_set = false tells the reader minutes are a guess).
-- -----------------------------------------------------------------------------
create or replace view public.player_match_stats
with (security_invoker = true)
as
with fx as (
  select
    f.id as fixture_id,
    f.event_id,
    f.matchday_id,
    f.status,
    f.status in ('live', 'half_time', 'full_time') as kicked_off,
    f.status in ('full_time', 'walkover') as fixture_finished,
    f.status = 'walkover' as walkover,
    -- The match-clock minute this fixture has reached (stoppage excluded).
    case
      when f.status not in ('live', 'half_time', 'full_time') then 0
      when f.status = 'live' and f.current_period in ('first_half', 'second_half', 'extra_first', 'extra_second') then
        (select m.minute
         from public.match_minute(f.current_period, f.period_started_at, now(),
                                  ev.period_minutes, ev.extra_period_minutes) m)
      else
        (select max(public.live_period_end_minute(ps.period, ev.period_minutes, ev.extra_period_minutes))
         from public.match_events ps
         where ps.fixture_id = f.id and ps.type = 'period_start'
           and ps.voided_at is null and ps.period <> 'penalties')
    end as clock_minute
  from public.fixtures f
  join public.events ev on ev.id = f.event_id
  join public.sports s on s.id = ev.sport_id
  where s.result_format = 'timed'
),
tl as (
  -- Active events with their match-clock minute (shootout kicks excluded).
  select t.fixture_id, t.id, t.type, t.team_id, t.player_id, t.other_player_id,
         t.card, t.is_own_goal, t.occurred_at, t.minute
  from public.match_timeline t
  join fx on fx.fixture_id = t.fixture_id
  where t.type in ('goal', 'card', 'substitution', 'penalty_miss', 'man_of_the_match', 'shootout_kick')
),
involved as (
  select l.fixture_id, l.player_id
  from public.lineups l join fx on fx.fixture_id = l.fixture_id
  union
  select fixture_id, player_id from tl where player_id is not null
  union
  select fixture_id, other_player_id from tl
  where other_player_id is not null and type in ('goal', 'substitution', 'penalty_miss')
),
base as (
  select
    i.fixture_id,
    fx.event_id,
    fx.matchday_id,
    i.player_id,
    p.team_id,
    p.position,
    fx.kicked_off,
    fx.fixture_finished,
    fx.walkover,
    fx.clock_minute,
    l.role as lineup_role,
    exists (
      select 1 from public.lineups lt
      where lt.fixture_id = i.fixture_id and lt.team_id = p.team_id
    ) as lineup_set,
    son.minute      as on_minute,
    son.occurred_at as on_at,
    son.id          as on_id,
    soff.minute      as off_minute,
    soff.occurred_at as off_at,
    soff.id          as off_id
  from involved i
  join fx on fx.fixture_id = i.fixture_id
  join public.players p on p.id = i.player_id
  left join public.lineups l on l.fixture_id = i.fixture_id and l.player_id = i.player_id
  left join lateral (
    select tl.minute, tl.occurred_at, tl.id from tl
    where tl.fixture_id = i.fixture_id and tl.type = 'substitution' and tl.other_player_id = i.player_id
    order by tl.occurred_at, tl.id limit 1
  ) son on true
  left join lateral (
    select tl.minute, tl.occurred_at, tl.id from tl
    where tl.fixture_id = i.fixture_id and tl.player_id = i.player_id
      and (tl.type = 'substitution' or (tl.type = 'card' and tl.card = 'red'))
    order by tl.occurred_at, tl.id limit 1
  ) soff on true
),
played as (
  select
    b.*,
    (coalesce(b.lineup_role = 'starter', false) or (not b.lineup_set and b.on_id is null)) as started
  from base b
),
appearance as (
  select
    pl.*,
    pl.kicked_off and (pl.started or pl.on_id is not null) as appeared,
    case when pl.started then 0 else pl.on_minute end as from_minute
  from played pl
)
select
  a.fixture_id,
  a.event_id,
  a.matchday_id,
  a.player_id,
  a.team_id,
  a.position,
  a.lineup_role,
  a.lineup_set,
  a.started and a.kicked_off as started,
  a.appeared,
  case
    when a.appeared then greatest(0, coalesce(a.off_minute, a.clock_minute, 0) - coalesce(a.from_minute, 0))
    else 0
  end::integer as minutes_played,
  s.goals,
  s.assists,
  s.own_goals,
  case when a.appeared then s.conceded else 0 end as goals_conceded_on_pitch,
  case when a.appeared then s.own_goals_conceded else 0 end as own_goals_conceded_on_pitch,
  s.yellow_cards,
  s.red_cards,
  s.red_from_second_yellow,
  s.penalties_missed,
  s.penalties_saved,
  s.man_of_the_match,
  a.walkover,
  a.fixture_finished
from appearance a
cross join lateral (
  select
    count(*) filter (where tl.type = 'goal' and not tl.is_own_goal and tl.player_id = a.player_id)::integer as goals,
    count(*) filter (where tl.type = 'goal' and not tl.is_own_goal and tl.other_player_id = a.player_id)::integer as assists,
    count(*) filter (where tl.type = 'goal' and tl.is_own_goal and tl.player_id = a.player_id)::integer as own_goals,
    count(*) filter (
      where tl.type = 'goal' and tl.team_id <> a.team_id
        and (a.started or (tl.occurred_at, tl.id) > (a.on_at, a.on_id))
        and (a.off_id is null or (tl.occurred_at, tl.id) < (a.off_at, a.off_id))
    )::integer as conceded,
    count(*) filter (
      where tl.type = 'goal' and tl.is_own_goal and tl.team_id <> a.team_id
        and (a.started or (tl.occurred_at, tl.id) > (a.on_at, a.on_id))
        and (a.off_id is null or (tl.occurred_at, tl.id) < (a.off_at, a.off_id))
    )::integer as own_goals_conceded,
    count(*) filter (where tl.type = 'card' and tl.card = 'yellow' and tl.player_id = a.player_id)::integer as yellow_cards,
    count(*) filter (where tl.type = 'card' and tl.card = 'red' and tl.player_id = a.player_id)::integer as red_cards,
    coalesce(bool_or(
      tl.type = 'card' and tl.card = 'red' and tl.player_id = a.player_id
      and exists (
        select 1 from tl y
        where y.fixture_id = a.fixture_id and y.type = 'card' and y.card = 'yellow'
          and y.player_id = a.player_id and (y.occurred_at, y.id) < (tl.occurred_at, tl.id)
      )
    ), false) as red_from_second_yellow,
    count(*) filter (where tl.type = 'penalty_miss' and tl.player_id = a.player_id)::integer as penalties_missed,
    count(*) filter (where tl.type = 'penalty_miss' and tl.other_player_id = a.player_id)::integer as penalties_saved,
    coalesce(bool_or(tl.type = 'man_of_the_match' and tl.player_id = a.player_id), false) as man_of_the_match
  from tl
  where tl.fixture_id = a.fixture_id and tl.type <> 'shootout_kick'
) s;

comment on view public.player_match_stats is
  'One row per player per fixture, derived from match_events and lineups. The fantasy engine reads only this. See docs/live-scores.md.';

grant select on public.player_match_stats to anon, authenticated;

-- -----------------------------------------------------------------------------
-- football_standings: the league table per football event
--
-- Counts league-stage fixtures that are live, at half time, at full time or
-- a walkover (the awarded score). Win 3, draw 1, loss 0. Order: points, goal
-- difference, goals scored, then head-to-head among the teams still level
-- (points, then goal difference, then goals in the matches between them).
-- Teams level on everything share a position (position_shared).
-- live: the team is playing now, so its row is provisional.
-- -----------------------------------------------------------------------------
create or replace view public.football_standings
with (security_invoker = true)
as
with lf as (
  select f.id, f.event_id, f.home_team_id, f.away_team_id, f.home_score, f.away_score, f.status
  from public.fixtures f
  join public.events ev on ev.id = f.event_id
  join public.sports s on s.id = ev.sport_id
  where s.slug = 'football' and f.stage = 'league'
    and f.home_team_id is not null and f.away_team_id is not null
),
teams_in as (
  select event_id, home_team_id as team_id from lf
  union
  select event_id, away_team_id from lf
),
counted as (
  select * from lf
  where status in ('live', 'half_time', 'full_time', 'walkover')
    and home_score is not null and away_score is not null
),
res as (
  select event_id, home_team_id as team_id, away_team_id as opponent_id,
         home_score as gf, away_score as ga, status
  from counted
  union all
  select event_id, away_team_id, home_team_id, away_score, home_score, status
  from counted
),
res_pts as (
  select r.*, case when r.gf > r.ga then 3 when r.gf = r.ga then 1 else 0 end as pts
  from res r
),
tot as (
  select
    t.event_id,
    t.team_id,
    count(r.team_id)::integer                          as played,
    count(*) filter (where r.gf > r.ga)::integer       as won,
    count(*) filter (where r.gf = r.ga)::integer       as drawn,
    count(*) filter (where r.gf < r.ga)::integer       as lost,
    coalesce(sum(r.gf), 0)::integer                    as goals_for,
    coalesce(sum(r.ga), 0)::integer                    as goals_against,
    coalesce(sum(r.pts), 0)::integer                   as points,
    coalesce(bool_or(r.status in ('live', 'half_time')), false) as live
  from teams_in t
  left join res_pts r on r.event_id = t.event_id and r.team_id = t.team_id
  group by t.event_id, t.team_id
),
h2h as (
  -- Results only against teams level on points, goal difference and goals.
  select a.event_id, a.team_id,
         sum(r.pts)::integer         as h2h_points,
         sum(r.gf - r.ga)::integer   as h2h_goal_difference,
         sum(r.gf)::integer          as h2h_goals_for
  from tot a
  join res_pts r on r.event_id = a.event_id and r.team_id = a.team_id
  join tot b on b.event_id = a.event_id and b.team_id = r.opponent_id
  where a.points = b.points
    and a.goals_for - a.goals_against = b.goals_for - b.goals_against
    and a.goals_for = b.goals_for
  group by a.event_id, a.team_id
),
ranked as (
  select
    tot.*,
    tot.goals_for - tot.goals_against as goal_difference,
    coalesce(h.h2h_points, 0)          as h2h_points,
    coalesce(h.h2h_goal_difference, 0) as h2h_goal_difference,
    coalesce(h.h2h_goals_for, 0)       as h2h_goals_for,
    rank() over (
      partition by tot.event_id
      order by tot.points desc,
               tot.goals_for - tot.goals_against desc,
               tot.goals_for desc,
               coalesce(h.h2h_points, 0) desc,
               coalesce(h.h2h_goal_difference, 0) desc,
               coalesce(h.h2h_goals_for, 0) desc
    )::integer as position
  from tot
  left join h2h h on h.event_id = tot.event_id and h.team_id = tot.team_id
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
  r.goals_for,
  r.goals_against,
  r.goal_difference,
  r.points,
  r.h2h_points,
  r.live
from ranked r
join public.teams t on t.id = r.team_id;

comment on view public.football_standings is
  'Football league table per event in rulebook order (3/1/0, goal difference, goals scored, head-to-head). Live during play.';

grant select on public.football_standings to anon, authenticated;

-- -----------------------------------------------------------------------------
-- football_player_totals: per player per football event, for top scorers,
-- top assisters, clean sheets and cards. Only players with a row in
-- player_match_stats appear.
-- A clean sheet: a finished match (not a walkover), 30 minutes or more on the
-- pitch and nothing conceded while on it (the PRD's definition).
-- -----------------------------------------------------------------------------
create or replace view public.football_player_totals
with (security_invoker = true)
as
select
  s.event_id,
  s.player_id,
  p.display_name,
  p.position,
  s.team_id,
  t.name       as team_name,
  t.short_name as team_short_name,
  t.year       as team_year,
  count(*) filter (where s.appeared)::integer as appearances,
  sum(s.minutes_played)::integer              as minutes_played,
  sum(s.goals)::integer                       as goals,
  sum(s.assists)::integer                     as assists,
  sum(s.own_goals)::integer                   as own_goals,
  count(*) filter (
    where s.fixture_finished and not s.walkover and s.appeared
      and s.minutes_played >= 30 and s.goals_conceded_on_pitch = 0
  )::integer                                  as clean_sheets,
  sum(s.yellow_cards)::integer                as yellow_cards,
  sum(s.red_cards)::integer                   as red_cards,
  count(*) filter (where s.man_of_the_match)::integer as man_of_the_match
from public.player_match_stats s
join public.events ev on ev.id = s.event_id
join public.sports sp on sp.id = ev.sport_id
join public.players p on p.id = s.player_id
join public.teams t on t.id = s.team_id
where sp.slug = 'football'
group by s.event_id, s.player_id, p.display_name, p.position, s.team_id, t.name, t.short_name, t.year;

grant select on public.football_player_totals to anon, authenticated;

-- -----------------------------------------------------------------------------
-- football_suspensions: a red card means a 1-match ban (rulebook).
-- The ban is served in the team's next fixture in the same event, by kickoff
-- time, not counting cancelled fixtures. banned_fixture_id is null while that
-- fixture isn't known yet (for example a final whose teams aren't filled).
-- Voiding the red card removes the ban.
-- -----------------------------------------------------------------------------
create or replace view public.football_suspensions
with (security_invoker = true)
as
select
  f.event_id,
  e.player_id,
  p.display_name,
  e.team_id,
  t.short_name as team_short_name,
  e.fixture_id as red_card_fixture_id,
  e.id         as red_card_event_id,
  nxt.id       as banned_fixture_id,
  nxt.kickoff_at as banned_fixture_kickoff_at,
  coalesce(nxt.status in ('full_time', 'walkover'), false) as ban_served
from public.match_events e
join public.fixtures f on f.id = e.fixture_id
join public.events ev on ev.id = f.event_id
join public.sports s on s.id = ev.sport_id
join public.players p on p.id = e.player_id
join public.teams t on t.id = e.team_id
left join lateral (
  select n.id, n.kickoff_at, n.status
  from public.fixtures n
  where n.event_id = f.event_id
    and n.id <> f.id
    and n.status <> 'cancelled'
    and n.kickoff_at > f.kickoff_at
    and e.team_id in (n.home_team_id, n.away_team_id)
  order by n.kickoff_at, n.id
  limit 1
) nxt on true
where s.slug = 'football'
  and e.type = 'card' and e.card = 'red' and e.voided_at is null;

grant select on public.football_suspensions to anon, authenticated;

-- -----------------------------------------------------------------------------
-- set_lineup: same as phase 1, plus the 1-match ban. An official can't put a
-- banned player in the lineup; the admin can (for example after an appeal).
-- -----------------------------------------------------------------------------
create or replace function public.set_lineup(
  p_fixture_id uuid,
  p_team_id    uuid,
  p_starters   uuid[],
  p_bench      uuid[] default '{}'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fixture public.fixtures%rowtype;
  v_all     uuid[];
  v_player  uuid;
  v_status  public.player_status;
  v_count   integer;
begin
  v_fixture := public.live_lock_fixture_for_console(p_fixture_id);

  if p_team_id is null
     or (p_team_id is distinct from v_fixture.home_team_id and p_team_id is distinct from v_fixture.away_team_id) then
    perform public.live_fail('live.wrong_team', 'That team isn''t playing in this fixture.');
  end if;
  if v_fixture.status <> 'scheduled' and not public.is_admin() then
    perform public.live_fail('live.lineup_locked', 'Lineups lock at kickoff. Ask the admin to change one.');
  end if;

  p_bench := coalesce(p_bench, '{}');
  if coalesce(cardinality(p_starters), 0) not between 1 and 11 then
    perform public.live_fail('live.invalid_lineup', 'Pick between 1 and 11 starters.');
  end if;

  v_all := p_starters || p_bench;
  if array_position(v_all, null) is not null then
    perform public.live_fail('live.invalid_lineup', 'The lineup has an empty player slot.');
  end if;
  if (select count(distinct x) from unnest(v_all) as x) <> cardinality(v_all) then
    perform public.live_fail('live.invalid_lineup', 'A player appears twice in the lineup.');
  end if;

  foreach v_player in array v_all loop
    perform public.live_check_player(v_player, p_team_id, 'lineup player');
    select status into v_status from public.players where id = v_player;
    if v_status = 'suspended' then
      perform public.live_fail('live.player_suspended', 'A suspended player can''t be in the lineup.');
    end if;
    if not public.is_admin() and exists (
      select 1 from public.football_suspensions b
      where b.player_id = v_player and b.banned_fixture_id = p_fixture_id
    ) then
      perform public.live_fail('live.player_banned',
        'A player sent off in their last match is banned for this one. Ask the admin if the ban was lifted.');
    end if;
  end loop;

  delete from public.lineups where fixture_id = p_fixture_id and team_id = p_team_id;

  insert into public.lineups (fixture_id, team_id, player_id, role, set_by)
  select p_fixture_id, p_team_id, x, 'starter'::public.lineup_role, auth.uid() from unnest(p_starters) as x
  union all
  select p_fixture_id, p_team_id, x, 'bench'::public.lineup_role, auth.uid() from unnest(p_bench) as x;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- fill_football_knockouts: final = 1st v 2nd, third place = 3rd v 4th.
-- Admin only. Every league fixture of the event must be at full time, a
-- walkover or cancelled. Refuses when a tie on every tie-breaker decides who
-- goes where (2nd and 3rd level, or 4th and 5th level): the organisers then
-- decide, and the admin sets those teams by hand.
-- Safe to call again: a fixture that already has the right teams is left
-- alone, and one with match events is never changed.
-- -----------------------------------------------------------------------------
create or replace function public.fill_football_knockouts(p_event_id uuid)
returns setof public.fixtures
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_teams     uuid[];
  v_positions integer[];
  v_fixture   public.fixtures%rowtype;
  v_home      uuid;
  v_away      uuid;
begin
  if auth.uid() is null then
    perform public.live_fail('live.not_signed_in', 'Sign in as the admin to fill the knockout fixtures.');
  end if;
  if not public.is_admin() then
    perform public.live_fail('live.admin_only', 'Only the admin can fill the knockout fixtures.');
  end if;

  if not exists (
    select 1 from public.events ev join public.sports s on s.id = ev.sport_id
    where ev.id = p_event_id and s.slug = 'football'
  ) then
    perform public.live_fail('live.wrong_format', 'That isn''t a football event.');
  end if;

  if exists (
    select 1 from public.fixtures
    where event_id = p_event_id and stage = 'league'
      and status not in ('full_time', 'walkover', 'cancelled')
  ) then
    perform public.live_fail('live.league_not_finished',
      'Every league match must be finished before the final and third-place match can be filled.');
  end if;

  select array_agg(team_id order by position, team_year), array_agg(position order by position, team_year)
  into v_teams, v_positions
  from public.football_standings
  where event_id = p_event_id;

  if coalesce(cardinality(v_teams), 0) < 4 then
    perform public.live_fail('live.invalid_state', 'The league needs at least 4 teams to fill the knockouts.');
  end if;
  if v_positions[2] = v_positions[3] then
    perform public.live_fail('live.standings_tied',
      '2nd and 3rd are level on every tie-breaker. The organisers decide who plays the final; then set the teams by hand.');
  end if;
  if cardinality(v_positions) >= 5 and v_positions[4] = v_positions[5] then
    perform public.live_fail('live.standings_tied',
      '4th and 5th are level on every tie-breaker. The organisers decide who plays the third-place match; then set the teams by hand.');
  end if;

  for v_fixture in
    select * from public.fixtures
    where event_id = p_event_id and stage in ('final', 'third_place')
    order by stage, kickoff_at, id
    for update
  loop
    if v_fixture.stage = 'final' then
      v_home := v_teams[1]; v_away := v_teams[2];
    else
      v_home := v_teams[3]; v_away := v_teams[4];
    end if;

    if (v_fixture.home_team_id, v_fixture.away_team_id) is not distinct from (v_home, v_away) then
      return next v_fixture;
      continue;
    end if;

    if exists (select 1 from public.match_events where fixture_id = v_fixture.id and voided_at is null) then
      perform public.live_fail('live.has_events',
        'A knockout fixture already has match events, so its teams can''t change. Void them first.');
    end if;

    update public.fixtures
    set home_team_id = v_home, away_team_id = v_away
    where id = v_fixture.id
    returning * into v_fixture;
    return next v_fixture;
  end loop;

  if not found then
    perform public.live_fail('live.fixture_not_found', 'This event has no final or third-place fixture.');
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Function permissions (Supabase grants new functions to anon by default).
-- -----------------------------------------------------------------------------
revoke all on function public.set_lineup(uuid, uuid, uuid[], uuid[]) from public, anon;
grant execute on function public.set_lineup(uuid, uuid, uuid[], uuid[]) to authenticated;

revoke all on function public.fill_football_knockouts(uuid) from public, anon;
grant execute on function public.fill_football_knockouts(uuid) to authenticated;

-- The views are read-only for everyone (Supabase grants all by default).
revoke insert, update, delete, truncate on public.player_match_stats     from anon, authenticated;
revoke insert, update, delete, truncate on public.football_standings     from anon, authenticated;
revoke insert, update, delete, truncate on public.football_player_totals from anon, authenticated;
revoke insert, update, delete, truncate on public.football_suspensions   from anon, authenticated;

-- Used by the public views, so readable by everyone. Pure arithmetic.
revoke all on function public.live_period_end_minute(public.match_period, integer, integer) from public;
grant execute on function public.live_period_end_minute(public.match_period, integer, integer) to anon, authenticated;
