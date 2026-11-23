-- =============================================================================
-- Real fantasy prices and final squads
-- Author: Tayo
-- Source: the "FPL name and prices" doc from the team captains (23 Nov 2026)
--
-- 1. Widens the price range to N3.0m to N11.0m (steps of N0.5m). The doc has
--    nine prices outside the old N4.0m to N10.0m range (N3.0m for Faruq and
--    Lawal, N11.0m for Micheal). The check constraint and admin_price_rules()
--    change together, so the database and the CSV importers agree.
-- 2. Renames players to the names in the doc (Year 1's short names, Year 2's
--    two Samuels now have surnames).
-- 3. Adds the 10 players who are in the doc but not in the database.
-- 4. Marks Ahmad and Rere (Year 3) and Jaystar (Year 4) as 'left': they are
--    not in the doc. They are kept, not deleted, so nothing that points at
--    them breaks and they can be brought back by setting status again.
-- 5. Sets every player's price from the doc, then checks that all 110 listed
--    players exist at their listed price and nobody else is still available.
--
-- Prices lock at the matchday 1 deadline. This runs as the migration role
-- (auth.uid() is null), so the price-lock trigger lets it through; run it
-- before that deadline anyway, since managers will start picking at once.
-- Safe to run twice.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Price range
-- -----------------------------------------------------------------------------
alter table public.players drop constraint if exists players_price_tenths_check;
alter table public.players add constraint players_price_tenths_check
  check (price_tenths between 30 and 110 and price_tenths % 5 = 0);

create or replace function public.admin_price_rules()
returns table (min_tenths smallint, max_tenths smallint, step_tenths smallint)
language sql
immutable
set search_path = ''
as $$
  select 30::smallint, 110::smallint, 5::smallint;
$$;

-- -----------------------------------------------------------------------------
-- 2. Renames (year, old display name, new display name, new full name or null
--    to keep the full name)
-- -----------------------------------------------------------------------------
update public.players p
set display_name = v.new_display,
    full_name    = coalesce(v.new_full, p.full_name)
from (values
  (1, 'Inioluwa Shinayomi',         'Inioluwa Shinayomi', null),
  (1, 'Adesanya Ezekiel Adedimeji', 'Ezekiel',            null),
  (1, 'Adabonyan Oluwasogo',        'Adabonyan',          null),
  (1, 'Hamza Aderoju',              'Aderoju',            null),
  (1, 'Femi Testimony',             'Testimony',          null),
  (1, 'Abdul Wahab',                'Wahab',              null),
  (1, 'Oluwadamilola Adejukabi',    'Oluwadamilola',      null),
  (1, 'Salau Sulaiman',             'Sulaiman',           null),
  (1, 'Adeniji Abdullah',           'Abdullah',           null),
  (1, 'Anófi Waliylahi',            'Waliylahi',          null),
  (1, 'Adejare David',              'David',              null),
  (1, 'Denis Joshua',               'Joshua',             null),
  (2, 'Samuel (DEF)',               'Samuel Achunine',    'Samuel Achunine'),
  (2, 'Samuel (ATT)',               'Samuel Azubuike',    'Samuel Azubuike'),
  (2, 'Cosy - Henry',               'Cosy-Henry',         'Cosy-Henry')
) as v (year, old_display, new_display, new_full)
join public.teams t on t.year = v.year
where p.team_id = t.id
  and p.display_name = v.old_display
  -- Running twice: the new name is already taken by this same row.
  and not exists (
    select 1 from public.players q
    where q.team_id = t.id and q.display_name = v.new_display
  );

-- -----------------------------------------------------------------------------
-- The doc: every player, by year, with position and price (in tenths)
-- -----------------------------------------------------------------------------
-- Dropped at the end of this file (not "on commit drop", which would empty it
-- straight away if the statements run outside one transaction).
drop table if exists pg_temp.player_doc;
create temp table player_doc (
  year         smallint not null,
  display_name text not null,
  position     public.player_position not null,
  price_tenths smallint not null,
  primary key (year, display_name)
);

insert into player_doc (year, display_name, position, price_tenths) values
  -- Year 1 (SEES 31)
  (1, 'Inioluwa Shinayomi', 'GK',  45),
  (1, 'Ezekiel',            'DEF', 60),
  (1, 'Adabonyan',          'DEF', 50),
  (1, 'Aderoju',            'DEF', 45),
  (1, 'Testimony',          'DEF', 50),
  (1, 'Victor',             'DEF', 45),
  (1, 'Wahab',              'MID', 55),
  (1, 'Oluwadamilola',      'MID', 60),
  (1, 'Sulaiman',           'MID', 55),
  (1, 'Abdullah',           'MID', 55),
  (1, 'Douglas',            'MID', 50),
  (1, 'Khalid',             'MID', 50),
  (1, 'John',               'MID', 50),
  (1, 'Waliylahi',          'FWD', 60),
  (1, 'David',              'FWD', 60),
  (1, 'Joshua',             'FWD', 50),
  (1, 'Oluwatooni',         'FWD', 55),
  -- Year 2 (SEES 30)
  (2, 'Zeke',               'GK',  40),
  (2, 'Faruq',              'GK',  30),
  (2, 'Khaleelah',          'DEF', 55),
  (2, 'Odolf',              'DEF', 45),
  (2, 'Esosa',              'DEF', 45),
  (2, 'Koreed',             'DEF', 40),
  (2, 'Samuel Achunine',    'DEF', 40),
  (2, 'Cosy-Henry',         'DEF', 35),
  (2, 'Roberts',            'DEF', 35),
  (2, 'Ore',                'DEF', 35),
  (2, 'Habeeb Aloba',       'MID', 75),
  (2, 'Boye',               'MID', 70),
  (2, 'Malik',              'MID', 55),
  (2, 'Sayf',               'MID', 40),
  (2, 'Pedri',              'MID', 40),
  (2, 'Habeeb O.',          'MID', 35),
  (2, 'Yasin',              'FWD', 80),
  (2, 'Shelby',             'FWD', 70),
  (2, 'Deo',                'FWD', 60),
  (2, 'Samuel Azubuike',    'FWD', 55),
  (2, 'Show',               'FWD', 45),
  (2, 'Ayo',                'FWD', 40),
  (2, 'Damisi',             'FWD', 40),
  -- Year 3 (SEES 29)
  (3, 'Charles',            'GK',  45),
  (3, 'Ayodeji',            'DEF', 55),
  (3, 'Ayobami',            'DEF', 40),
  (3, 'Sam',                'DEF', 60),
  (3, 'Khalaf',             'DEF', 45),
  (3, 'Lawal',              'DEF', 30),
  (3, 'Fasasi',             'DEF', 40),
  (3, 'Ojay',               'DEF', 40),
  (3, 'Atom',               'MID', 40),
  (3, 'Savid',              'MID', 50),
  (3, 'Zayd',               'MID', 40),
  (3, 'Boiz',               'MID', 35),
  (3, 'Elijah',             'MID', 40),
  (3, 'Adewale',            'MID', 80),
  (3, 'Anix',               'MID', 85),
  (3, 'Salahu',             'MID', 55),
  (3, 'Azure',              'FWD', 60),
  (3, 'Muiz',               'FWD', 80),
  (3, 'Joel',               'FWD', 55),
  (3, 'Daniel Ade',         'FWD', 55),
  (3, 'Joker',              'FWD', 50),
  (3, 'Calm',               'FWD', 50),
  (3, 'Daniel',             'FWD', 50),
  -- Year 4 (SEES 28)
  (4, 'Fash',               'GK',  60),
  (4, 'Olamilekan',         'GK',  50),
  (4, 'Kamsi',              'DEF', 70),
  (4, 'Saliba',             'DEF', 55),
  (4, 'Dabby',              'DEF', 55),
  (4, 'Benz',               'DEF', 60),
  (4, 'Davidson',           'DEF', 55),
  (4, 'Son of Grace',       'DEF', 45),
  (4, 'Zeus',               'DEF', 40),
  (4, 'Sarafa',             'DEF', 45),
  (4, 'Sadon',              'MID', 70),
  (4, 'Rixxenn',            'MID', 55),
  (4, 'Kaba',               'MID', 55),
  (4, 'Israel',             'MID', 60),
  (4, 'Hammex',             'MID', 50),
  (4, 'Morale',             'MID', 60),
  (4, 'Atom',               'MID', 60),
  (4, 'Sulaimon',           'MID', 60),
  (4, 'Toheeb',             'FWD', 100),
  (4, 'Alvin',              'FWD', 105),
  (4, 'Hamad',              'FWD', 70),
  (4, 'Success',            'FWD', 90),
  (4, 'Kodi',               'FWD', 60),
  (4, 'Chima',              'FWD', 50),
  -- Year 5 (SEES 26)
  (5, 'Jeager',             'GK',  55),
  (5, 'Manuel',             'DEF', 70),
  (5, 'Korede',             'DEF', 60),
  (5, 'Qudus',              'DEF', 45),
  (5, 'Nonso',              'DEF', 55),
  (5, 'Valentino',          'DEF', 35),
  (5, 'Tonali',             'DEF', 40),
  (5, 'Tobe',               'DEF', 45),
  (5, 'Deyi',               'DEF', 40),
  (5, 'Basit',              'DEF', 40),
  (5, 'AJ',                 'DEF', 35),
  (5, 'Praise',             'MID', 60),
  (5, 'Anifowoshe',         'MID', 70),
  (5, 'Omosh',              'MID', 100),
  (5, 'Wizz',               'MID', 70),
  (5, 'Drey',               'MID', 45),
  (5, 'Alvin',              'MID', 50),
  (5, 'Peakay',             'MID', 45),
  (5, 'Micheal',            'FWD', 110),
  (5, 'Kolade',             'FWD', 55),
  (5, 'Fame',               'FWD', 60),
  (5, 'Tega',               'FWD', 50),
  (5, 'Ife',                'FWD', 75);

-- -----------------------------------------------------------------------------
-- 3. New players
-- -----------------------------------------------------------------------------
insert into public.players (team_id, full_name, display_name, position, price_tenths)
select t.id, d.display_name, d.display_name, d.position, d.price_tenths
from player_doc d
join public.teams t on t.year = d.year
on conflict (team_id, display_name) do nothing;

-- -----------------------------------------------------------------------------
-- 4. Prices and positions from the doc; everyone listed is available
-- -----------------------------------------------------------------------------
update public.players p
set price_tenths = d.price_tenths,
    position     = d.position,
    status       = case when p.status = 'left' then 'available' else p.status end
from player_doc d
join public.teams t on t.year = d.year
where p.team_id = t.id
  and p.display_name = d.display_name
  and (p.price_tenths, p.position, p.status = 'left')
      is distinct from (d.price_tenths, d.position, false);

-- -----------------------------------------------------------------------------
-- 5. Players not in the doc have left their squads
-- -----------------------------------------------------------------------------
update public.players p
set status = 'left'
from public.teams t
where p.team_id = t.id
  and p.status <> 'left'
  and not exists (
    select 1 from player_doc d
    where d.year = t.year and d.display_name = p.display_name
  );

-- -----------------------------------------------------------------------------
-- Check: the database now matches the doc exactly
-- -----------------------------------------------------------------------------
do $$
declare
  v_missing  integer;
  v_extra    integer;
begin
  select count(*) into v_missing
  from player_doc d
  join public.teams t on t.year = d.year
  left join public.players p
    on p.team_id = t.id and p.display_name = d.display_name
   and p.price_tenths = d.price_tenths and p.position = d.position
   and p.status <> 'left'
  where p.id is null;

  select count(*) into v_extra
  from public.players p
  join public.teams t on t.id = p.team_id
  where p.status <> 'left'
    and not exists (
      select 1 from player_doc d
      where d.year = t.year and d.display_name = p.display_name
    );

  if v_missing > 0 or v_extra > 0 then
    raise exception 'players do not match the price doc: % missing or wrong, % not in the doc',
      v_missing, v_extra;
  end if;
end;
$$;

drop table if exists pg_temp.player_doc;
