-- =============================================================================
-- Base schema
-- Author: Tayo (T2 in the team task plan)
-- PRD: "Users and roles", "Data, stack and non-functional requirements"
--
-- Creates the shared enums, profiles (one per signed-in Google user), teams,
-- players, sports, events, matchdays and fixtures, plus the role helpers every
-- other migration's RLS policies use: is_admin(), is_official(), holds_fixture().
-- Every table has row-level security. Safe to run twice.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enums (values are fixed in "Shared contracts")
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.app_role as enum ('user', 'official', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.player_position as enum ('GK', 'DEF', 'MID', 'FWD');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.player_status as enum ('available', 'injured', 'suspended', 'left');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.result_format as enum ('timed', 'sets', 'head_to_head', 'ranked');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.fixture_status as enum
    ('scheduled', 'live', 'half_time', 'full_time', 'postponed', 'walkover', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.match_period as enum
    ('first_half', 'second_half', 'extra_first', 'extra_second', 'penalties');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.matchday_status as enum ('upcoming', 'open', 'locked', 'finalised');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- Shared trigger: keep updated_at current
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Profiles: one row per auth user, created automatically on first sign-in
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  email        text,
  avatar_url   text,
  role         public.app_role not null default 'user',
  year_group   smallint check (year_group between 1 and 5),
  created_at   timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);

-- -----------------------------------------------------------------------------
-- Role helpers. SECURITY DEFINER so policies can call them without recursing
-- into the profiles policies. Officials and admins both count as officials.
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_official()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('official', 'admin')
  );
$$;

-- -----------------------------------------------------------------------------
-- Create a profile when someone signs in with Google for the first time
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Anyone who signed in before this migration ran also gets a profile.
insert into public.profiles (id, email, display_name, avatar_url)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', split_part(u.email, '@', 1)),
  coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture')
from auth.users u
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Role changes. Requests from the app (auth.uid() is set):
--   * nobody can change their own role,
--   * only admins can change anyone's role,
--   * nobody can grant 'admin' (Tayo sets admins in the SQL editor, where
--     auth.uid() is null, so this guard does not apply there).
-- -----------------------------------------------------------------------------
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null then
    if new.id = auth.uid() then
      raise exception 'You cannot change your own role';
    end if;
    if not public.is_admin() then
      raise exception 'Only an admin can change roles';
    end if;
    if new.role = 'admin' or old.role = 'admin' then
      raise exception 'Admin can only be granted or removed in the database';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- -----------------------------------------------------------------------------
-- Teams: the five year groups, shared by every sport
-- -----------------------------------------------------------------------------
create table if not exists public.teams (
  id          uuid primary key default gen_random_uuid(),
  year        smallint not null unique check (year between 1 and 5),
  name        text not null,
  short_name  text not null,
  class_label text not null,
  coaches     text[] not null default '{}',
  created_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Players (football squads). Prices are tenths of a million naira:
-- 55 = N5.5m. Allowed: 4.0 to 10.0 in steps of 0.5.
-- -----------------------------------------------------------------------------
create table if not exists public.players (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid not null references public.teams (id) on delete restrict,
  full_name     text not null,
  display_name  text not null,
  position      public.player_position not null,
  shirt_number  smallint check (shirt_number between 0 and 99),
  price_tenths  smallint not null default 50
                check (price_tenths between 40 and 100 and price_tenths % 5 = 0),
  status        public.player_status not null default 'available',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (team_id, display_name)
);

create index if not exists players_team_id_idx on public.players (team_id);
create index if not exists players_position_idx on public.players (position);

drop trigger if exists players_set_updated_at on public.players;
create trigger players_set_updated_at
  before update on public.players
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Sports and events (one sport can hold several events, e.g. 100 m men)
-- -----------------------------------------------------------------------------
create table if not exists public.sports (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  result_format public.result_format not null,
  sort_order    smallint not null default 0
);

create table if not exists public.events (
  id             uuid primary key default gen_random_uuid(),
  sport_id       uuid not null references public.sports (id) on delete cascade,
  slug           text not null,
  name           text not null,
  period_minutes smallint check (period_minutes > 0),
  period_count   smallint check (period_count > 0),
  created_at     timestamptz not null default now(),
  unique (sport_id, slug)
);

create index if not exists events_sport_id_idx on public.events (sport_id);

-- -----------------------------------------------------------------------------
-- Fantasy matchdays (football). Mary owns the logic; deadline_at is kept at
-- 30 minutes before the matchday's first kickoff.
-- -----------------------------------------------------------------------------
create table if not exists public.matchdays (
  id          uuid primary key default gen_random_uuid(),
  number      smallint not null unique check (number > 0),
  name        text not null,
  deadline_at timestamptz,
  status      public.matchday_status not null default 'upcoming'
);

-- -----------------------------------------------------------------------------
-- Fixtures: every match, race or game in every sport.
-- Score, period and winner columns are written only by Bolu's trigger and
-- console functions. Schedule columns are written by the admin portal.
-- -----------------------------------------------------------------------------
create table if not exists public.fixtures (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid not null references public.events (id) on delete restrict,
  stage             text not null default 'league',
  home_team_id      uuid references public.teams (id) on delete restrict,
  away_team_id      uuid references public.teams (id) on delete restrict,
  kickoff_at        timestamptz,
  venue             text,
  status            public.fixture_status not null default 'scheduled',
  matchday_id       uuid references public.matchdays (id) on delete set null,
  console_holder    uuid references public.profiles (id) on delete set null,
  home_score        smallint,
  away_score        smallint,
  current_period    public.match_period,
  period_started_at timestamptz,
  winner_team_id    uuid references public.teams (id) on delete set null,
  result_note       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (home_team_id is null or away_team_id is null or home_team_id <> away_team_id)
);

create index if not exists fixtures_event_id_idx       on public.fixtures (event_id);
create index if not exists fixtures_home_team_id_idx   on public.fixtures (home_team_id);
create index if not exists fixtures_away_team_id_idx   on public.fixtures (away_team_id);
create index if not exists fixtures_matchday_id_idx    on public.fixtures (matchday_id);
create index if not exists fixtures_console_holder_idx on public.fixtures (console_holder);
create index if not exists fixtures_winner_team_id_idx on public.fixtures (winner_team_id);
create index if not exists fixtures_kickoff_at_idx     on public.fixtures (kickoff_at);
create index if not exists fixtures_status_idx         on public.fixtures (status);

drop trigger if exists fixtures_set_updated_at on public.fixtures;
create trigger fixtures_set_updated_at
  before update on public.fixtures
  for each row execute function public.set_updated_at();

-- True for the fixture's console holder, and for admins as a fallback.
create or replace function public.holds_fixture(p_fixture_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or exists (
    select 1 from public.fixtures
    where id = p_fixture_id and console_holder = auth.uid()
  );
$$;

-- -----------------------------------------------------------------------------
-- Public view of profiles: only what rankings and leagues may show.
-- Runs with the view owner's rights on purpose, so emails stay private.
-- -----------------------------------------------------------------------------
create or replace view public.public_profiles as
  select id, display_name, avatar_url, year_group
  from public.profiles;

grant select on public.public_profiles to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Row-level security
-- -----------------------------------------------------------------------------
alter table public.profiles  enable row level security;
alter table public.teams     enable row level security;
alter table public.players   enable row level security;
alter table public.sports    enable row level security;
alter table public.events    enable row level security;
alter table public.matchdays enable row level security;
alter table public.fixtures  enable row level security;

-- profiles: you see and edit your own row; admins see and edit everyone's.
drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile" on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists "Admins read all profiles" on public.profiles;
create policy "Admins read all profiles" on public.profiles
  for select to authenticated using (public.is_admin());

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "Admins update any profile" on public.profiles;
create policy "Admins update any profile" on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Reference tables: anyone (signed in or not) reads; only admins write.
drop policy if exists "Anyone reads teams" on public.teams;
create policy "Anyone reads teams" on public.teams
  for select to anon, authenticated using (true);
drop policy if exists "Admins manage teams" on public.teams;
create policy "Admins manage teams" on public.teams
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Anyone reads players" on public.players;
create policy "Anyone reads players" on public.players
  for select to anon, authenticated using (true);
drop policy if exists "Admins manage players" on public.players;
create policy "Admins manage players" on public.players
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Anyone reads sports" on public.sports;
create policy "Anyone reads sports" on public.sports
  for select to anon, authenticated using (true);
drop policy if exists "Admins manage sports" on public.sports;
create policy "Admins manage sports" on public.sports
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Anyone reads events" on public.events;
create policy "Anyone reads events" on public.events
  for select to anon, authenticated using (true);
drop policy if exists "Admins manage events" on public.events;
create policy "Admins manage events" on public.events
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Anyone reads matchdays" on public.matchdays;
create policy "Anyone reads matchdays" on public.matchdays
  for select to anon, authenticated using (true);
drop policy if exists "Admins manage matchdays" on public.matchdays;
create policy "Admins manage matchdays" on public.matchdays
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Anyone reads fixtures" on public.fixtures;
create policy "Anyone reads fixtures" on public.fixtures
  for select to anon, authenticated using (true);
drop policy if exists "Admins manage fixtures" on public.fixtures;
create policy "Admins manage fixtures" on public.fixtures
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Role helpers are callable from policies and from the app.
grant execute on function public.is_admin()          to anon, authenticated;
grant execute on function public.is_official()       to anon, authenticated;
grant execute on function public.holds_fixture(uuid) to anon, authenticated;
