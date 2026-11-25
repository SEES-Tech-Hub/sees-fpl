-- =============================================================================
-- SEES Games 2026: every event and fixture from the daily schedule
-- Author: Tayo
-- Source: SEES_GAMES_2026_DAILY_SCHEDULE (updated) and SEES Triumph 2026
-- Fixtures by Sport, 25 Nov. Needs 20261125075848_live_boards_players_legs.
--
-- What this does
--   * Events: women's football; Mortal Kombat, badminton and table tennis
--     split into their categories; lawn tennis singles; the five swimming
--     races; the athletics distances and relays. The seeded one-per-sport
--     events are renamed to the first category, so nothing is lost.
--   * Board games: boards per match (chess 1, the rest 2) and tables ranked
--     by board points.
--   * Men's football: the confirmed kickoffs (round 1 now 7:30 and 8:45 am,
--     Year 2 hosting Year 1) and the fantasy deadlines (MD1: 7:00 am Sat).
--   * Fixtures for every other sport with times, stages and venues. Matches
--     whose sides come from earlier results or a draw start empty; the admin
--     fills them (Admin → Fixtures, or Fill knockouts for the group sports).
--     Table tennis singles groups come once the organisers draw them.
--   * Athletics finals on Wed 9 Dec are at 1:00 pm until times are confirmed.
--
-- Safe to run twice.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Events
-- -----------------------------------------------------------------------------
-- The seeded one-per-sport events become the first event of their sport.
update public.events ev set slug = 'mortal-kombat-women', name = 'Mortal Kombat (women)'
from public.sports s
where s.id = ev.sport_id and s.slug = 'mortal-kombat' and ev.slug = 'mortal-kombat'
  and not exists (select 1 from public.events x where x.sport_id = ev.sport_id and x.slug = 'mortal-kombat-women');
update public.events ev set slug = 'badminton-men', name = 'Badminton (men)'
from public.sports s
where s.id = ev.sport_id and s.slug = 'badminton' and ev.slug = 'badminton'
  and not exists (select 1 from public.events x where x.sport_id = ev.sport_id and x.slug = 'badminton-men');
update public.events ev set slug = 'table-tennis-mens-singles', name = 'Men''s singles'
from public.sports s
where s.id = ev.sport_id and s.slug = 'table-tennis' and ev.slug = 'table-tennis'
  and not exists (select 1 from public.events x where x.sport_id = ev.sport_id and x.slug = 'table-tennis-mens-singles');
update public.events ev set slug = 'lawn-tennis-singles', name = 'Singles'
from public.sports s
where s.id = ev.sport_id and s.slug = 'lawn-tennis' and ev.slug = 'lawn-tennis'
  and not exists (select 1 from public.events x where x.sport_id = ev.sport_id and x.slug = 'lawn-tennis-singles');
update public.events ev set slug = 'swimming-female-25m-freestyle', name = 'Female 25m freestyle'
from public.sports s
where s.id = ev.sport_id and s.slug = 'swimming' and ev.slug = 'swimming'
  and not exists (select 1 from public.events x where x.sport_id = ev.sport_id and x.slug = 'swimming-female-25m-freestyle');
update public.events ev set slug = 'athletics-100m', name = '100m'
from public.sports s
where s.id = ev.sport_id and s.slug = 'athletics' and ev.slug = 'athletics'
  and not exists (select 1 from public.events x where x.sport_id = ev.sport_id and x.slug = 'athletics-100m');

-- New events copy their rules (periods, sets, points, heats) from a sibling.
insert into public.events (sport_id, slug, name, period_minutes, period_count, extra_period_minutes, sets_to_win, set_points, final_set_points, set_win_by, set_points_cap, win_points, draw_points, loss_points, qualifiers_per_heat, boards, rank_by_score)
select t.sport_id, 'football-women', 'Football (women)', t.period_minutes, t.period_count, t.extra_period_minutes, t.sets_to_win, t.set_points, t.final_set_points, t.set_win_by, t.set_points_cap, t.win_points, t.draw_points, t.loss_points, t.qualifiers_per_heat, t.boards, t.rank_by_score
from public.events t
where t.slug = 'football-men'
on conflict (sport_id, slug) do nothing;
insert into public.events (sport_id, slug, name, period_minutes, period_count, extra_period_minutes, sets_to_win, set_points, final_set_points, set_win_by, set_points_cap, win_points, draw_points, loss_points, qualifiers_per_heat, boards, rank_by_score)
select t.sport_id, 'mortal-kombat-men', 'Mortal Kombat (men)', t.period_minutes, t.period_count, t.extra_period_minutes, t.sets_to_win, t.set_points, t.final_set_points, t.set_win_by, t.set_points_cap, t.win_points, t.draw_points, t.loss_points, t.qualifiers_per_heat, t.boards, t.rank_by_score
from public.events t
where t.slug = 'mortal-kombat-women'
on conflict (sport_id, slug) do nothing;
insert into public.events (sport_id, slug, name, period_minutes, period_count, extra_period_minutes, sets_to_win, set_points, final_set_points, set_win_by, set_points_cap, win_points, draw_points, loss_points, qualifiers_per_heat, boards, rank_by_score)
select t.sport_id, 'badminton-women', 'Badminton (women)', t.period_minutes, t.period_count, t.extra_period_minutes, t.sets_to_win, t.set_points, t.final_set_points, t.set_win_by, t.set_points_cap, t.win_points, t.draw_points, t.loss_points, t.qualifiers_per_heat, t.boards, t.rank_by_score
from public.events t
where t.slug = 'badminton-men'
on conflict (sport_id, slug) do nothing;
insert into public.events (sport_id, slug, name, period_minutes, period_count, extra_period_minutes, sets_to_win, set_points, final_set_points, set_win_by, set_points_cap, win_points, draw_points, loss_points, qualifiers_per_heat, boards, rank_by_score)
select t.sport_id, 'table-tennis-womens-singles', 'Women''s singles', t.period_minutes, t.period_count, t.extra_period_minutes, t.sets_to_win, t.set_points, t.final_set_points, t.set_win_by, t.set_points_cap, t.win_points, t.draw_points, t.loss_points, t.qualifiers_per_heat, t.boards, t.rank_by_score
from public.events t
where t.slug = 'table-tennis-mens-singles'
on conflict (sport_id, slug) do nothing;
insert into public.events (sport_id, slug, name, period_minutes, period_count, extra_period_minutes, sets_to_win, set_points, final_set_points, set_win_by, set_points_cap, win_points, draw_points, loss_points, qualifiers_per_heat, boards, rank_by_score)
select t.sport_id, 'table-tennis-mixed-doubles', 'Mixed doubles', t.period_minutes, t.period_count, t.extra_period_minutes, t.sets_to_win, t.set_points, t.final_set_points, t.set_win_by, t.set_points_cap, t.win_points, t.draw_points, t.loss_points, t.qualifiers_per_heat, t.boards, t.rank_by_score
from public.events t
where t.slug = 'table-tennis-mens-singles'
on conflict (sport_id, slug) do nothing;
insert into public.events (sport_id, slug, name, period_minutes, period_count, extra_period_minutes, sets_to_win, set_points, final_set_points, set_win_by, set_points_cap, win_points, draw_points, loss_points, qualifiers_per_heat, boards, rank_by_score)
select t.sport_id, 'swimming-male-25m-freestyle', 'Male 25m freestyle', t.period_minutes, t.period_count, t.extra_period_minutes, t.sets_to_win, t.set_points, t.final_set_points, t.set_win_by, t.set_points_cap, t.win_points, t.draw_points, t.loss_points, t.qualifiers_per_heat, t.boards, t.rank_by_score
from public.events t
where t.slug = 'swimming-female-25m-freestyle'
on conflict (sport_id, slug) do nothing;
insert into public.events (sport_id, slug, name, period_minutes, period_count, extra_period_minutes, sets_to_win, set_points, final_set_points, set_win_by, set_points_cap, win_points, draw_points, loss_points, qualifiers_per_heat, boards, rank_by_score)
select t.sport_id, 'swimming-female-50m-relay', 'Female 50m relay (2×25m)', t.period_minutes, t.period_count, t.extra_period_minutes, t.sets_to_win, t.set_points, t.final_set_points, t.set_win_by, t.set_points_cap, t.win_points, t.draw_points, t.loss_points, t.qualifiers_per_heat, t.boards, t.rank_by_score
from public.events t
where t.slug = 'swimming-female-25m-freestyle'
on conflict (sport_id, slug) do nothing;
insert into public.events (sport_id, slug, name, period_minutes, period_count, extra_period_minutes, sets_to_win, set_points, final_set_points, set_win_by, set_points_cap, win_points, draw_points, loss_points, qualifiers_per_heat, boards, rank_by_score)
select t.sport_id, 'swimming-male-50m-relay', 'Male 50m relay (2×25m)', t.period_minutes, t.period_count, t.extra_period_minutes, t.sets_to_win, t.set_points, t.final_set_points, t.set_win_by, t.set_points_cap, t.win_points, t.draw_points, t.loss_points, t.qualifiers_per_heat, t.boards, t.rank_by_score
from public.events t
where t.slug = 'swimming-female-25m-freestyle'
on conflict (sport_id, slug) do nothing;
insert into public.events (sport_id, slug, name, period_minutes, period_count, extra_period_minutes, sets_to_win, set_points, final_set_points, set_win_by, set_points_cap, win_points, draw_points, loss_points, qualifiers_per_heat, boards, rank_by_score)
select t.sport_id, 'swimming-mixed-100m-relay', 'Mixed 100m relay (4×25m)', t.period_minutes, t.period_count, t.extra_period_minutes, t.sets_to_win, t.set_points, t.final_set_points, t.set_win_by, t.set_points_cap, t.win_points, t.draw_points, t.loss_points, t.qualifiers_per_heat, t.boards, t.rank_by_score
from public.events t
where t.slug = 'swimming-female-25m-freestyle'
on conflict (sport_id, slug) do nothing;
insert into public.events (sport_id, slug, name, period_minutes, period_count, extra_period_minutes, sets_to_win, set_points, final_set_points, set_win_by, set_points_cap, win_points, draw_points, loss_points, qualifiers_per_heat, boards, rank_by_score)
select t.sport_id, 'athletics-200m', '200m', t.period_minutes, t.period_count, t.extra_period_minutes, t.sets_to_win, t.set_points, t.final_set_points, t.set_win_by, t.set_points_cap, t.win_points, t.draw_points, t.loss_points, t.qualifiers_per_heat, t.boards, t.rank_by_score
from public.events t
where t.slug = 'athletics-100m'
on conflict (sport_id, slug) do nothing;
insert into public.events (sport_id, slug, name, period_minutes, period_count, extra_period_minutes, sets_to_win, set_points, final_set_points, set_win_by, set_points_cap, win_points, draw_points, loss_points, qualifiers_per_heat, boards, rank_by_score)
select t.sport_id, 'athletics-400m', '400m', t.period_minutes, t.period_count, t.extra_period_minutes, t.sets_to_win, t.set_points, t.final_set_points, t.set_win_by, t.set_points_cap, t.win_points, t.draw_points, t.loss_points, t.qualifiers_per_heat, t.boards, t.rank_by_score
from public.events t
where t.slug = 'athletics-100m'
on conflict (sport_id, slug) do nothing;
insert into public.events (sport_id, slug, name, period_minutes, period_count, extra_period_minutes, sets_to_win, set_points, final_set_points, set_win_by, set_points_cap, win_points, draw_points, loss_points, qualifiers_per_heat, boards, rank_by_score)
select t.sport_id, 'athletics-800m', '800m', t.period_minutes, t.period_count, t.extra_period_minutes, t.sets_to_win, t.set_points, t.final_set_points, t.set_win_by, t.set_points_cap, t.win_points, t.draw_points, t.loss_points, t.qualifiers_per_heat, t.boards, t.rank_by_score
from public.events t
where t.slug = 'athletics-100m'
on conflict (sport_id, slug) do nothing;
insert into public.events (sport_id, slug, name, period_minutes, period_count, extra_period_minutes, sets_to_win, set_points, final_set_points, set_win_by, set_points_cap, win_points, draw_points, loss_points, qualifiers_per_heat, boards, rank_by_score)
select t.sport_id, 'athletics-1500m', '1500m', t.period_minutes, t.period_count, t.extra_period_minutes, t.sets_to_win, t.set_points, t.final_set_points, t.set_win_by, t.set_points_cap, t.win_points, t.draw_points, t.loss_points, t.qualifiers_per_heat, t.boards, t.rank_by_score
from public.events t
where t.slug = 'athletics-100m'
on conflict (sport_id, slug) do nothing;
insert into public.events (sport_id, slug, name, period_minutes, period_count, extra_period_minutes, sets_to_win, set_points, final_set_points, set_win_by, set_points_cap, win_points, draw_points, loss_points, qualifiers_per_heat, boards, rank_by_score)
select t.sport_id, 'athletics-4x100m-relay-mixed', '4×100m relay (mixed)', t.period_minutes, t.period_count, t.extra_period_minutes, t.sets_to_win, t.set_points, t.final_set_points, t.set_win_by, t.set_points_cap, t.win_points, t.draw_points, t.loss_points, t.qualifiers_per_heat, t.boards, t.rank_by_score
from public.events t
where t.slug = 'athletics-100m'
on conflict (sport_id, slug) do nothing;
insert into public.events (sport_id, slug, name, period_minutes, period_count, extra_period_minutes, sets_to_win, set_points, final_set_points, set_win_by, set_points_cap, win_points, draw_points, loss_points, qualifiers_per_heat, boards, rank_by_score)
select t.sport_id, 'athletics-4x100m-relay-men', '4×100m relay (men)', t.period_minutes, t.period_count, t.extra_period_minutes, t.sets_to_win, t.set_points, t.final_set_points, t.set_win_by, t.set_points_cap, t.win_points, t.draw_points, t.loss_points, t.qualifiers_per_heat, t.boards, t.rank_by_score
from public.events t
where t.slug = 'athletics-100m'
on conflict (sport_id, slug) do nothing;

-- Board games: boards per match and the table by board points. Chess is one
-- board (each year's man or woman); the other games are two boards.
update public.events ev set
  boards        = case when ev.slug in ('board-games-chess-men', 'board-games-chess-women') then 1 else 2 end,
  rank_by_score = true
from public.sports s
where s.id = ev.sport_id and s.slug = 'board-games';

-- -----------------------------------------------------------------------------
-- Men's football: confirmed kickoffs (Year 2 hosts Year 1 in round 1) and the
-- fantasy deadlines, 30 minutes before each matchday's first kickoff.
-- -----------------------------------------------------------------------------
with plan (matchday, slot, home_year, away_year, kickoff) as (
  values
    (1, 1, 5, 3, timestamptz '2026-11-28 07:30 Africa/Lagos'),
    (1, 2, 2, 1, timestamptz '2026-11-28 08:45 Africa/Lagos'),
    (2, 1, 1, 4, timestamptz '2026-11-30 15:00 Africa/Lagos'),
    (2, 2, 5, 2, timestamptz '2026-11-30 16:00 Africa/Lagos'),
    (3, 1, 2, 4, timestamptz '2026-12-02 11:30 Africa/Lagos'),
    (3, 2, 3, 1, timestamptz '2026-12-02 12:30 Africa/Lagos'),
    (4, 1, 5, 1, timestamptz '2026-12-04 08:00 Africa/Lagos'),
    (4, 2, 4, 3, timestamptz '2026-12-04 09:00 Africa/Lagos'),
    (5, 1, 2, 3, timestamptz '2026-12-06 10:00 Africa/Lagos'),
    (5, 2, 5, 4, timestamptz '2026-12-06 11:00 Africa/Lagos')
),
current as (
  select f.id, md.number as matchday,
         row_number() over (partition by md.number order by f.kickoff_at, f.id) as slot
  from public.fixtures f
  join public.matchdays md on md.id = f.matchday_id
  join public.events ev on ev.id = f.event_id
  where ev.slug = 'football-men' and f.stage = 'league'
)
update public.fixtures f set
  home_team_id = home.id,
  away_team_id = away.id,
  kickoff_at   = p.kickoff,
  venue        = 'UNILAG Sports Centre'
from current c
join plan p on p.matchday = c.matchday and p.slot = c.slot
join public.teams home on home.year = p.home_year
join public.teams away on away.year = p.away_year
where f.id = c.id
  and f.status = 'scheduled'
  and not exists (select 1 from public.match_events me where me.fixture_id = f.id);

update public.fixtures f set venue = 'UNILAG Sports Centre'
from public.events ev
where ev.id = f.event_id and ev.slug = 'football-men' and f.venue is null;

update public.matchdays md set deadline_at = first.kickoff_at - interval '30 minutes'
from (
  select matchday_id, min(kickoff_at) as kickoff_at
  from public.fixtures
  where matchday_id is not null and kickoff_at is not null
  group by matchday_id
) as first
where first.matchday_id = md.id
  and (md.deadline_at is null or md.deadline_at > now());

-- -----------------------------------------------------------------------------
-- Fixtures for every other sport (201 in all). A fixture already there
-- (same event, stage, tie, leg and teams) is left alone. Teams that depend on
-- earlier results or draws are empty until the admin fills them.
-- -----------------------------------------------------------------------------
insert into public.fixtures (event_id, tie, leg, stage, kickoff_at, home_team_id, away_team_id, venue)
select e.id, v.tie, v.leg, v.stage, v.kickoff_at, h.id, a.id, v.venue
from (values
    ('board-games-chess-men', null, null::smallint, 'group', timestamptz '2026-11-28 12:00 Africa/Lagos', 1::smallint, 2::smallint, 'Engineering Quadrangle'),
    ('board-games-chess-men', null, null::smallint, 'group', timestamptz '2026-11-28 12:00 Africa/Lagos', 3::smallint, 4::smallint, 'Engineering Quadrangle'),
    ('board-games-chess-men', null, null::smallint, 'group', timestamptz '2026-11-28 13:30 Africa/Lagos', 1::smallint, 3::smallint, 'Engineering Quadrangle'),
    ('board-games-chess-men', null, null::smallint, 'group', timestamptz '2026-11-28 13:30 Africa/Lagos', 2::smallint, 5::smallint, 'Engineering Quadrangle'),
    ('board-games-chess-men', null, null::smallint, 'group', timestamptz '2026-11-28 15:00 Africa/Lagos', 1::smallint, 4::smallint, 'Engineering Quadrangle'),
    ('board-games-chess-men', null, null::smallint, 'group', timestamptz '2026-11-28 15:00 Africa/Lagos', 3::smallint, 5::smallint, 'Engineering Quadrangle'),
    ('board-games-chess-men', null, null::smallint, 'group', timestamptz '2026-11-28 16:30 Africa/Lagos', 2::smallint, 4::smallint, 'Engineering Quadrangle'),
    ('board-games-chess-men', null, null::smallint, 'group', timestamptz '2026-11-28 16:30 Africa/Lagos', 1::smallint, 5::smallint, 'Engineering Quadrangle'),
    ('board-games-chess-men', null, null::smallint, 'group', timestamptz '2026-11-28 18:00 Africa/Lagos', 2::smallint, 3::smallint, 'Engineering Quadrangle'),
    ('board-games-chess-men', null, null::smallint, 'group', timestamptz '2026-11-28 18:00 Africa/Lagos', 4::smallint, 5::smallint, 'Engineering Quadrangle'),
    ('board-games-chess-women', null, null::smallint, 'group', timestamptz '2026-11-28 12:00 Africa/Lagos', 1::smallint, 2::smallint, 'Engineering Quadrangle'),
    ('board-games-chess-women', null, null::smallint, 'group', timestamptz '2026-11-28 12:00 Africa/Lagos', 3::smallint, 4::smallint, 'Engineering Quadrangle'),
    ('board-games-chess-women', null, null::smallint, 'group', timestamptz '2026-11-28 13:30 Africa/Lagos', 1::smallint, 3::smallint, 'Engineering Quadrangle'),
    ('board-games-chess-women', null, null::smallint, 'group', timestamptz '2026-11-28 13:30 Africa/Lagos', 2::smallint, 5::smallint, 'Engineering Quadrangle'),
    ('board-games-chess-women', null, null::smallint, 'group', timestamptz '2026-11-28 15:00 Africa/Lagos', 1::smallint, 4::smallint, 'Engineering Quadrangle'),
    ('board-games-chess-women', null, null::smallint, 'group', timestamptz '2026-11-28 15:00 Africa/Lagos', 3::smallint, 5::smallint, 'Engineering Quadrangle'),
    ('board-games-chess-women', null, null::smallint, 'group', timestamptz '2026-11-28 16:30 Africa/Lagos', 2::smallint, 4::smallint, 'Engineering Quadrangle'),
    ('board-games-chess-women', null, null::smallint, 'group', timestamptz '2026-11-28 16:30 Africa/Lagos', 1::smallint, 5::smallint, 'Engineering Quadrangle'),
    ('board-games-chess-women', null, null::smallint, 'group', timestamptz '2026-11-28 18:00 Africa/Lagos', 2::smallint, 3::smallint, 'Engineering Quadrangle'),
    ('board-games-chess-women', null, null::smallint, 'group', timestamptz '2026-11-28 18:00 Africa/Lagos', 4::smallint, 5::smallint, 'Engineering Quadrangle'),
    ('board-games-scrabble', null, null::smallint, 'group', timestamptz '2026-11-28 12:00 Africa/Lagos', 1::smallint, 2::smallint, 'Engineering Quadrangle'),
    ('board-games-scrabble', null, null::smallint, 'group', timestamptz '2026-11-28 12:00 Africa/Lagos', 3::smallint, 4::smallint, 'Engineering Quadrangle'),
    ('board-games-scrabble', null, null::smallint, 'group', timestamptz '2026-11-28 13:30 Africa/Lagos', 1::smallint, 3::smallint, 'Engineering Quadrangle'),
    ('board-games-scrabble', null, null::smallint, 'group', timestamptz '2026-11-28 13:30 Africa/Lagos', 2::smallint, 5::smallint, 'Engineering Quadrangle'),
    ('board-games-scrabble', null, null::smallint, 'group', timestamptz '2026-11-28 15:00 Africa/Lagos', 1::smallint, 4::smallint, 'Engineering Quadrangle'),
    ('board-games-scrabble', null, null::smallint, 'group', timestamptz '2026-11-28 15:00 Africa/Lagos', 3::smallint, 5::smallint, 'Engineering Quadrangle'),
    ('board-games-scrabble', null, null::smallint, 'group', timestamptz '2026-11-28 16:30 Africa/Lagos', 2::smallint, 4::smallint, 'Engineering Quadrangle'),
    ('board-games-scrabble', null, null::smallint, 'group', timestamptz '2026-11-28 16:30 Africa/Lagos', 1::smallint, 5::smallint, 'Engineering Quadrangle'),
    ('board-games-scrabble', null, null::smallint, 'group', timestamptz '2026-11-28 18:00 Africa/Lagos', 2::smallint, 3::smallint, 'Engineering Quadrangle'),
    ('board-games-scrabble', null, null::smallint, 'group', timestamptz '2026-11-28 18:00 Africa/Lagos', 4::smallint, 5::smallint, 'Engineering Quadrangle'),
    ('board-games-ludo', null, null::smallint, 'group', timestamptz '2026-11-28 12:00 Africa/Lagos', 1::smallint, 2::smallint, 'Engineering Quadrangle'),
    ('board-games-ludo', null, null::smallint, 'group', timestamptz '2026-11-28 12:00 Africa/Lagos', 3::smallint, 4::smallint, 'Engineering Quadrangle'),
    ('board-games-ludo', null, null::smallint, 'group', timestamptz '2026-11-28 13:30 Africa/Lagos', 1::smallint, 3::smallint, 'Engineering Quadrangle'),
    ('board-games-ludo', null, null::smallint, 'group', timestamptz '2026-11-28 13:30 Africa/Lagos', 2::smallint, 5::smallint, 'Engineering Quadrangle'),
    ('board-games-ludo', null, null::smallint, 'group', timestamptz '2026-11-28 15:00 Africa/Lagos', 1::smallint, 4::smallint, 'Engineering Quadrangle'),
    ('board-games-ludo', null, null::smallint, 'group', timestamptz '2026-11-28 15:00 Africa/Lagos', 3::smallint, 5::smallint, 'Engineering Quadrangle'),
    ('board-games-ludo', null, null::smallint, 'group', timestamptz '2026-11-28 16:30 Africa/Lagos', 2::smallint, 4::smallint, 'Engineering Quadrangle'),
    ('board-games-ludo', null, null::smallint, 'group', timestamptz '2026-11-28 16:30 Africa/Lagos', 1::smallint, 5::smallint, 'Engineering Quadrangle'),
    ('board-games-ludo', null, null::smallint, 'group', timestamptz '2026-11-28 18:00 Africa/Lagos', 2::smallint, 3::smallint, 'Engineering Quadrangle'),
    ('board-games-ludo', null, null::smallint, 'group', timestamptz '2026-11-28 18:00 Africa/Lagos', 4::smallint, 5::smallint, 'Engineering Quadrangle'),
    ('board-games-draughts', null, null::smallint, 'group', timestamptz '2026-11-28 12:00 Africa/Lagos', 1::smallint, 2::smallint, 'Engineering Quadrangle'),
    ('board-games-draughts', null, null::smallint, 'group', timestamptz '2026-11-28 12:00 Africa/Lagos', 3::smallint, 4::smallint, 'Engineering Quadrangle'),
    ('board-games-draughts', null, null::smallint, 'group', timestamptz '2026-11-28 13:30 Africa/Lagos', 1::smallint, 3::smallint, 'Engineering Quadrangle'),
    ('board-games-draughts', null, null::smallint, 'group', timestamptz '2026-11-28 13:30 Africa/Lagos', 2::smallint, 5::smallint, 'Engineering Quadrangle'),
    ('board-games-draughts', null, null::smallint, 'group', timestamptz '2026-11-28 15:00 Africa/Lagos', 1::smallint, 4::smallint, 'Engineering Quadrangle'),
    ('board-games-draughts', null, null::smallint, 'group', timestamptz '2026-11-28 15:00 Africa/Lagos', 3::smallint, 5::smallint, 'Engineering Quadrangle'),
    ('board-games-draughts', null, null::smallint, 'group', timestamptz '2026-11-28 16:30 Africa/Lagos', 2::smallint, 4::smallint, 'Engineering Quadrangle'),
    ('board-games-draughts', null, null::smallint, 'group', timestamptz '2026-11-28 16:30 Africa/Lagos', 1::smallint, 5::smallint, 'Engineering Quadrangle'),
    ('board-games-draughts', null, null::smallint, 'group', timestamptz '2026-11-28 18:00 Africa/Lagos', 2::smallint, 3::smallint, 'Engineering Quadrangle'),
    ('board-games-draughts', null, null::smallint, 'group', timestamptz '2026-11-28 18:00 Africa/Lagos', 4::smallint, 5::smallint, 'Engineering Quadrangle'),
    ('board-games-connect-four', null, null::smallint, 'group', timestamptz '2026-11-28 12:00 Africa/Lagos', 1::smallint, 2::smallint, 'Engineering Quadrangle'),
    ('board-games-connect-four', null, null::smallint, 'group', timestamptz '2026-11-28 12:00 Africa/Lagos', 3::smallint, 4::smallint, 'Engineering Quadrangle'),
    ('board-games-connect-four', null, null::smallint, 'group', timestamptz '2026-11-28 13:30 Africa/Lagos', 1::smallint, 3::smallint, 'Engineering Quadrangle'),
    ('board-games-connect-four', null, null::smallint, 'group', timestamptz '2026-11-28 13:30 Africa/Lagos', 2::smallint, 5::smallint, 'Engineering Quadrangle'),
    ('board-games-connect-four', null, null::smallint, 'group', timestamptz '2026-11-28 15:00 Africa/Lagos', 1::smallint, 4::smallint, 'Engineering Quadrangle'),
    ('board-games-connect-four', null, null::smallint, 'group', timestamptz '2026-11-28 15:00 Africa/Lagos', 3::smallint, 5::smallint, 'Engineering Quadrangle'),
    ('board-games-connect-four', null, null::smallint, 'group', timestamptz '2026-11-28 16:30 Africa/Lagos', 2::smallint, 4::smallint, 'Engineering Quadrangle'),
    ('board-games-connect-four', null, null::smallint, 'group', timestamptz '2026-11-28 16:30 Africa/Lagos', 1::smallint, 5::smallint, 'Engineering Quadrangle'),
    ('board-games-connect-four', null, null::smallint, 'group', timestamptz '2026-11-28 18:00 Africa/Lagos', 2::smallint, 3::smallint, 'Engineering Quadrangle'),
    ('board-games-connect-four', null, null::smallint, 'group', timestamptz '2026-11-28 18:00 Africa/Lagos', 4::smallint, 5::smallint, 'Engineering Quadrangle'),
    ('mortal-kombat-women', 'M1', null::smallint, 'eliminator', timestamptz '2026-11-28 12:30 Africa/Lagos', 1::smallint, 2::smallint, 'Engineering Quadrangle'),
    ('mortal-kombat-women', 'M2', null::smallint, 'semi_final', timestamptz '2026-11-28 12:50 Africa/Lagos', null::smallint, 3::smallint, 'Engineering Quadrangle'),
    ('mortal-kombat-women', 'M3', null::smallint, 'semi_final', timestamptz '2026-11-28 13:10 Africa/Lagos', 4::smallint, 5::smallint, 'Engineering Quadrangle'),
    ('mortal-kombat-women', 'M4', null::smallint, 'third_place', timestamptz '2026-11-28 13:30 Africa/Lagos', null::smallint, null::smallint, 'Engineering Quadrangle'),
    ('mortal-kombat-women', 'M5', null::smallint, 'final', timestamptz '2026-11-28 14:00 Africa/Lagos', null::smallint, null::smallint, 'Engineering Quadrangle'),
    ('mortal-kombat-men', 'M1', null::smallint, 'eliminator', timestamptz '2026-11-28 14:30 Africa/Lagos', 1::smallint, 2::smallint, 'Engineering Quadrangle'),
    ('mortal-kombat-men', 'M2', null::smallint, 'semi_final', timestamptz '2026-11-28 14:50 Africa/Lagos', null::smallint, 3::smallint, 'Engineering Quadrangle'),
    ('mortal-kombat-men', 'M3', null::smallint, 'semi_final', timestamptz '2026-11-28 15:10 Africa/Lagos', 4::smallint, 5::smallint, 'Engineering Quadrangle'),
    ('mortal-kombat-men', 'M4', null::smallint, 'third_place', timestamptz '2026-11-28 15:30 Africa/Lagos', null::smallint, null::smallint, 'Engineering Quadrangle'),
    ('mortal-kombat-men', 'M5', null::smallint, 'final', timestamptz '2026-11-28 16:00 Africa/Lagos', null::smallint, null::smallint, 'Engineering Quadrangle'),
    ('mobile-games-ea-fc', 'P1', 1::smallint, 'eliminator', timestamptz '2026-11-28 13:00 Africa/Lagos', null::smallint, null::smallint, 'Engineering Quadrangle'),
    ('mobile-games-ea-fc', 'P1', 2::smallint, 'eliminator', timestamptz '2026-11-28 13:00 Africa/Lagos', null::smallint, null::smallint, 'Engineering Quadrangle'),
    ('mobile-games-ea-fc', 'P2', 1::smallint, 'eliminator', timestamptz '2026-11-28 13:00 Africa/Lagos', null::smallint, null::smallint, 'Engineering Quadrangle'),
    ('mobile-games-ea-fc', 'P2', 2::smallint, 'eliminator', timestamptz '2026-11-28 13:00 Africa/Lagos', null::smallint, null::smallint, 'Engineering Quadrangle'),
    ('mobile-games-ea-fc', 'QF1', 1::smallint, 'quarter_final', timestamptz '2026-11-28 13:30 Africa/Lagos', null::smallint, null::smallint, 'Engineering Quadrangle'),
    ('mobile-games-ea-fc', 'QF1', 2::smallint, 'quarter_final', timestamptz '2026-11-28 13:30 Africa/Lagos', null::smallint, null::smallint, 'Engineering Quadrangle'),
    ('mobile-games-ea-fc', 'QF2', 1::smallint, 'quarter_final', timestamptz '2026-11-28 13:30 Africa/Lagos', null::smallint, null::smallint, 'Engineering Quadrangle'),
    ('mobile-games-ea-fc', 'QF2', 2::smallint, 'quarter_final', timestamptz '2026-11-28 13:30 Africa/Lagos', null::smallint, null::smallint, 'Engineering Quadrangle'),
    ('mobile-games-ea-fc', 'QF3', 1::smallint, 'quarter_final', timestamptz '2026-11-28 13:30 Africa/Lagos', null::smallint, null::smallint, 'Engineering Quadrangle'),
    ('mobile-games-ea-fc', 'QF3', 2::smallint, 'quarter_final', timestamptz '2026-11-28 13:30 Africa/Lagos', null::smallint, null::smallint, 'Engineering Quadrangle'),
    ('mobile-games-ea-fc', 'QF4', 1::smallint, 'quarter_final', timestamptz '2026-11-28 13:30 Africa/Lagos', null::smallint, null::smallint, 'Engineering Quadrangle'),
    ('mobile-games-ea-fc', 'QF4', 2::smallint, 'quarter_final', timestamptz '2026-11-28 13:30 Africa/Lagos', null::smallint, null::smallint, 'Engineering Quadrangle'),
    ('mobile-games-ea-fc', 'SF1', 1::smallint, 'semi_final', timestamptz '2026-11-28 14:30 Africa/Lagos', null::smallint, null::smallint, 'Engineering Quadrangle'),
    ('mobile-games-ea-fc', 'SF1', 2::smallint, 'semi_final', timestamptz '2026-11-28 14:30 Africa/Lagos', null::smallint, null::smallint, 'Engineering Quadrangle'),
    ('mobile-games-ea-fc', 'SF2', 1::smallint, 'semi_final', timestamptz '2026-11-28 14:30 Africa/Lagos', null::smallint, null::smallint, 'Engineering Quadrangle'),
    ('mobile-games-ea-fc', 'SF2', 2::smallint, 'semi_final', timestamptz '2026-11-28 14:30 Africa/Lagos', null::smallint, null::smallint, 'Engineering Quadrangle'),
    ('mobile-games-ea-fc', '3rd', null::smallint, 'third_place', timestamptz '2026-11-28 15:30 Africa/Lagos', null::smallint, null::smallint, 'Engineering Quadrangle'),
    ('mobile-games-ea-fc', 'Final', null::smallint, 'final', timestamptz '2026-11-28 15:30 Africa/Lagos', null::smallint, null::smallint, 'Engineering Quadrangle'),
    ('mobile-games-efootball', 'P1', 1::smallint, 'eliminator', timestamptz '2026-11-29 13:00 Africa/Lagos', null::smallint, null::smallint, 'Online'),
    ('mobile-games-efootball', 'P1', 2::smallint, 'eliminator', timestamptz '2026-11-29 13:00 Africa/Lagos', null::smallint, null::smallint, 'Online'),
    ('mobile-games-efootball', 'P2', 1::smallint, 'eliminator', timestamptz '2026-11-29 13:00 Africa/Lagos', null::smallint, null::smallint, 'Online'),
    ('mobile-games-efootball', 'P2', 2::smallint, 'eliminator', timestamptz '2026-11-29 13:00 Africa/Lagos', null::smallint, null::smallint, 'Online'),
    ('mobile-games-efootball', 'QF1', 1::smallint, 'quarter_final', timestamptz '2026-11-29 13:30 Africa/Lagos', null::smallint, null::smallint, 'Online'),
    ('mobile-games-efootball', 'QF1', 2::smallint, 'quarter_final', timestamptz '2026-11-29 13:30 Africa/Lagos', null::smallint, null::smallint, 'Online'),
    ('mobile-games-efootball', 'QF2', 1::smallint, 'quarter_final', timestamptz '2026-11-29 13:30 Africa/Lagos', null::smallint, null::smallint, 'Online'),
    ('mobile-games-efootball', 'QF2', 2::smallint, 'quarter_final', timestamptz '2026-11-29 13:30 Africa/Lagos', null::smallint, null::smallint, 'Online'),
    ('mobile-games-efootball', 'QF3', 1::smallint, 'quarter_final', timestamptz '2026-11-29 13:30 Africa/Lagos', null::smallint, null::smallint, 'Online'),
    ('mobile-games-efootball', 'QF3', 2::smallint, 'quarter_final', timestamptz '2026-11-29 13:30 Africa/Lagos', null::smallint, null::smallint, 'Online'),
    ('mobile-games-efootball', 'QF4', 1::smallint, 'quarter_final', timestamptz '2026-11-29 13:30 Africa/Lagos', null::smallint, null::smallint, 'Online'),
    ('mobile-games-efootball', 'QF4', 2::smallint, 'quarter_final', timestamptz '2026-11-29 13:30 Africa/Lagos', null::smallint, null::smallint, 'Online'),
    ('mobile-games-efootball', 'SF1', 1::smallint, 'semi_final', timestamptz '2026-11-29 14:30 Africa/Lagos', null::smallint, null::smallint, 'Online'),
    ('mobile-games-efootball', 'SF1', 2::smallint, 'semi_final', timestamptz '2026-11-29 14:30 Africa/Lagos', null::smallint, null::smallint, 'Online'),
    ('mobile-games-efootball', 'SF2', 1::smallint, 'semi_final', timestamptz '2026-11-29 14:30 Africa/Lagos', null::smallint, null::smallint, 'Online'),
    ('mobile-games-efootball', 'SF2', 2::smallint, 'semi_final', timestamptz '2026-11-29 14:30 Africa/Lagos', null::smallint, null::smallint, 'Online'),
    ('mobile-games-efootball', '3rd', null::smallint, 'third_place', timestamptz '2026-11-29 15:30 Africa/Lagos', null::smallint, null::smallint, 'Online'),
    ('mobile-games-efootball', 'Final', null::smallint, 'final', timestamptz '2026-11-29 15:30 Africa/Lagos', null::smallint, null::smallint, 'Online'),
    ('mobile-games-codm', 'Elim', null::smallint, 'eliminator', timestamptz '2026-11-29 13:30 Africa/Lagos', null::smallint, null::smallint, 'Engineering Quadrangle'),
    ('mobile-games-codm', 'SF1', null::smallint, 'semi_final', timestamptz '2026-11-29 14:00 Africa/Lagos', null::smallint, null::smallint, 'Engineering Quadrangle'),
    ('mobile-games-codm', 'SF2', null::smallint, 'semi_final', timestamptz '2026-11-29 14:00 Africa/Lagos', null::smallint, null::smallint, 'Engineering Quadrangle'),
    ('mobile-games-codm', 'Final', null::smallint, 'final', timestamptz '2026-11-29 15:00 Africa/Lagos', null::smallint, null::smallint, 'Engineering Quadrangle'),
    ('basketball', null, null::smallint, 'group', timestamptz '2026-11-30 11:00 Africa/Lagos', 5::smallint, 3::smallint, 'UNILAG Sports Centre'),
    ('basketball', null, null::smallint, 'group', timestamptz '2026-11-30 12:00 Africa/Lagos', 1::smallint, 2::smallint, 'UNILAG Sports Centre'),
    ('basketball', null, null::smallint, 'group', timestamptz '2026-12-03 14:00 Africa/Lagos', 1::smallint, 5::smallint, 'UNILAG Sports Centre'),
    ('basketball', null, null::smallint, 'group', timestamptz '2026-12-03 15:00 Africa/Lagos', 2::smallint, 3::smallint, 'UNILAG Sports Centre'),
    ('basketball', 'SF A', null::smallint, 'semi_final_a', timestamptz '2026-12-05 14:00 Africa/Lagos', 4::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('basketball', 'SF B', null::smallint, 'semi_final_b', timestamptz '2026-12-05 15:00 Africa/Lagos', null::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('basketball', '3rd', null::smallint, 'third_place', timestamptz '2026-12-08 14:00 Africa/Lagos', null::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('basketball', 'Final', null::smallint, 'final', timestamptz '2026-12-08 15:00 Africa/Lagos', null::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('volleyball', null, null::smallint, 'group', timestamptz '2026-11-30 13:00 Africa/Lagos', 1::smallint, 2::smallint, 'UNILAG Sports Centre'),
    ('volleyball', null, null::smallint, 'group', timestamptz '2026-11-30 14:00 Africa/Lagos', 5::smallint, 3::smallint, 'UNILAG Sports Centre'),
    ('volleyball', null, null::smallint, 'group', timestamptz '2026-12-02 16:00 Africa/Lagos', 1::smallint, 5::smallint, 'UNILAG Sports Centre'),
    ('volleyball', null, null::smallint, 'group', timestamptz '2026-12-02 17:00 Africa/Lagos', 2::smallint, 3::smallint, 'UNILAG Sports Centre'),
    ('volleyball', 'BL', null::smallint, 'best_loser', timestamptz '2026-12-04 16:00 Africa/Lagos', null::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('volleyball', 'SF A', null::smallint, 'semi_final_a', timestamptz '2026-12-05 16:00 Africa/Lagos', 4::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('volleyball', 'SF B', null::smallint, 'semi_final_b', timestamptz '2026-12-05 17:00 Africa/Lagos', null::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('volleyball', '3rd', null::smallint, 'third_place', timestamptz '2026-12-08 16:00 Africa/Lagos', null::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('volleyball', 'Final', null::smallint, 'final', timestamptz '2026-12-08 17:00 Africa/Lagos', null::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('handball', null, null::smallint, 'group', timestamptz '2026-12-01 12:30 Africa/Lagos', 1::smallint, 2::smallint, 'UNILAG Sports Centre'),
    ('handball', null, null::smallint, 'group', timestamptz '2026-12-01 13:30 Africa/Lagos', 5::smallint, 3::smallint, 'UNILAG Sports Centre'),
    ('handball', null, null::smallint, 'group', timestamptz '2026-12-02 14:00 Africa/Lagos', 2::smallint, 3::smallint, 'UNILAG Sports Centre'),
    ('handball', null, null::smallint, 'group', timestamptz '2026-12-02 15:00 Africa/Lagos', 1::smallint, 5::smallint, 'UNILAG Sports Centre'),
    ('handball', 'BL', null::smallint, 'best_loser', timestamptz '2026-12-04 10:30 Africa/Lagos', null::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('handball', 'SF A', null::smallint, 'semi_final_a', timestamptz '2026-12-05 10:00 Africa/Lagos', 4::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('handball', 'SF B', null::smallint, 'semi_final_b', timestamptz '2026-12-05 11:00 Africa/Lagos', null::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('handball', '3rd', null::smallint, 'third_place', timestamptz '2026-12-07 14:00 Africa/Lagos', null::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('handball', 'Final', null::smallint, 'final', timestamptz '2026-12-07 15:30 Africa/Lagos', null::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('badminton-men', 'M1', null::smallint, 'eliminator', timestamptz '2026-12-01 14:00 Africa/Lagos', 1::smallint, 2::smallint, 'UNILAG Sports Centre'),
    ('badminton-men', 'M2', null::smallint, 'semi_final', timestamptz '2026-12-01 14:30 Africa/Lagos', null::smallint, 3::smallint, 'UNILAG Sports Centre'),
    ('badminton-men', 'M3', null::smallint, 'semi_final', timestamptz '2026-12-01 15:00 Africa/Lagos', 4::smallint, 5::smallint, 'UNILAG Sports Centre'),
    ('badminton-men', 'M4', null::smallint, 'third_place', timestamptz '2026-12-03 15:00 Africa/Lagos', null::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('badminton-men', 'M5', null::smallint, 'final', timestamptz '2026-12-03 16:00 Africa/Lagos', null::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('badminton-women', 'W1', null::smallint, 'eliminator', timestamptz '2026-12-01 14:00 Africa/Lagos', 1::smallint, 2::smallint, 'UNILAG Sports Centre'),
    ('badminton-women', 'W2', null::smallint, 'semi_final', timestamptz '2026-12-01 14:30 Africa/Lagos', null::smallint, 3::smallint, 'UNILAG Sports Centre'),
    ('badminton-women', 'W3', null::smallint, 'semi_final', timestamptz '2026-12-01 15:00 Africa/Lagos', 4::smallint, 5::smallint, 'UNILAG Sports Centre'),
    ('badminton-women', 'W4', null::smallint, 'third_place', timestamptz '2026-12-03 15:30 Africa/Lagos', null::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('badminton-women', 'W5', null::smallint, 'final', timestamptz '2026-12-03 16:30 Africa/Lagos', null::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('football-women', 'R1 A', null::smallint, 'round_1', timestamptz '2026-12-01 15:00 Africa/Lagos', 1::smallint, 2::smallint, 'UNILAG Sports Centre'),
    ('football-women', 'R1 B', null::smallint, 'round_1', timestamptz '2026-12-01 16:00 Africa/Lagos', 3::smallint, 4::smallint, 'UNILAG Sports Centre'),
    ('football-women', 'SF', null::smallint, 'semi_final', timestamptz '2026-12-03 13:00 Africa/Lagos', null::smallint, 5::smallint, 'UNILAG Sports Centre'),
    ('football-women', 'Final', null::smallint, 'final', timestamptz '2026-12-08 12:00 Africa/Lagos', null::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('lawn-tennis-singles', 'P1', null::smallint, 'preliminary', timestamptz '2026-12-01 16:00 Africa/Lagos', null::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('lawn-tennis-singles', 'P2', null::smallint, 'preliminary', timestamptz '2026-12-01 16:20 Africa/Lagos', null::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('lawn-tennis-singles', 'QF1', null::smallint, 'quarter_final', timestamptz '2026-12-01 16:40 Africa/Lagos', null::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('lawn-tennis-singles', 'QF2', null::smallint, 'quarter_final', timestamptz '2026-12-01 17:00 Africa/Lagos', null::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('lawn-tennis-singles', 'QF3', null::smallint, 'quarter_final', timestamptz '2026-12-01 17:20 Africa/Lagos', null::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('lawn-tennis-singles', 'QF4', null::smallint, 'quarter_final', timestamptz '2026-12-01 17:40 Africa/Lagos', null::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('lawn-tennis-singles', 'SF1', null::smallint, 'semi_final', timestamptz '2026-12-03 16:00 Africa/Lagos', null::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('lawn-tennis-singles', 'SF2', null::smallint, 'semi_final', timestamptz '2026-12-03 16:30 Africa/Lagos', null::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('lawn-tennis-singles', '3rd', null::smallint, 'third_place', timestamptz '2026-12-03 17:00 Africa/Lagos', null::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('lawn-tennis-singles', 'Final', null::smallint, 'final', timestamptz '2026-12-03 17:30 Africa/Lagos', null::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('table-tennis-mens-singles', 'SF1', null::smallint, 'semi_final', timestamptz '2026-12-07 12:00 Africa/Lagos', null::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('table-tennis-mens-singles', 'SF2', null::smallint, 'semi_final', timestamptz '2026-12-07 12:00 Africa/Lagos', null::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('table-tennis-mens-singles', '3rd', null::smallint, 'third_place', timestamptz '2026-12-07 14:00 Africa/Lagos', null::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('table-tennis-mens-singles', 'Final', null::smallint, 'final', timestamptz '2026-12-07 15:00 Africa/Lagos', null::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('table-tennis-womens-singles', 'SF1', null::smallint, 'semi_final', timestamptz '2026-12-07 12:00 Africa/Lagos', null::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('table-tennis-womens-singles', 'SF2', null::smallint, 'semi_final', timestamptz '2026-12-07 12:00 Africa/Lagos', null::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('table-tennis-womens-singles', '3rd', null::smallint, 'third_place', timestamptz '2026-12-07 14:00 Africa/Lagos', null::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('table-tennis-womens-singles', 'Final', null::smallint, 'final', timestamptz '2026-12-07 15:00 Africa/Lagos', null::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('table-tennis-mixed-doubles', null, null::smallint, 'group', timestamptz '2026-12-05 14:00 Africa/Lagos', 1::smallint, 2::smallint, 'UNILAG Sports Centre'),
    ('table-tennis-mixed-doubles', null, null::smallint, 'group', timestamptz '2026-12-05 14:00 Africa/Lagos', 3::smallint, 4::smallint, 'UNILAG Sports Centre'),
    ('table-tennis-mixed-doubles', null, null::smallint, 'group', timestamptz '2026-12-05 14:00 Africa/Lagos', 5::smallint, 1::smallint, 'UNILAG Sports Centre'),
    ('table-tennis-mixed-doubles', null, null::smallint, 'group', timestamptz '2026-12-05 14:00 Africa/Lagos', 2::smallint, 3::smallint, 'UNILAG Sports Centre'),
    ('table-tennis-mixed-doubles', null, null::smallint, 'group', timestamptz '2026-12-05 15:00 Africa/Lagos', 4::smallint, 5::smallint, 'UNILAG Sports Centre'),
    ('table-tennis-mixed-doubles', null, null::smallint, 'group', timestamptz '2026-12-05 15:00 Africa/Lagos', 1::smallint, 3::smallint, 'UNILAG Sports Centre'),
    ('table-tennis-mixed-doubles', null, null::smallint, 'group', timestamptz '2026-12-05 15:00 Africa/Lagos', 2::smallint, 4::smallint, 'UNILAG Sports Centre'),
    ('table-tennis-mixed-doubles', null, null::smallint, 'group', timestamptz '2026-12-05 15:00 Africa/Lagos', 3::smallint, 5::smallint, 'UNILAG Sports Centre'),
    ('table-tennis-mixed-doubles', null, null::smallint, 'group', timestamptz '2026-12-05 16:00 Africa/Lagos', 1::smallint, 4::smallint, 'UNILAG Sports Centre'),
    ('table-tennis-mixed-doubles', null, null::smallint, 'group', timestamptz '2026-12-05 16:00 Africa/Lagos', 2::smallint, 5::smallint, 'UNILAG Sports Centre'),
    ('table-tennis-mixed-doubles', '3rd', null::smallint, 'third_place', timestamptz '2026-12-07 14:00 Africa/Lagos', null::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('table-tennis-mixed-doubles', 'Final', null::smallint, 'final', timestamptz '2026-12-07 15:00 Africa/Lagos', null::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('swimming-female-25m-freestyle', null, null::smallint, 'final', timestamptz '2026-12-05 12:00 Africa/Lagos', null::smallint, null::smallint, 'Sports Complex – Pool'),
    ('swimming-male-25m-freestyle', null, null::smallint, 'final', timestamptz '2026-12-05 12:15 Africa/Lagos', null::smallint, null::smallint, 'Sports Complex – Pool'),
    ('swimming-female-50m-relay', null, null::smallint, 'final', timestamptz '2026-12-05 12:30 Africa/Lagos', null::smallint, null::smallint, 'Sports Complex – Pool'),
    ('swimming-male-50m-relay', null, null::smallint, 'final', timestamptz '2026-12-05 13:00 Africa/Lagos', null::smallint, null::smallint, 'Sports Complex – Pool'),
    ('swimming-mixed-100m-relay', null, null::smallint, 'final', timestamptz '2026-12-05 13:30 Africa/Lagos', null::smallint, null::smallint, 'Sports Complex – Pool'),
    ('athletics-100m', null, null::smallint, 'heat_1', timestamptz '2026-12-07 15:00 Africa/Lagos', null::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('athletics-100m', null, null::smallint, 'heat_2', timestamptz '2026-12-07 15:20 Africa/Lagos', null::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('athletics-100m', null, null::smallint, 'heat_3', timestamptz '2026-12-07 15:40 Africa/Lagos', null::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('athletics-200m', null, null::smallint, 'heat_1', timestamptz '2026-12-07 16:00 Africa/Lagos', null::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('athletics-200m', null, null::smallint, 'heat_2', timestamptz '2026-12-07 16:20 Africa/Lagos', null::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('athletics-200m', null, null::smallint, 'heat_3', timestamptz '2026-12-07 16:40 Africa/Lagos', null::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('athletics-400m', null, null::smallint, 'heat_1', timestamptz '2026-12-08 17:00 Africa/Lagos', null::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('athletics-400m', null, null::smallint, 'heat_2', timestamptz '2026-12-08 17:20 Africa/Lagos', null::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('athletics-400m', null, null::smallint, 'heat_3', timestamptz '2026-12-08 17:40 Africa/Lagos', null::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('athletics-1500m', null, null::smallint, 'final', timestamptz '2026-12-09 13:00 Africa/Lagos', null::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('athletics-800m', null, null::smallint, 'final', timestamptz '2026-12-09 13:00 Africa/Lagos', null::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('athletics-400m', null, null::smallint, 'final', timestamptz '2026-12-09 13:00 Africa/Lagos', null::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('athletics-200m', null, null::smallint, 'final', timestamptz '2026-12-09 13:00 Africa/Lagos', null::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('athletics-100m', null, null::smallint, 'final', timestamptz '2026-12-09 13:00 Africa/Lagos', null::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('athletics-4x100m-relay-mixed', null, null::smallint, 'final', timestamptz '2026-12-09 13:00 Africa/Lagos', null::smallint, null::smallint, 'UNILAG Sports Centre'),
    ('athletics-4x100m-relay-men', null, null::smallint, 'final', timestamptz '2026-12-09 13:00 Africa/Lagos', null::smallint, null::smallint, 'UNILAG Sports Centre')
) as v (event_slug, tie, leg, stage, kickoff_at, home_year, away_year, venue)
join public.events e on e.slug = v.event_slug
left join public.teams h on h.year = v.home_year
left join public.teams a on a.year = v.away_year
where not exists (
  select 1 from public.fixtures x
  where x.event_id = e.id
    and x.stage = v.stage
    and x.tie is not distinct from v.tie
    and x.leg is not distinct from v.leg
    and x.home_team_id is not distinct from h.id
    and x.away_team_id is not distinct from a.id
);

-- =============================================================================
-- Verify (for Tayo, after applying)
-- =============================================================================
-- select s.name as sport, count(distinct e.id) as events, count(f.id) as fixtures
--   from public.sports s join public.events e on e.sport_id = s.id
--   left join public.fixtures f on f.event_id = e.id
--   group by s.name, s.sort_order order by s.sort_order;
-- select md.number, md.deadline_at at time zone 'Africa/Lagos' from public.matchdays md order by 1;
--   -- MD1 deadline Sat 28 Nov 07:00
