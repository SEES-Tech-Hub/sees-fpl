-- =============================================================================
-- Board and mobile games as separate events; football schedule from the
-- organisers' updated rulebook
-- Author: Tayo
-- Rules: the organisers' BOARD GAMES (22 Nov), MOBILE GAMES (23 Nov) and
-- FOOTBALL (24 Nov) rulebooks in the SEES GAMES 2026 Drive folder.
--
-- What this changes
--   * Board Games: one event per game, each with its own table (rulebook:
--     "Each of the 5 games will have its own point standings"). Chess is two
--     leagues, men's and women's. The seeded "Board Games" event becomes
--     Chess (men). Group points are 2 for a win and 1 for a draw: the
--     rulebook's 1 and 0.5, doubled because points are whole numbers.
--   * Mobile Games: eFootball, Call of Duty Mobile and EA FC. The seeded
--     "Mobile Games" event becomes eFootball.
--   * Football (men): the league fixtures, kickoffs and fantasy deadlines
--     from the 24 Nov rulebook. Saturday's times are still TBD in the
--     rulebook, so they keep 2:00 pm and 4:00 pm. Deadlines stay 30 minutes
--     before each matchday's first kickoff.
--
-- Only fixtures with no match events are touched; the fixtures guard lets
-- migrations through (no signed-in user).
--
-- Safe to run twice.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Board games
-- -----------------------------------------------------------------------------
update public.events ev set slug = 'board-games-chess-men', name = 'Chess (men)'
from public.sports s
where s.id = ev.sport_id and s.slug = 'board-games' and ev.slug = 'board-games';

insert into public.events (sport_id, slug, name)
select s.id, v.slug, v.name
from public.sports s
cross join (values
  ('board-games-chess-men',     'Chess (men)'),
  ('board-games-chess-women',   'Chess (women)'),
  ('board-games-scrabble',      'Scrabble'),
  ('board-games-ludo',          'Ludo'),
  ('board-games-draughts',      'Draughts'),
  ('board-games-connect-four',  'Connect Four')
) as v (slug, name)
where s.slug = 'board-games'
on conflict (sport_id, slug) do nothing;

update public.events ev set win_points = 2, draw_points = 1, loss_points = 0
from public.sports s
where s.id = ev.sport_id and s.slug = 'board-games';

-- -----------------------------------------------------------------------------
-- Mobile games
-- -----------------------------------------------------------------------------
update public.events ev set slug = 'mobile-games-efootball', name = 'eFootball'
from public.sports s
where s.id = ev.sport_id and s.slug = 'mobile-games' and ev.slug = 'mobile-games';

insert into public.events (sport_id, slug, name)
select s.id, v.slug, v.name
from public.sports s
cross join (values
  ('mobile-games-efootball', 'eFootball'),
  ('mobile-games-codm',      'Call of Duty Mobile'),
  ('mobile-games-ea-fc',     'EA FC')
) as v (slug, name)
where s.slug = 'mobile-games'
on conflict (sport_id, slug) do nothing;

update public.events ev set
  win_points  = coalesce(ev.win_points, 3),
  draw_points = coalesce(ev.draw_points, 1),
  loss_points = coalesce(ev.loss_points, 0)
from public.sports s
where s.id = ev.sport_id and s.slug = 'mobile-games';

-- -----------------------------------------------------------------------------
-- Football (men): league fixtures from the 24 Nov rulebook (times in WAT)
-- -----------------------------------------------------------------------------
with plan (matchday, slot, home_year, away_year, kickoff) as (
  values
    (1, 1, 5, 3, timestamptz '2026-11-28 14:00 Africa/Lagos'),
    (1, 2, 1, 2, timestamptz '2026-11-28 16:00 Africa/Lagos'),
    (2, 1, 1, 4, timestamptz '2026-11-30 15:00 Africa/Lagos'),
    (2, 2, 5, 2, timestamptz '2026-11-30 16:00 Africa/Lagos'),
    (3, 1, 2, 4, timestamptz '2026-12-02 11:30 Africa/Lagos'),
    (3, 2, 3, 1, timestamptz '2026-12-02 12:45 Africa/Lagos'),
    (4, 1, 5, 1, timestamptz '2026-12-04 08:00 Africa/Lagos'),
    (4, 2, 4, 3, timestamptz '2026-12-04 09:15 Africa/Lagos'),
    (5, 1, 2, 3, timestamptz '2026-12-06 09:45 Africa/Lagos'),
    (5, 2, 5, 4, timestamptz '2026-12-06 10:50 Africa/Lagos')
),
current as (
  -- Each matchday's two league fixtures, in kickoff order.
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
  kickoff_at   = p.kickoff
from current c
join plan p on p.matchday = c.matchday and p.slot = c.slot
join public.teams home on home.year = p.home_year
join public.teams away on away.year = p.away_year
where f.id = c.id
  and f.status = 'scheduled'
  and not exists (select 1 from public.match_events me where me.fixture_id = f.id);

-- Deadlines: 30 minutes before each matchday's first kickoff, for matchdays
-- whose deadline hasn't passed.
update public.matchdays md set deadline_at = first.kickoff_at - interval '30 minutes'
from (
  select matchday_id, min(kickoff_at) as kickoff_at
  from public.fixtures
  where matchday_id is not null and kickoff_at is not null
  group by matchday_id
) as first
where first.matchday_id = md.id
  and (md.deadline_at is null or md.deadline_at > now());

-- =============================================================================
-- Verify (for Tayo, after applying)
-- =============================================================================
-- select s.name, e.name, e.win_points, e.draw_points from public.events e
--   join public.sports s on s.id = e.sport_id
--   where s.slug in ('board-games', 'mobile-games') order by 1, 2;
--   -- 6 board games (2/1/0), 3 mobile games
-- select md.number, md.deadline_at at time zone 'Africa/Lagos' as deadline,
--        h.short_name, a.short_name, f.kickoff_at at time zone 'Africa/Lagos' as kickoff
--   from public.fixtures f join public.matchdays md on md.id = f.matchday_id
--   join public.teams h on h.id = f.home_team_id join public.teams a on a.id = f.away_team_id
--   order by f.kickoff_at;
--   -- MD1: Y5 v Y3 14:00, Y1 v Y2 16:00 (deadline 13:30) … MD5: Y2 v Y3, Y5 v Y4
