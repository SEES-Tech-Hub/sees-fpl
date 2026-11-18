-- =============================================================================
-- Seed core data
-- Author: Tayo (T3 in the team task plan)
-- PRD: "Tournament facts"; squads from docs/football-team-listing.md
--
-- 5 teams, 103 players at placeholder prices, 12 sports (one event each),
-- 6 football matchdays and the 12 football fixtures from the rulebook.
--
-- Placeholders to replace before launch (Henry, A14):
--   * prices: GK 4.5, DEF 4.5, MID 5.5, FWD 6.0
--   * kickoff times: 14:00 and 16:00 WAT on each matchday
--   * Year 2's two Samuels are "Samuel (DEF)" and "Samuel (ATT)" until surnames arrive
-- Safe to run twice: nothing is inserted twice.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Teams
-- -----------------------------------------------------------------------------
insert into public.teams (year, name, short_name, class_label, coaches) values
  (1, 'Year 1', 'Y1', 'SEES 31', '{}'),
  (2, 'Year 2', 'Y2', 'SEES 30', '{Dips,Feolami}'),
  (3, 'Year 3', 'Y3', 'SEES 29', '{Justin,"Tom Dave"}'),
  (4, 'Year 4', 'Y4', 'SEES 28', '{Busayo}'),
  (5, 'Year 5', 'Y5', 'SEES 26', '{Moyo,Alfred}')
on conflict (year) do nothing;

-- -----------------------------------------------------------------------------
-- Players (year, full name, display name, position)
-- -----------------------------------------------------------------------------
insert into public.players (team_id, full_name, display_name, position, price_tenths)
select
  t.id,
  v.full_name,
  v.display_name,
  v.position::public.player_position,
  case v.position when 'GK' then 45 when 'DEF' then 45 when 'MID' then 55 else 60 end
from (values
  -- Year 1 (SEES 31)
  (1, 'Inioluwa Shinayomi',          'Inioluwa Shinayomi',          'GK'),
  (1, 'Adesanya Ezekiel Adedimeji',  'Adesanya Ezekiel Adedimeji',  'DEF'),
  (1, 'Adabonyan Oluwasogo',         'Adabonyan Oluwasogo',         'DEF'),
  (1, 'Hamza Aderoju',               'Hamza Aderoju',               'DEF'),
  (1, 'Femi Testimony',              'Femi Testimony',              'DEF'),
  (1, 'Abdul Wahab',                 'Abdul Wahab',                 'MID'),
  (1, 'Oluwadamilola Adejukabi',     'Oluwadamilola Adejukabi',     'MID'),
  (1, 'Salau Sulaiman',              'Salau Sulaiman',              'MID'),
  (1, 'Adeniji Abdullah',            'Adeniji Abdullah',            'MID'),
  (1, 'Anófi Waliylahi',             'Anófi Waliylahi',             'FWD'),
  (1, 'Adejare David',               'Adejare David',               'FWD'),
  (1, 'Denis Joshua',                'Denis Joshua',                'FWD'),
  -- Year 2 (SEES 30)
  (2, 'Zeke',          'Zeke',          'GK'),
  (2, 'Faruq',         'Faruq',         'GK'),
  (2, 'Khaleelah',     'Khaleelah',     'DEF'),
  (2, 'Odolf',         'Odolf',         'DEF'),
  (2, 'Koreed',        'Koreed',        'DEF'),
  (2, 'Samuel',        'Samuel (DEF)',  'DEF'),
  (2, 'Esosa',         'Esosa',         'DEF'),
  (2, 'Cosy - Henry',  'Cosy - Henry',  'DEF'),
  (2, 'Roberts',       'Roberts',       'DEF'),
  (2, 'Ore',           'Ore',           'DEF'),
  (2, 'Boye',          'Boye',          'MID'),
  (2, 'Habeeb O.',     'Habeeb O.',     'MID'),
  (2, 'Habeeb Aloba',  'Habeeb Aloba',  'MID'),
  (2, 'Malik',         'Malik',         'MID'),
  (2, 'Sayf',          'Sayf',          'MID'),
  (2, 'Pedri',         'Pedri',         'MID'),
  (2, 'Shelby',        'Shelby',        'FWD'),
  (2, 'Yasin',         'Yasin',         'FWD'),
  (2, 'Deo',           'Deo',           'FWD'),
  (2, 'Ayo',           'Ayo',           'FWD'),
  (2, 'Show',          'Show',          'FWD'),
  (2, 'Samuel',        'Samuel (ATT)',  'FWD'),
  -- Year 3 (SEES 29)
  (3, 'Ahmad',       'Ahmad',       'GK'),
  (3, 'Ayodeji',     'Ayodeji',     'DEF'),
  (3, 'Ayobami',     'Ayobami',     'DEF'),
  (3, 'Sam',         'Sam',         'DEF'),
  (3, 'Khalaf',      'Khalaf',      'DEF'),
  (3, 'Lawal',       'Lawal',       'DEF'),
  (3, 'Fasasi',      'Fasasi',      'DEF'),
  (3, 'Rere',        'Rere',        'DEF'),
  (3, 'Atom',        'Atom',        'MID'),
  (3, 'Savid',       'Savid',       'MID'),
  (3, 'Zayd',        'Zayd',        'MID'),
  (3, 'Boiz',        'Boiz',        'MID'),
  (3, 'Elijah',      'Elijah',      'MID'),
  (3, 'Adewale',     'Adewale',     'MID'),
  (3, 'Anix',        'Anix',        'MID'),
  (3, 'Salahu',      'Salahu',      'MID'),
  (3, 'Azure',       'Azure',       'FWD'),
  (3, 'Muiz',        'Muiz',        'FWD'),
  (3, 'Joel',        'Joel',        'FWD'),
  (3, 'Daniel Ade',  'Daniel Ade',  'FWD'),
  (3, 'Daniel',      'Daniel',      'FWD'),
  (3, 'Calm',        'Calm',        'FWD'),
  -- Year 4 (SEES 28)
  (4, 'Fash',          'Fash',          'GK'),
  (4, 'Olamilekan',    'Olamilekan',    'GK'),
  (4, 'Kamsi',         'Kamsi',         'DEF'),
  (4, 'Saliba',        'Saliba',        'DEF'),
  (4, 'Dabby',         'Dabby',         'DEF'),
  (4, 'Benz',          'Benz',          'DEF'),
  (4, 'Davidson',      'Davidson',      'DEF'),
  (4, 'Son of Grace',  'Son of Grace',  'DEF'),
  (4, 'Zeus',          'Zeus',          'DEF'),
  (4, 'Sarafa',        'Sarafa',        'DEF'),
  (4, 'Sadon',         'Sadon',         'MID'),
  (4, 'Rixxenn',       'Rixxenn',       'MID'),
  (4, 'Kaba',          'Kaba',          'MID'),
  (4, 'Israel',        'Israel',        'MID'),
  (4, 'Jaystar',       'Jaystar',       'MID'),
  (4, 'Hammex',        'Hammex',        'MID'),
  (4, 'Morale',        'Morale',        'MID'),
  (4, 'Atom',          'Atom',          'MID'),
  (4, 'Toheeb',        'Toheeb',        'FWD'),
  (4, 'Alvin',         'Alvin',         'FWD'),
  (4, 'Hamad',         'Hamad',         'FWD'),
  (4, 'Success',       'Success',       'FWD'),
  (4, 'Kodi',          'Kodi',          'FWD'),
  (4, 'Chima',         'Chima',         'FWD'),
  -- Year 5 (SEES 26)
  (5, 'Jeager',      'Jeager',      'GK'),
  (5, 'Manuel',      'Manuel',      'DEF'),
  (5, 'Korede',      'Korede',      'DEF'),
  (5, 'Qudus',       'Qudus',       'DEF'),
  (5, 'Nonso',       'Nonso',       'DEF'),
  (5, 'Valentino',   'Valentino',   'DEF'),
  (5, 'Tonali',      'Tonali',      'DEF'),
  (5, 'Tobe',        'Tobe',        'DEF'),
  (5, 'Deyi',        'Deyi',        'DEF'),
  (5, 'Basit',       'Basit',       'DEF'),
  (5, 'AJ',          'AJ',          'DEF'),
  (5, 'Praise',      'Praise',      'MID'),
  (5, 'Anifowoshe',  'Anifowoshe',  'MID'),
  (5, 'Omosh',       'Omosh',       'MID'),
  (5, 'Wizz',        'Wizz',        'MID'),
  (5, 'Drey',        'Drey',        'MID'),
  (5, 'Alvin',       'Alvin',       'MID'),
  (5, 'Peakay',      'Peakay',      'MID'),
  (5, 'Micheal',     'Micheal',     'FWD'),
  (5, 'Kolade',      'Kolade',      'FWD'),
  (5, 'Fame',        'Fame',        'FWD'),
  (5, 'Tega',        'Tega',        'FWD'),
  (5, 'Ife',         'Ife',         'FWD')
) as v (year, full_name, display_name, position)
join public.teams t on t.year = v.year
on conflict (team_id, display_name) do nothing;

-- -----------------------------------------------------------------------------
-- Sports (result formats from the PRD) and one event per sport for now
-- -----------------------------------------------------------------------------
insert into public.sports (slug, name, result_format, sort_order) values
  ('football',      'Football',      'timed',        1),
  ('basketball',    'Basketball',    'timed',        2),
  ('handball',      'Handball',      'timed',        3),
  ('volleyball',    'Volleyball',    'sets',         4),
  ('badminton',     'Badminton',     'sets',         5),
  ('table-tennis',  'Table Tennis',  'sets',         6),
  ('lawn-tennis',   'Lawn Tennis',   'sets',         7),
  ('athletics',     'Athletics',     'ranked',       8),
  ('swimming',      'Swimming',      'ranked',       9),
  ('board-games',   'Board Games',   'head_to_head', 10),
  ('mobile-games',  'Mobile Games',  'head_to_head', 11),
  ('mortal-kombat', 'Mortal Kombat', 'head_to_head', 12)
on conflict (slug) do nothing;

insert into public.events (sport_id, slug, name, period_minutes, period_count)
select s.id, v.slug, v.name, v.period_minutes, v.period_count
from (values
  ('football',      'football-men',  'Football (men)', 25,   2),
  ('basketball',    'basketball',    'Basketball',     null, null),
  ('handball',      'handball',      'Handball',       null, null),
  ('volleyball',    'volleyball',    'Volleyball',     null, null),
  ('badminton',     'badminton',     'Badminton',      null, null),
  ('table-tennis',  'table-tennis',  'Table Tennis',   null, null),
  ('lawn-tennis',   'lawn-tennis',   'Lawn Tennis',    null, null),
  ('athletics',     'athletics',     'Athletics',      null, null),
  ('swimming',      'swimming',      'Swimming',       null, null),
  ('board-games',   'board-games',   'Board Games',    null, null),
  ('mobile-games',  'mobile-games',  'Mobile Games',   null, null),
  ('mortal-kombat', 'mortal-kombat', 'Mortal Kombat',  null, null)
) as v (sport_slug, slug, name, period_minutes, period_count)
join public.sports s on s.slug = v.sport_slug
on conflict (sport_id, slug) do nothing;

-- -----------------------------------------------------------------------------
-- Football matchdays
-- -----------------------------------------------------------------------------
insert into public.matchdays (number, name) values
  (1, 'Matchday 1'),
  (2, 'Matchday 2'),
  (3, 'Matchday 3'),
  (4, 'Matchday 4'),
  (5, 'Matchday 5'),
  (6, 'Matchday 6 (Finals)')
on conflict (number) do nothing;

-- -----------------------------------------------------------------------------
-- Football fixtures (rulebook schedule). Kickoffs are placeholders.
-- Matchday 6 teams are filled from the final league table (Henry's A6).
-- Inserted only if no football fixtures exist yet.
-- -----------------------------------------------------------------------------
do $$
declare
  v_event uuid;
begin
  select e.id into v_event
  from public.events e join public.sports s on s.id = e.sport_id
  where s.slug = 'football' and e.slug = 'football-men';

  if exists (select 1 from public.fixtures where event_id = v_event) then
    return;
  end if;

  insert into public.fixtures (event_id, stage, home_team_id, away_team_id, kickoff_at, venue, matchday_id)
  select
    v_event,
    v.stage,
    home.id,
    away.id,
    v.kickoff_at::timestamptz,
    'UNILAG Sports Centre',
    md.id
  from (values
    (1, 'league',      1,    4,    '2026-11-28 14:00+01'),
    (1, 'league',      2,    3,    '2026-11-28 16:00+01'),
    (2, 'league',      5,    3,    '2026-11-30 14:00+01'),
    (2, 'league',      1,    2,    '2026-11-30 16:00+01'),
    (3, 'league',      2,    4,    '2026-12-02 14:00+01'),
    (3, 'league',      5,    1,    '2026-12-02 16:00+01'),
    (4, 'league',      3,    1,    '2026-12-04 14:00+01'),
    (4, 'league',      4,    5,    '2026-12-04 16:00+01'),
    (5, 'league',      2,    5,    '2026-12-06 14:00+01'),
    (5, 'league',      3,    4,    '2026-12-06 16:00+01'),
    (6, 'third_place', null, null, '2026-12-09 14:00+01'),
    (6, 'final',       null, null, '2026-12-09 16:00+01')
  ) as v (matchday, stage, home_year, away_year, kickoff_at)
  join public.matchdays md on md.number = v.matchday
  left join public.teams home on home.year = v.home_year
  left join public.teams away on away.year = v.away_year;
end;
$$;

-- Each matchday's deadline: 30 minutes before its first kickoff.
-- (Mary's M5 trigger keeps this up to date when kickoffs move.)
update public.matchdays md
set deadline_at = first_kickoff.kickoff_at - interval '30 minutes'
from (
  select matchday_id, min(kickoff_at) as kickoff_at
  from public.fixtures
  where matchday_id is not null
  group by matchday_id
) as first_kickoff
where first_kickoff.matchday_id = md.id
  and md.deadline_at is null;
