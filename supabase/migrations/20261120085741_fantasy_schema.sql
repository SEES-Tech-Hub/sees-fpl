-- =============================================================================
-- Fantasy schema (F1 - F8)
-- Owner: Mary (fantasy backend)
-- PRD: "Feature: SEES Fantasy (football)", "Fantasy build order"
--
-- Creates:
--   * fantasy_rules (single-row config table; no hardcoded rule constants)
--   * managers (one fantasy manager profile per signed-in user)
--   * squads (each manager's current 15-player roster)
--   * picks (per-matchday snapshot of starting 11, bench order 1..4, C & VC)
--   * transfers (transfer history and -4 pt hit tracking per matchday)
--   * chips (wildcard usage tracking)
--   * manager_matchday_points (provisional and finalised scores per matchday)
--   * leagues & league_members (private 6-char invite code mini-leagues)
--
-- Every table has RLS enabled, foreign keys indexed, and safe to run twice.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.fantasy_chip_type as enum ('wildcard');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- 1. fantasy_rules: single-row configuration table (F1)
-- All money values in tenths of a million naira (1000 = N100.0m) to match
-- players.price_tenths.
-- -----------------------------------------------------------------------------
create table if not exists public.fantasy_rules (
  id                          smallint primary key default 1 check (id = 1),
  squad_size                  smallint not null default 15,
  budget_tenths               smallint not null default 1000,
  max_per_team                smallint not null default 4,
  gk_quota                    smallint not null default 2,
  def_quota                   smallint not null default 5,
  mid_quota                   smallint not null default 5,
  fwd_quota                   smallint not null default 3,
  starting_size               smallint not null default 11,
  min_start_gk                smallint not null default 1,
  max_start_gk                smallint not null default 1,
  min_start_def               smallint not null default 3,
  max_start_def               smallint not null default 5,
  min_start_mid               smallint not null default 2,
  max_start_mid               smallint not null default 5,
  min_start_fwd               smallint not null default 1,
  max_start_fwd               smallint not null default 3,
  free_transfers_per_md       smallint not null default 1,
  max_saved_transfers         smallint not null default 2,
  extra_transfer_cost         smallint not null default 4,
  captain_multiplier          smallint not null default 2,
  min_minutes_threshold       smallint not null default 30,
  pts_appearance              smallint not null default 1,
  pts_30_mins                 smallint not null default 1,
  pts_goal_gk                 smallint not null default 6,
  pts_goal_def                smallint not null default 6,
  pts_goal_mid                smallint not null default 5,
  pts_goal_fwd                smallint not null default 4,
  pts_assist                  smallint not null default 3,
  pts_clean_sheet_gk          smallint not null default 4,
  pts_clean_sheet_def         smallint not null default 4,
  pts_clean_sheet_mid         smallint not null default 1,
  pts_clean_sheet_fwd         smallint not null default 0,
  pts_goals_conceded_step     smallint not null default 2,
  pts_goals_conceded_gk       smallint not null default -1,
  pts_goals_conceded_def      smallint not null default -1,
  pts_goals_conceded_mid      smallint not null default 0,
  pts_goals_conceded_fwd      smallint not null default 0,
  pts_penalty_save            smallint not null default 5,
  pts_penalty_miss            smallint not null default -2,
  pts_yellow_card             smallint not null default -1,
  pts_red_card                smallint not null default -3,
  pts_own_goal                smallint not null default -2,
  pts_motm                    smallint not null default 3,
  updated_at                  timestamptz not null default now()
);

drop trigger if exists fantasy_rules_set_updated_at on public.fantasy_rules;
create trigger fantasy_rules_set_updated_at
  before update on public.fantasy_rules
  for each row execute function public.set_updated_at();

-- Seed default rules row (safe to re-run)
insert into public.fantasy_rules (id)
values (1)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 2. managers: one fantasy manager account per signed-in user
-- -----------------------------------------------------------------------------
create table if not exists public.managers (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null unique references public.profiles (id) on delete cascade,
  team_name       text not null check (char_length(btrim(team_name)) between 2 and 30),
  year_group      smallint check (year_group between 1 and 5),
  free_transfers  smallint not null default 1 check (free_transfers >= 0),
  wildcard_used   boolean not null default false,
  total_points    integer not null default 0,
  overall_rank    integer,
  year_rank       integer,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists managers_user_id_idx      on public.managers (user_id);
create index if not exists managers_total_points_idx on public.managers (total_points desc);
create index if not exists managers_year_group_idx   on public.managers (year_group, total_points desc);

drop trigger if exists managers_set_updated_at on public.managers;
create trigger managers_set_updated_at
  before update on public.managers
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. squads: each manager's active 15-player squad
-- -----------------------------------------------------------------------------
create table if not exists public.squads (
  manager_id uuid not null references public.managers (id) on delete cascade,
  player_id  uuid not null references public.players (id) on delete restrict,
  added_at   timestamptz not null default now(),
  primary key (manager_id, player_id)
);

create index if not exists squads_player_id_idx on public.squads (player_id);

-- -----------------------------------------------------------------------------
-- 4. picks: immutable per-matchday snapshot of lineup, bench order, C & VC (F3/F4)
-- bench_order is 1..4 for bench players and null for starters.
-- -----------------------------------------------------------------------------
create table if not exists public.picks (
  id              uuid primary key default gen_random_uuid(),
  manager_id      uuid not null references public.managers (id) on delete cascade,
  matchday_id     uuid not null references public.matchdays (id) on delete cascade,
  player_id       uuid not null references public.players (id) on delete restrict,
  is_starter      boolean not null,
  bench_order     smallint check (
                    (is_starter = true and bench_order is null) or
                    (is_starter = false and bench_order between 1 and 4)
                  ),
  is_captain      boolean not null default false,
  is_vice_captain boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (manager_id, matchday_id, player_id),
  check (not (is_captain and is_vice_captain)),
  check (not (is_captain and not is_starter)),
  check (not (is_vice_captain and not is_starter))
);

create index if not exists picks_manager_id_idx  on public.picks (manager_id);
create index if not exists picks_matchday_id_idx on public.picks (matchday_id);
create index if not exists picks_player_id_idx   on public.picks (player_id);

drop trigger if exists picks_set_updated_at on public.picks;
create trigger picks_set_updated_at
  before update on public.picks
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 5. transfers: player swaps made for a target matchday (F7)
-- -----------------------------------------------------------------------------
create table if not exists public.transfers (
  id            uuid primary key default gen_random_uuid(),
  manager_id    uuid not null references public.managers (id) on delete cascade,
  matchday_id   uuid not null references public.matchdays (id) on delete cascade,
  player_out_id uuid not null references public.players (id) on delete restrict,
  player_in_id  uuid not null references public.players (id) on delete restrict,
  points_cost   smallint not null default 0 check (points_cost >= 0),
  created_at    timestamptz not null default now(),
  check (player_out_id <> player_in_id)
);

create index if not exists transfers_manager_id_idx    on public.transfers (manager_id);
create index if not exists transfers_matchday_id_idx   on public.transfers (matchday_id);
create index if not exists transfers_player_out_id_idx on public.transfers (player_out_id);
create index if not exists transfers_player_in_id_idx  on public.transfers (player_in_id);

-- -----------------------------------------------------------------------------
-- 6. chips: power-ups activated for a matchday (Wildcard) (F8)
-- -----------------------------------------------------------------------------
create table if not exists public.chips (
  id          uuid primary key default gen_random_uuid(),
  manager_id  uuid not null references public.managers (id) on delete cascade,
  matchday_id uuid not null references public.matchdays (id) on delete cascade,
  chip_type   public.fantasy_chip_type not null,
  created_at  timestamptz not null default now(),
  unique (manager_id, chip_type),
  unique (manager_id, matchday_id)
);

create index if not exists chips_manager_id_idx  on public.chips (manager_id);
create index if not exists chips_matchday_id_idx on public.chips (matchday_id);

-- -----------------------------------------------------------------------------
-- 7. manager_matchday_points: provisional & finalised matchday scores (F5/F6)
-- -----------------------------------------------------------------------------
create table if not exists public.manager_matchday_points (
  manager_id     uuid not null references public.managers (id) on delete cascade,
  matchday_id    uuid not null references public.matchdays (id) on delete cascade,
  gross_points   integer not null default 0,
  transfer_cost  integer not null default 0,
  net_points     integer not null default 0,
  is_provisional boolean not null default true,
  breakdown      jsonb not null default '[]'::jsonb,
  calculated_at  timestamptz not null default now(),
  primary key (manager_id, matchday_id)
);

create index if not exists manager_matchday_points_matchday_idx
  on public.manager_matchday_points (matchday_id, net_points desc);

-- -----------------------------------------------------------------------------
-- 8. leagues & league_members: private mini-leagues (F8)
-- -----------------------------------------------------------------------------
create table if not exists public.leagues (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 2 and 40),
  invite_code text not null unique check (char_length(invite_code) = 6),
  created_by  uuid not null references public.managers (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index if not exists leagues_created_by_idx on public.leagues (created_by);

create table if not exists public.league_members (
  league_id  uuid not null references public.leagues (id) on delete cascade,
  manager_id uuid not null references public.managers (id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (league_id, manager_id)
);

create index if not exists league_members_manager_id_idx on public.league_members (manager_id);

-- -----------------------------------------------------------------------------
-- Row-Level Security (RLS)
-- -----------------------------------------------------------------------------
alter table public.fantasy_rules           enable row level security;
alter table public.managers                enable row level security;
alter table public.squads                  enable row level security;
alter table public.picks                   enable row level security;
alter table public.transfers               enable row level security;
alter table public.chips                   enable row level security;
alter table public.manager_matchday_points enable row level security;
alter table public.leagues                 enable row level security;
alter table public.league_members          enable row level security;

-- fantasy_rules: everyone reads; only admins write
drop policy if exists "Anyone reads fantasy rules" on public.fantasy_rules;
create policy "Anyone reads fantasy rules" on public.fantasy_rules
  for select to anon, authenticated using (true);

drop policy if exists "Admins manage fantasy rules" on public.fantasy_rules;
create policy "Admins manage fantasy rules" on public.fantasy_rules
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- managers: everyone reads rankings; signed-in user manages own row
drop policy if exists "Anyone reads managers" on public.managers;
create policy "Anyone reads managers" on public.managers
  for select to anon, authenticated using (true);

drop policy if exists "Users insert own manager" on public.managers;
create policy "Users insert own manager" on public.managers
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "Users update own manager" on public.managers;
create policy "Users update own manager" on public.managers
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Admins manage all managers" on public.managers;
create policy "Admins manage all managers" on public.managers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- squads: owner reads/writes own squad; admins manage all
drop policy if exists "Users read own squad" on public.squads;
create policy "Users read own squad" on public.squads
  for select to authenticated using (
    exists (select 1 from public.managers m where m.id = manager_id and m.user_id = auth.uid())
  );

drop policy if exists "Users manage own squad" on public.squads;
create policy "Users manage own squad" on public.squads
  for all to authenticated
  using (exists (select 1 from public.managers m where m.id = manager_id and m.user_id = auth.uid()))
  with check (exists (select 1 from public.managers m where m.id = manager_id and m.user_id = auth.uid()));

drop policy if exists "Admins manage all squads" on public.squads;
create policy "Admins manage all squads" on public.squads
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- picks: owner always reads own picks; others read picks only after deadline
drop policy if exists "Users read own picks" on public.picks;
create policy "Users read own picks" on public.picks
  for select to authenticated using (
    exists (select 1 from public.managers m where m.id = manager_id and m.user_id = auth.uid())
  );

drop policy if exists "Anyone reads locked picks" on public.picks;
create policy "Anyone reads locked picks" on public.picks
  for select to anon, authenticated using (
    exists (
      select 1 from public.matchdays md
      where md.id = matchday_id
        and (md.status in ('locked', 'finalised') or (md.deadline_at is not null and md.deadline_at <= now()))
    )
  );

drop policy if exists "Users manage own picks before deadline" on public.picks;
create policy "Users manage own picks before deadline" on public.picks
  for all to authenticated
  using (
    exists (select 1 from public.managers m where m.id = manager_id and m.user_id = auth.uid())
    and exists (
      select 1 from public.matchdays md
      where md.id = matchday_id
        and md.status in ('upcoming', 'open')
        and (md.deadline_at is null or md.deadline_at > now())
    )
  )
  with check (
    exists (select 1 from public.managers m where m.id = manager_id and m.user_id = auth.uid())
    and exists (
      select 1 from public.matchdays md
      where md.id = matchday_id
        and md.status in ('upcoming', 'open')
        and (md.deadline_at is null or md.deadline_at > now())
    )
  );

drop policy if exists "Admins manage all picks" on public.picks;
create policy "Admins manage all picks" on public.picks
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- transfers: owner reads/inserts own transfers; anyone reads after deadline
drop policy if exists "Users read own transfers" on public.transfers;
create policy "Users read own transfers" on public.transfers
  for select to authenticated using (
    exists (select 1 from public.managers m where m.id = manager_id and m.user_id = auth.uid())
  );

drop policy if exists "Anyone reads locked transfers" on public.transfers;
create policy "Anyone reads locked transfers" on public.transfers
  for select to anon, authenticated using (
    exists (
      select 1 from public.matchdays md
      where md.id = matchday_id
        and (md.status in ('locked', 'finalised') or (md.deadline_at is not null and md.deadline_at <= now()))
    )
  );

drop policy if exists "Users insert own transfers" on public.transfers;
create policy "Users insert own transfers" on public.transfers
  for insert to authenticated with check (
    exists (select 1 from public.managers m where m.id = manager_id and m.user_id = auth.uid())
  );

drop policy if exists "Admins manage all transfers" on public.transfers;
create policy "Admins manage all transfers" on public.transfers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- chips: owner reads/inserts own chips; anyone reads after deadline
drop policy if exists "Users read own chips" on public.chips;
create policy "Users read own chips" on public.chips
  for select to authenticated using (
    exists (select 1 from public.managers m where m.id = manager_id and m.user_id = auth.uid())
  );

drop policy if exists "Anyone reads locked chips" on public.chips;
create policy "Anyone reads locked chips" on public.chips
  for select to anon, authenticated using (
    exists (
      select 1 from public.matchdays md
      where md.id = matchday_id
        and (md.status in ('locked', 'finalised') or (md.deadline_at is not null and md.deadline_at <= now()))
    )
  );

drop policy if exists "Users insert own chips" on public.chips;
create policy "Users insert own chips" on public.chips
  for insert to authenticated with check (
    exists (select 1 from public.managers m where m.id = manager_id and m.user_id = auth.uid())
  );

drop policy if exists "Admins manage all chips" on public.chips;
create policy "Admins manage all chips" on public.chips
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- manager_matchday_points: public read; writes via server/admin
drop policy if exists "Anyone reads matchday points" on public.manager_matchday_points;
create policy "Anyone reads matchday points" on public.manager_matchday_points
  for select to anon, authenticated using (true);

drop policy if exists "Admins manage matchday points" on public.manager_matchday_points;
create policy "Admins manage matchday points" on public.manager_matchday_points
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- leagues: anyone reads; authenticated users create
drop policy if exists "Anyone reads leagues" on public.leagues;
create policy "Anyone reads leagues" on public.leagues
  for select to anon, authenticated using (true);

drop policy if exists "Users create leagues" on public.leagues;
create policy "Users create leagues" on public.leagues
  for insert to authenticated with check (
    exists (select 1 from public.managers m where m.id = created_by and m.user_id = auth.uid())
  );

drop policy if exists "Admins manage leagues" on public.leagues;
create policy "Admins manage leagues" on public.leagues
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- league_members: anyone reads; users join/leave for themselves
drop policy if exists "Anyone reads league members" on public.league_members;
create policy "Anyone reads league members" on public.league_members
  for select to anon, authenticated using (true);

drop policy if exists "Users join leagues" on public.league_members;
create policy "Users join leagues" on public.league_members
  for insert to authenticated with check (
    exists (select 1 from public.managers m where m.id = manager_id and m.user_id = auth.uid())
  );

drop policy if exists "Users leave leagues" on public.league_members;
create policy "Users leave leagues" on public.league_members
  for delete to authenticated using (
    exists (select 1 from public.managers m where m.id = manager_id and m.user_id = auth.uid())
  );

drop policy if exists "Admins manage league members" on public.league_members;
create policy "Admins manage league members" on public.league_members
  for all to authenticated using (public.is_admin()) with check (public.is_admin());