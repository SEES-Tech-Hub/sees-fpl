-- =============================================================================
-- Fantasy schema (F1 - F8)
-- Owner: Mary (fantasy backend)
--
-- Security model:
--   * All user writes go through SECURITY DEFINER RPCs (create_manager,
--     save_squad, save_lineup, make_transfers, activate_wildcard,
--     create_league, join_league) that enforce every rule in SQL.
--   * Direct INSERT/UPDATE/DELETE policies for normal users are removed on
--     managers, squads, picks, transfers, chips, leagues, and league_members.
--   * leagues.invite_code is only readable by members of that league.
-- =============================================================================

do $$ begin
  create type public.fantasy_chip_type as enum ('wildcard');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- 1. fantasy_rules: single-row configuration table (F1)
-- -----------------------------------------------------------------------------
create table if not exists public.fantasy_rules (
  id                           smallint primary key default 1 check (id = 1),
  squad_size                   smallint not null default 15,
  budget_tenths                smallint not null default 1000,
  max_per_team                 smallint not null default 4,
  gk_quota                     smallint not null default 2,
  def_quota                    smallint not null default 5,
  mid_quota                    smallint not null default 5,
  fwd_quota                    smallint not null default 3,
  starting_size                smallint not null default 11,
  min_start_gk                 smallint not null default 1,
  max_start_gk                 smallint not null default 1,
  min_start_def                smallint not null default 3,
  max_start_def                smallint not null default 5,
  min_start_mid                smallint not null default 2,
  max_start_mid                smallint not null default 5,
  min_start_fwd                smallint not null default 1,
  max_start_fwd                smallint not null default 3,
  free_transfers_per_md        smallint not null default 1,
  max_saved_transfers          smallint not null default 2,
  extra_transfer_cost          smallint not null default 4,
  unlimited_transfer_matchdays smallint[] not null default '{1,6}',
  captain_multiplier           smallint not null default 2,
  min_minutes_threshold        smallint not null default 30,
  pts_appearance               smallint not null default 1,
  pts_30_mins                  smallint not null default 1,
  pts_goal_gk                  smallint not null default 6,
  pts_goal_def                 smallint not null default 6,
  pts_goal_mid                 smallint not null default 5,
  pts_goal_fwd                 smallint not null default 4,
  pts_assist                   smallint not null default 3,
  pts_clean_sheet_gk           smallint not null default 4,
  pts_clean_sheet_def          smallint not null default 4,
  pts_clean_sheet_mid          smallint not null default 1,
  pts_clean_sheet_fwd          smallint not null default 0,
  pts_goals_conceded_step      smallint not null default 2,
  pts_goals_conceded_gk        smallint not null default -1,
  pts_goals_conceded_def       smallint not null default -1,
  pts_goals_conceded_mid       smallint not null default 0,
  pts_goals_conceded_fwd       smallint not null default 0,
  pts_penalty_save             smallint not null default 5,
  pts_penalty_miss             smallint not null default -2,
  pts_yellow_card              smallint not null default -1,
  pts_red_card                 smallint not null default -3,
  pts_own_goal                 smallint not null default -2,
  pts_motm                     smallint not null default 3,
  updated_at                   timestamptz not null default now()
);

alter table public.fantasy_rules
  add column if not exists unlimited_transfer_matchdays smallint[] not null default '{1,6}';

drop trigger if exists fantasy_rules_set_updated_at on public.fantasy_rules;
create trigger fantasy_rules_set_updated_at
  before update on public.fantasy_rules
  for each row execute function public.set_updated_at();

insert into public.fantasy_rules (id)
values (1)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 2. managers: one fantasy manager account per signed-in user
-- -----------------------------------------------------------------------------
create table if not exists public.managers (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null unique references public.profiles (id) on delete cascade,
  team_name                text not null check (char_length(btrim(team_name)) between 2 and 30),
  year_group               smallint check (year_group between 1 and 5),
  free_transfers           smallint not null default 1 check (free_transfers >= 0),
  last_rollover_matchday   smallint not null default 1,
  wildcard_used            boolean not null default false,
  total_points             integer not null default 0,
  overall_rank             integer,
  year_rank                integer,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

alter table public.managers
  add column if not exists last_rollover_matchday smallint not null default 1;

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
-- 4. picks: per-matchday snapshot of lineup, bench order, C & VC (F3/F4)
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

-- Enforce at most 1 captain and 1 vice-captain per manager per matchday
create unique index if not exists picks_one_captain_per_md_idx
  on public.picks (manager_id, matchday_id) where (is_captain = true);
create unique index if not exists picks_one_vice_captain_per_md_idx
  on public.picks (manager_id, matchday_id) where (is_vice_captain = true);

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
-- Internal SQL helpers (not callable directly by anon/authenticated)
-- -----------------------------------------------------------------------------
create or replace function public.fantasy_fail(p_code text, p_message text)
returns void
language plpgsql
as $$
begin
  raise exception '%: %', p_code, p_message using errcode = 'P0001';
end;
$$;

-- Returns the next open matchday (earliest deadline still in the future).
create or replace function public.fantasy_get_open_matchday()
returns public.matchdays
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_md public.matchdays%rowtype;
begin
  select * into v_md
  from public.matchdays
  where status in ('upcoming', 'open')
    and (deadline_at is null or deadline_at > now())
  order by number asc
  limit 1;

  if not found then
    perform public.fantasy_fail('DEADLINE_PASSED', 'No open matchday is available right now.');
  end if;

  return v_md;
end;
$$;

-- Carries forward the manager's latest saved picks into p_matchday_id if missing,
-- and applies free-transfer rollovers at passed deadlines (MD2 starts with 1).
create or replace function public.fantasy_sync_manager_for_matchday(
  p_manager_id uuid,
  p_target_md  public.matchdays
)
returns public.managers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mgr        public.managers%rowtype;
  v_rules      public.fantasy_rules%rowtype;
  v_prev_md_id uuid;
  v_passed_cnt integer;
begin
  select * into v_mgr from public.managers where id = p_manager_id for update;
  select * into v_rules from public.fantasy_rules where id = 1;

  -- Rollover free transfers for each matchday whose deadline has passed since last sync.
  -- MD1 is unlimited, so passing MD1 leaves MD2 at 1 free transfer (not 2).
  if p_target_md.number > v_mgr.last_rollover_matchday then
    select count(*) into v_passed_cnt
    from public.matchdays md
    where md.number > greatest(1, v_mgr.last_rollover_matchday)
      and md.number <= p_target_md.number
      and md.deadline_at is not null
      and md.deadline_at <= now()
      and not (md.number = any(v_rules.unlimited_transfer_matchdays));

    if v_passed_cnt > 0 then
      v_mgr.free_transfers := least(
        v_rules.max_saved_transfers,
        v_mgr.free_transfers + (v_passed_cnt * v_rules.free_transfers_per_md)
      );
    end if;

    update public.managers
    set free_transfers = v_mgr.free_transfers,
        last_rollover_matchday = greatest(
          v_mgr.last_rollover_matchday,
          coalesce((
            select max(md.number)
            from public.matchdays md
            where md.number > v_mgr.last_rollover_matchday
              and md.number <= p_target_md.number
              and md.deadline_at is not null
              and md.deadline_at <= now()
          ), v_mgr.last_rollover_matchday)
        )
    where id = v_mgr.id
    returning * into v_mgr;
  end if;

  -- If the manager has a squad but no picks row yet for p_target_md, copy their
  -- most recent matchday's picks forward so lineups persist across matchdays.
  if exists (select 1 from public.squads where manager_id = v_mgr.id)
     and not exists (
       select 1 from public.picks
       where manager_id = v_mgr.id and matchday_id = p_target_md.id
     ) then
    select pk.matchday_id into v_prev_md_id
    from public.picks pk
    join public.matchdays md on md.id = pk.matchday_id
    where pk.manager_id = v_mgr.id
      and md.number < p_target_md.number
    order by md.number desc
    limit 1;

    if v_prev_md_id is not null then
      insert into public.picks (
        manager_id, matchday_id, player_id, is_starter, bench_order, is_captain, is_vice_captain
      )
      select
        v_mgr.id, p_target_md.id, pk.player_id, pk.is_starter, pk.bench_order, pk.is_captain, pk.is_vice_captain
      from public.picks pk
      where pk.manager_id = v_mgr.id and pk.matchday_id = v_prev_md_id;
    end if;
  end if;

  return v_mgr;
end;
$$;

-- Called before scoring a matchday so every manager who didn't open the app
-- still gets their previous matchday's lineup copied forward before scoring.
create or replace function public.fantasy_prepare_matchday_snapshots(p_matchday_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_md  public.matchdays%rowtype;
  v_mgr record;
begin
  select * into v_md from public.matchdays where id = p_matchday_id;
  if not found then
    perform public.fantasy_fail('MATCHDAY_NOT_FOUND', 'Matchday not found.');
  end if;

  for v_mgr in select id from public.managers loop
    perform public.fantasy_sync_manager_for_matchday(v_mgr.id, v_md);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 7 SECURITY DEFINER RPCs (Henry's contract: docs/fantasy-backend-contract.md)
-- -----------------------------------------------------------------------------

-- 1. create_manager
create or replace function public.create_manager(
  p_team_name  text,
  p_year_group smallint default null
)
returns public.managers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_name    text := btrim(coalesce(p_team_name, ''));
  v_year    smallint;
  v_manager public.managers%rowtype;
begin
  if v_uid is null then
    perform public.fantasy_fail('NOT_SIGNED_IN', 'Sign in to create a fantasy team.');
  end if;

  if exists (select 1 from public.managers where user_id = v_uid) then
    perform public.fantasy_fail('MANAGER_EXISTS', 'You already have a fantasy team.');
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 30 then
    perform public.fantasy_fail('TEAM_NAME_INVALID', 'Team name must be between 2 and 30 characters.');
  end if;

  if p_year_group is not null and (p_year_group < 1 or p_year_group > 5) then
    perform public.fantasy_fail('YEAR_GROUP_INVALID', 'Year group must be between 1 and 5.');
  end if;

  if p_year_group is not null then
    update public.profiles set year_group = p_year_group where id = v_uid;
    v_year := p_year_group;
  else
    select year_group into v_year from public.profiles where id = v_uid;
  end if;

  insert into public.managers (user_id, team_name, year_group, free_transfers, last_rollover_matchday)
  values (v_uid, v_name, v_year, 1, 1)
  returning * into v_manager;

  return v_manager;
end;
$$;

-- 2. save_squad (initial 15-player squad; blocked once a squad already exists)
create or replace function public.save_squad(
  p_player_ids uuid[],
  p_picks      jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid         uuid := auth.uid();
  v_mgr         public.managers%rowtype;
  v_rules       public.fantasy_rules%rowtype;
  v_md          public.matchdays%rowtype;
  v_distinct    int;
  v_found_cnt   int;
  v_total_cost  int;
  v_gk_cnt      int;
  v_def_cnt     int;
  v_mid_cnt     int;
  v_fwd_cnt     int;
  v_max_team    int;
  v_pick        jsonb;
  v_starters    int := 0;
  v_bench_cnt   int := 0;
  v_cap_cnt     int := 0;
  v_vc_cnt      int := 0;
  v_s_gk        int := 0;
  v_s_def       int := 0;
  v_s_mid       int := 0;
  v_s_fwd       int := 0;
  v_pos         public.player_position;
  v_pid         uuid;
  v_is_starter  boolean;
  v_bench_order smallint;
  v_is_cap      boolean;
  v_is_vc       boolean;
  v_bench_idx   smallint := 1;
  v_rec         record;
begin
  if v_uid is null then
    perform public.fantasy_fail('NOT_SIGNED_IN', 'Sign in to save your squad.');
  end if;

  select * into v_mgr from public.managers where user_id = v_uid for update;
  if not found then
    perform public.fantasy_fail('NO_MANAGER', 'Create your team first.');
  end if;

  if exists (select 1 from public.squads where manager_id = v_mgr.id) then
    perform public.fantasy_fail('SQUAD_EXISTS', 'You already have a squad. Use Transfers to change it.');
  end if;

  select * into v_rules from public.fantasy_rules where id = 1;
  v_md := public.fantasy_get_open_matchday();

  v_distinct := coalesce((select count(distinct x) from unnest(p_player_ids) x), 0);
  if coalesce(array_length(p_player_ids, 1), 0) <> v_distinct then
    perform public.fantasy_fail('PLAYER_DUPLICATE', 'Your squad cannot contain duplicate players.');
  end if;
  if v_distinct <> v_rules.squad_size then
    perform public.fantasy_fail('SQUAD_SIZE', format('Pick %s players. You have %s.', v_rules.squad_size, v_distinct));
  end if;

  select
    count(*),
    coalesce(sum(price_tenths), 0),
    count(*) filter (where position = 'GK'),
    count(*) filter (where position = 'DEF'),
    count(*) filter (where position = 'MID'),
    count(*) filter (where position = 'FWD')
  into v_found_cnt, v_total_cost, v_gk_cnt, v_def_cnt, v_mid_cnt, v_fwd_cnt
  from public.players
  where id = any(p_player_ids);

  if v_found_cnt <> v_rules.squad_size then
    perform public.fantasy_fail('PLAYER_UNKNOWN', 'One or more selected players do not exist.');
  end if;

  if exists (
    select 1 from public.players
    where id = any(p_player_ids) and status = 'left'
  ) then
    perform public.fantasy_fail('PLAYER_UNAVAILABLE', 'One or more selected players have left the competition.');
  end if;

  if v_gk_cnt <> v_rules.gk_quota
     or v_def_cnt <> v_rules.def_quota
     or v_mid_cnt <> v_rules.mid_quota
     or v_fwd_cnt <> v_rules.fwd_quota then
    perform public.fantasy_fail('SQUAD_POSITIONS',
      format('You need %s GK, %s DEF, %s MID, %s FWD.', v_rules.gk_quota, v_rules.def_quota, v_rules.mid_quota, v_rules.fwd_quota));
  end if;

  if v_total_cost > v_rules.budget_tenths then
    perform public.fantasy_fail('OVER_BUDGET',
      format('Your squad costs ₦%sm. The budget is ₦%sm.',
        to_char(v_total_cost / 10.0, 'FM999990.0'),
        to_char(v_rules.budget_tenths / 10.0, 'FM999990.0')));
  end if;

  select coalesce(max(cnt), 0) into v_max_team
  from (
    select count(*) as cnt
    from public.players
    where id = any(p_player_ids)
    group by team_id
  ) t;

  if v_max_team > v_rules.max_per_team then
    perform public.fantasy_fail('TEAM_LIMIT',
      format('You can pick at most %s players from one year group.', v_rules.max_per_team));
  end if;

  insert into public.squads (manager_id, player_id)
  select v_mgr.id, x from unnest(p_player_ids) x;

  -- If explicit picks were supplied, validate and insert them; otherwise generate
  -- a valid default 4-4-2 lineup with the most expensive starters as C & VC.
  if p_picks is not null and jsonb_typeof(p_picks) = 'array' and jsonb_array_length(p_picks) > 0 then
    if jsonb_array_length(p_picks) <> v_rules.squad_size then
      perform public.fantasy_fail('LINEUP_NOT_IN_SQUAD', 'Lineup must include all 15 squad players.');
    end if;

    for v_pick in select * from jsonb_array_elements(p_picks) loop
      v_pid         := (v_pick ->> 'player_id')::uuid;
      v_is_starter  := (v_pick ->> 'is_starter')::boolean;
      v_bench_order := (v_pick ->> 'bench_order')::smallint;
      v_is_cap      := coalesce((v_pick ->> 'is_captain')::boolean, false);
      v_is_vc       := coalesce((v_pick ->> 'is_vice_captain')::boolean, false);

      if not (v_pid = any(p_player_ids)) then
        perform public.fantasy_fail('LINEUP_NOT_IN_SQUAD', 'Lineup contains a player not in your squad.');
      end if;

      select position into v_pos from public.players where id = v_pid;

      if v_is_starter then
        v_starters := v_starters + 1;
        if v_pos = 'GK' then v_s_gk := v_s_gk + 1; end if;
        if v_pos = 'DEF' then v_s_def := v_s_def + 1; end if;
        if v_pos = 'MID' then v_s_mid := v_s_mid + 1; end if;
        if v_pos = 'FWD' then v_s_fwd := v_s_fwd + 1; end if;
      else
        v_bench_cnt := v_bench_cnt + 1;
        if v_bench_order = 1 and v_pos <> 'GK' then
          perform public.fantasy_fail('BENCH_GK_INVALID', 'Bench slot 1 must be your substitute goalkeeper.');
        end if;
      end if;

      if v_is_cap then v_cap_cnt := v_cap_cnt + 1; end if;
      if v_is_vc then v_vc_cnt := v_vc_cnt + 1; end if;

      insert into public.picks (
        manager_id, matchday_id, player_id, is_starter, bench_order, is_captain, is_vice_captain
      ) values (
        v_mgr.id, v_md.id, v_pid, v_is_starter, v_bench_order, v_is_cap, v_is_vc
      );
    end loop;

    if v_starters <> v_rules.starting_size
       or v_s_gk < v_rules.min_start_gk or v_s_gk > v_rules.max_start_gk
       or v_s_def < v_rules.min_start_def or v_s_def > v_rules.max_start_def
       or v_s_mid < v_rules.min_start_mid or v_s_mid > v_rules.max_start_mid
       or v_s_fwd < v_rules.min_start_fwd or v_s_fwd > v_rules.max_start_fwd then
      perform public.fantasy_fail('FORMATION_INVALID', 'Starting XI does not match a valid formation.');
    end if;

    if v_cap_cnt <> 1 or v_vc_cnt <> 1 then
      perform public.fantasy_fail('CAPTAIN_INVALID', 'Pick exactly one captain and one vice-captain in your starting XI.');
    end if;
  else
    -- Default 4-4-2 lineup ordered by price desc, display_name asc
    v_bench_idx := 2;
    for v_rec in
      select
        p.id,
        p.position,
        row_number() over (partition by p.position order by p.price_tenths desc, p.display_name asc) as pos_rn,
        row_number() over (order by p.price_tenths desc, p.display_name asc) as overall_rn
      from public.players p
      where p.id = any(p_player_ids)
    loop
      v_is_starter := (v_rec.position = 'GK' and v_rec.pos_rn = 1)
                   or (v_rec.position = 'DEF' and v_rec.pos_rn <= 4)
                   or (v_rec.position = 'MID' and v_rec.pos_rn <= 4)
                   or (v_rec.position = 'FWD' and v_rec.pos_rn <= 2);

      if v_is_starter then
        v_bench_order := null;
      elsif v_rec.position = 'GK' then
        v_bench_order := 1;
      else
        v_bench_order := v_bench_idx;
        v_bench_idx := v_bench_idx + 1;
      end if;

      insert into public.picks (
        manager_id, matchday_id, player_id, is_starter, bench_order, is_captain, is_vice_captain
      ) values (
        v_mgr.id, v_md.id, v_rec.id, v_is_starter, v_bench_order, false, false
      );
    end loop;

    -- Assign captain & vice-captain to top 2 most expensive starters
    with top_starters as (
      select pk.id, row_number() over (order by p.price_tenths desc, p.display_name asc) as rn
      from public.picks pk
      join public.players p on p.id = pk.player_id
      where pk.manager_id = v_mgr.id and pk.matchday_id = v_md.id and pk.is_starter = true
    )
    update public.picks pk
    set is_captain = (ts.rn = 1),
        is_vice_captain = (ts.rn = 2)
    from top_starters ts
    where pk.id = ts.id and ts.rn in (1, 2);
  end if;

  update public.managers
  set last_rollover_matchday = v_md.number
  where id = v_mgr.id;

  return jsonb_build_object('saved', true, 'matchdayId', v_md.id);
end;
$$;

-- 3. save_lineup (updates starting XI, bench order, C & VC for next open matchday)
create or replace function public.save_lineup(p_picks jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid         uuid := auth.uid();
  v_mgr         public.managers%rowtype;
  v_rules       public.fantasy_rules%rowtype;
  v_md          public.matchdays%rowtype;
  v_pick        jsonb;
  v_pid         uuid;
  v_is_starter  boolean;
  v_bench_order smallint;
  v_is_cap      boolean;
  v_is_vc       boolean;
  v_pos         public.player_position;
  v_starters    int := 0;
  v_bench_cnt   int := 0;
  v_cap_cnt     int := 0;
  v_vc_cnt      int := 0;
  v_s_gk        int := 0;
  v_s_def       int := 0;
  v_s_mid       int := 0;
  v_s_fwd       int := 0;
  v_seen_ids    uuid[] := '{}';
begin
  if v_uid is null then
    perform public.fantasy_fail('NOT_SIGNED_IN', 'Sign in to update your lineup.');
  end if;

  select * into v_mgr from public.managers where user_id = v_uid for update;
  if not found then
    perform public.fantasy_fail('NO_MANAGER', 'Manager profile not found.');
  end if;

  select * into v_rules from public.fantasy_rules where id = 1;
  v_md := public.fantasy_get_open_matchday();
  v_mgr := public.fantasy_sync_manager_for_matchday(v_mgr.id, v_md);

  if p_picks is null or jsonb_typeof(p_picks) <> 'array' or jsonb_array_length(p_picks) <> v_rules.squad_size then
    perform public.fantasy_fail('LINEUP_NOT_IN_SQUAD', 'Lineup must include all 15 squad players.');
  end if;

  delete from public.picks
  where manager_id = v_mgr.id and matchday_id = v_md.id;

  for v_pick in select * from jsonb_array_elements(p_picks) loop
    v_pid         := (v_pick ->> 'player_id')::uuid;
    v_is_starter  := (v_pick ->> 'is_starter')::boolean;
    v_bench_order := (v_pick ->> 'bench_order')::smallint;
    v_is_cap      := coalesce((v_pick ->> 'is_captain')::boolean, false);
    v_is_vc       := coalesce((v_pick ->> 'is_vice_captain')::boolean, false);

    if v_pid = any(v_seen_ids) then
      perform public.fantasy_fail('LINEUP_NOT_IN_SQUAD', 'Duplicate player in lineup.');
    end if;
    v_seen_ids := array_append(v_seen_ids, v_pid);

    if not exists (select 1 from public.squads where manager_id = v_mgr.id and player_id = v_pid) then
      perform public.fantasy_fail('LINEUP_NOT_IN_SQUAD', 'Lineup contains a player not in your squad.');
    end if;

    select position into v_pos from public.players where id = v_pid;

    if v_is_starter then
      v_starters := v_starters + 1;
      if v_pos = 'GK' then v_s_gk := v_s_gk + 1; end if;
      if v_pos = 'DEF' then v_s_def := v_s_def + 1; end if;
      if v_pos = 'MID' then v_s_mid := v_s_mid + 1; end if;
      if v_pos = 'FWD' then v_s_fwd := v_s_fwd + 1; end if;
    else
      v_bench_cnt := v_bench_cnt + 1;
      if v_bench_order = 1 and v_pos <> 'GK' then
        perform public.fantasy_fail('BENCH_GK_INVALID', 'Bench slot 1 must be your substitute goalkeeper.');
      end if;
    end if;

    if v_is_cap then v_cap_cnt := v_cap_cnt + 1; end if;
    if v_is_vc then v_vc_cnt := v_vc_cnt + 1; end if;

    insert into public.picks (
      manager_id, matchday_id, player_id, is_starter, bench_order, is_captain, is_vice_captain
    ) values (
      v_mgr.id, v_md.id, v_pid, v_is_starter, v_bench_order, v_is_cap, v_is_vc
    );
  end loop;

  if v_starters <> v_rules.starting_size
     or v_s_gk < v_rules.min_start_gk or v_s_gk > v_rules.max_start_gk
     or v_s_def < v_rules.min_start_def or v_s_def > v_rules.max_start_def
     or v_s_mid < v_rules.min_start_mid or v_s_mid > v_rules.max_start_mid
     or v_s_fwd < v_rules.min_start_fwd or v_s_fwd > v_rules.max_start_fwd then
    perform public.fantasy_fail('FORMATION_INVALID', 'Starting XI does not match a valid formation.');
  end if;

  if v_cap_cnt <> 1 or v_vc_cnt <> 1 then
    perform public.fantasy_fail('CAPTAIN_INVALID', 'Pick exactly one captain and one vice-captain in your starting XI.');
  end if;

  return jsonb_build_object('saved', true, 'matchdayId', v_md.id);
end;
$$;

-- 4. activate_wildcard
create or replace function public.activate_wildcard()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_mgr   public.managers%rowtype;
  v_rules public.fantasy_rules%rowtype;
  v_md    public.matchdays%rowtype;
begin
  if v_uid is null then
    perform public.fantasy_fail('NOT_SIGNED_IN', 'Sign in to activate your Wildcard.');
  end if;

  select * into v_mgr from public.managers where user_id = v_uid for update;
  if not found then
    perform public.fantasy_fail('NO_MANAGER', 'Manager profile not found.');
  end if;

  select * into v_rules from public.fantasy_rules where id = 1;
  v_md := public.fantasy_get_open_matchday();
  v_mgr := public.fantasy_sync_manager_for_matchday(v_mgr.id, v_md);

  if v_md.number = any(v_rules.unlimited_transfer_matchdays) then
    perform public.fantasy_fail('WILDCARD_NOT_ALLOWED', 'Transfers are already unlimited and free before this matchday.');
  end if;

  if v_mgr.wildcard_used then
    perform public.fantasy_fail('WILDCARD_USED', 'You have already used your Wildcard.');
  end if;

  insert into public.chips (manager_id, matchday_id, chip_type)
  values (v_mgr.id, v_md.id, 'wildcard');

  update public.managers
  set wildcard_used = true
  where id = v_mgr.id;

  -- Refund any transfer hits already incurred in this matchday
  update public.transfers
  set points_cost = 0
  where manager_id = v_mgr.id and matchday_id = v_md.id;

  return jsonb_build_object('activated', true, 'matchdayId', v_md.id);
end;
$$;

-- 5. make_transfers (swaps squad players AND updates current matchday picks)
create or replace function public.make_transfers(
  p_out_ids      uuid[],
  p_in_ids       uuid[],
  p_use_wildcard boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid           uuid := auth.uid();
  v_mgr           public.managers%rowtype;
  v_rules         public.fantasy_rules%rowtype;
  v_md            public.matchdays%rowtype;
  v_count         int;
  v_idx           int;
  v_out_p         public.players%rowtype;
  v_in_p          public.players%rowtype;
  v_total_cost    int;
  v_max_team      int;
  v_wc_active     boolean;
  v_unlimited     boolean;
  v_free_avail    int;
  v_paid_transfers int;
  v_points_cost   int;
  v_free_rem      int;
  v_swap_cost     smallint;
begin
  if v_uid is null then
    perform public.fantasy_fail('NOT_SIGNED_IN', 'Sign in to make transfers.');
  end if;

  select * into v_mgr from public.managers where user_id = v_uid for update;
  if not found then
    perform public.fantasy_fail('NO_MANAGER', 'Manager profile not found.');
  end if;

  if not exists (select 1 from public.squads where manager_id = v_mgr.id) then
    perform public.fantasy_fail('NO_SQUAD', 'Build your initial squad first.');
  end if;

  select * into v_rules from public.fantasy_rules where id = 1;
  v_md := public.fantasy_get_open_matchday();
  v_mgr := public.fantasy_sync_manager_for_matchday(v_mgr.id, v_md);

  v_count := coalesce(array_length(p_out_ids, 1), 0);
  if v_count < 1 or v_count <> coalesce(array_length(p_in_ids, 1), 0) then
    perform public.fantasy_fail('TRANSFER_INVALID', 'Select at least one valid player swap.');
  end if;

  if (select count(distinct x) from unnest(p_out_ids) x) <> v_count
     or (select count(distinct x) from unnest(p_in_ids) x) <> v_count then
    perform public.fantasy_fail('TRANSFER_INVALID', 'Duplicate players in transfer list.');
  end if;

  if p_use_wildcard and not v_mgr.wildcard_used then
    perform public.activate_wildcard();
    select * into v_mgr from public.managers where id = v_mgr.id;
  end if;

  v_wc_active := exists (
    select 1 from public.chips
    where manager_id = v_mgr.id and matchday_id = v_md.id and chip_type = 'wildcard'
  );
  v_unlimited := (v_md.number = any(v_rules.unlimited_transfer_matchdays));
  v_free_avail := v_mgr.free_transfers;

  for v_idx in 1..v_count loop
    if not exists (select 1 from public.squads where manager_id = v_mgr.id and player_id = p_out_ids[v_idx]) then
      perform public.fantasy_fail('TRANSFER_INVALID', 'Player to transfer out is not in your squad.');
    end if;

    if exists (select 1 from public.squads where manager_id = v_mgr.id and player_id = p_in_ids[v_idx]) then
      perform public.fantasy_fail('TRANSFER_INVALID', 'Incoming player is already in your squad.');
    end if;

    select * into v_out_p from public.players where id = p_out_ids[v_idx];
    select * into v_in_p from public.players where id = p_in_ids[v_idx];

    if v_out_p.id is null or v_in_p.id is null then
      perform public.fantasy_fail('PLAYER_UNKNOWN', 'Selected player does not exist.');
    end if;

    if v_in_p.status = 'left' then
      perform public.fantasy_fail('PLAYER_UNAVAILABLE', format('%s has left the competition and cannot be transferred in.', v_in_p.display_name));
    end if;

    if v_out_p.position <> v_in_p.position then
      perform public.fantasy_fail('TRANSFER_POSITION',
        format('%s (%s) must be replaced by another %s.', v_out_p.display_name, v_out_p.position, v_out_p.position));
    end if;

    delete from public.squads
    where manager_id = v_mgr.id and player_id = v_out_p.id;

    insert into public.squads (manager_id, player_id)
    values (v_mgr.id, v_in_p.id);

    -- Keep the open matchday's lineup in sync by replacing the outgoing player
    update public.picks
    set player_id = v_in_p.id
    where manager_id = v_mgr.id
      and matchday_id = v_md.id
      and player_id = v_out_p.id;

    if v_wc_active or v_unlimited then
      v_swap_cost := 0;
    elsif v_idx <= v_free_avail then
      v_swap_cost := 0;
    else
      v_swap_cost := v_rules.extra_transfer_cost;
    end if;

    insert into public.transfers (manager_id, matchday_id, player_out_id, player_in_id, points_cost)
    values (v_mgr.id, v_md.id, v_out_p.id, v_in_p.id, v_swap_cost);
  end loop;

  -- Check resulting squad budget and max-per-team rules
  select coalesce(sum(p.price_tenths), 0) into v_total_cost
  from public.squads s
  join public.players p on p.id = s.player_id
  where s.manager_id = v_mgr.id;

  if v_total_cost > v_rules.budget_tenths then
    perform public.fantasy_fail('OVER_BUDGET',
      format('Squad cost ₦%sm exceeds budget of ₦%sm.',
        to_char(v_total_cost / 10.0, 'FM999990.0'),
        to_char(v_rules.budget_tenths / 10.0, 'FM999990.0')));
  end if;

  select coalesce(max(cnt), 0) into v_max_team
  from (
    select count(*) as cnt
    from public.squads s
    join public.players p on p.id = s.player_id
    where s.manager_id = v_mgr.id
    group by p.team_id
  ) t;

  if v_max_team > v_rules.max_per_team then
    perform public.fantasy_fail('TEAM_LIMIT',
      format('You can pick at most %s players from one year group.', v_rules.max_per_team));
  end if;

  if v_wc_active or v_unlimited then
    v_points_cost := 0;
    v_free_rem := v_free_avail;
  else
    v_paid_transfers := greatest(0, v_count - v_free_avail);
    v_points_cost := v_paid_transfers * v_rules.extra_transfer_cost;
    v_free_rem := greatest(0, v_free_avail - v_count);
  end if;

  update public.managers
  set free_transfers = v_free_rem
  where id = v_mgr.id;

  return jsonb_build_object(
    'pointsCost', v_points_cost,
    'freeTransfersRemaining', v_free_rem,
    'matchdayId', v_md.id
  );
end;
$$;

-- 6. create_league
create or replace function public.create_league(p_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_mgr_id   uuid;
  v_name     text := btrim(coalesce(p_name, ''));
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code     text;
  v_i        int;
  v_league   public.leagues%rowtype;
begin
  if v_uid is null then
    perform public.fantasy_fail('NOT_SIGNED_IN', 'Sign in to create a mini-league.');
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 40 then
    perform public.fantasy_fail('LEAGUE_NAME_INVALID', 'League name must be between 2 and 40 characters.');
  end if;

  select id into v_mgr_id from public.managers where user_id = v_uid;
  if v_mgr_id is null then
    perform public.fantasy_fail('NO_MANAGER', 'Create your fantasy team before creating a league.');
  end if;

  loop
    v_code := '';
    for v_i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.leagues where invite_code = v_code);
  end loop;

  insert into public.leagues (name, invite_code, created_by)
  values (v_name, v_code, v_mgr_id)
  returning * into v_league;

  insert into public.league_members (league_id, manager_id)
  values (v_league.id, v_mgr_id);

  return jsonb_build_object(
    'id', v_league.id,
    'name', v_league.name,
    'invite_code', v_league.invite_code
  );
end;
$$;

-- 7. join_league
create or replace function public.join_league(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_mgr_id uuid;
  v_code   text := upper(btrim(coalesce(p_code, '')));
  v_league public.leagues%rowtype;
begin
  if v_uid is null then
    perform public.fantasy_fail('NOT_SIGNED_IN', 'Sign in to join a mini-league.');
  end if;

  if char_length(v_code) <> 6 then
    perform public.fantasy_fail('LEAGUE_CODE_INVALID', 'Invite code must be 6 characters.');
  end if;

  select id into v_mgr_id from public.managers where user_id = v_uid;
  if v_mgr_id is null then
    perform public.fantasy_fail('NO_MANAGER', 'Create your fantasy team before joining a league.');
  end if;

  select * into v_league from public.leagues where invite_code = v_code;
  if not found then
    perform public.fantasy_fail('LEAGUE_NOT_FOUND', 'Invalid invite code. No league found.');
  end if;

  if exists (
    select 1 from public.league_members
    where league_id = v_league.id and manager_id = v_mgr_id
  ) then
    perform public.fantasy_fail('LEAGUE_ALREADY_MEMBER', 'You are already a member of this league.');
  end if;

  insert into public.league_members (league_id, manager_id)
  values (v_league.id, v_mgr_id);

  return jsonb_build_object(
    'leagueId', v_league.id,
    'leagueName', v_league.name
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Row-Level Security (RLS) & Table Privileges
-- All normal user writes go through the SECURITY DEFINER RPCs above.
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

-- Drop any legacy direct-write policies
drop policy if exists "Users insert own manager" on public.managers;
drop policy if exists "Users update own manager" on public.managers;
drop policy if exists "Users manage own squad" on public.squads;
drop policy if exists "Users manage own picks before deadline" on public.picks;
drop policy if exists "Users insert own transfers" on public.transfers;
drop policy if exists "Users insert own chips" on public.chips;
drop policy if exists "Anyone reads leagues" on public.leagues;
drop policy if exists "Users create leagues" on public.leagues;
drop policy if exists "Anyone reads league members" on public.league_members;
drop policy if exists "Users join leagues" on public.league_members;
drop policy if exists "Users leave leagues" on public.league_members;

-- Revoke direct write privileges from anon/authenticated
revoke insert, update, delete, truncate on public.fantasy_rules           from anon, authenticated;
revoke insert, update, delete, truncate on public.managers                from anon, authenticated;
revoke insert, update, delete, truncate on public.squads                  from anon, authenticated;
revoke insert, update, delete, truncate on public.picks                   from anon, authenticated;
revoke insert, update, delete, truncate on public.transfers               from anon, authenticated;
revoke insert, update, delete, truncate on public.chips                   from anon, authenticated;
revoke insert, update, delete, truncate on public.manager_matchday_points from anon, authenticated;
revoke insert, update, delete, truncate on public.leagues                 from anon, authenticated;
revoke insert, update, delete, truncate on public.league_members          from anon, authenticated;

-- fantasy_rules
drop policy if exists "Anyone reads fantasy rules" on public.fantasy_rules;
create policy "Anyone reads fantasy rules" on public.fantasy_rules
  for select to anon, authenticated using (true);
drop policy if exists "Admins manage fantasy rules" on public.fantasy_rules;
create policy "Admins manage fantasy rules" on public.fantasy_rules
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- managers
drop policy if exists "Anyone reads managers" on public.managers;
create policy "Anyone reads managers" on public.managers
  for select to anon, authenticated using (true);
drop policy if exists "Admins manage all managers" on public.managers;
create policy "Admins manage all managers" on public.managers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- squads
drop policy if exists "Users read own squad" on public.squads;
create policy "Users read own squad" on public.squads
  for select to authenticated using (
    exists (select 1 from public.managers m where m.id = manager_id and m.user_id = auth.uid())
  );
drop policy if exists "Admins manage all squads" on public.squads;
create policy "Admins manage all squads" on public.squads
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- picks
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
drop policy if exists "Admins manage all picks" on public.picks;
create policy "Admins manage all picks" on public.picks
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- transfers
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
drop policy if exists "Admins manage all transfers" on public.transfers;
create policy "Admins manage all transfers" on public.transfers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- chips
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
drop policy if exists "Admins manage all chips" on public.chips;
create policy "Admins manage all chips" on public.chips
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- manager_matchday_points
drop policy if exists "Anyone reads matchday points" on public.manager_matchday_points;
create policy "Anyone reads matchday points" on public.manager_matchday_points
  for select to anon, authenticated using (true);
drop policy if exists "Admins manage matchday points" on public.manager_matchday_points;
create policy "Admins manage matchday points" on public.manager_matchday_points
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- leagues: ONLY members (and admins) can read a league row (keeps invite_code private!)
drop policy if exists "Members read own leagues" on public.leagues;
create policy "Members read own leagues" on public.leagues
  for select to authenticated using (
    exists (
      select 1 from public.league_members lm
      join public.managers m on m.id = lm.manager_id
      where lm.league_id = id and m.user_id = auth.uid()
    )
  );
drop policy if exists "Admins manage leagues" on public.leagues;
create policy "Admins manage leagues" on public.leagues
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- league_members: ONLY members of that league (and admins) can read membership
drop policy if exists "Members read league members" on public.league_members;
create policy "Members read league members" on public.league_members
  for select to authenticated using (
    exists (
      select 1 from public.league_members self_lm
      join public.managers m on m.id = self_lm.manager_id
      where self_lm.league_id = league_id and m.user_id = auth.uid()
    )
  );
drop policy if exists "Admins manage league members" on public.league_members;
create policy "Admins manage league members" on public.league_members
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- RPC Execute Permissions
-- -----------------------------------------------------------------------------
revoke all on function public.create_manager(text, smallint)         from public, anon;
grant execute on function public.create_manager(text, smallint)      to authenticated;

revoke all on function public.save_squad(uuid[], jsonb)              from public, anon;
grant execute on function public.save_squad(uuid[], jsonb)           to authenticated;

revoke all on function public.save_lineup(jsonb)                     from public, anon;
grant execute on function public.save_lineup(jsonb)                  to authenticated;

revoke all on function public.activate_wildcard()                    from public, anon;
grant execute on function public.activate_wildcard()                 to authenticated;

revoke all on function public.make_transfers(uuid[], uuid[], boolean) from public, anon;
grant execute on function public.make_transfers(uuid[], uuid[], boolean) to authenticated;

revoke all on function public.create_league(text)                    from public, anon;
grant execute on function public.create_league(text)                 to authenticated;

revoke all on function public.join_league(text)                      from public, anon;
grant execute on function public.join_league(text)                   to authenticated;

-- Internal helpers: not callable directly from the client
revoke all on function public.fantasy_fail(text, text)               from public, anon, authenticated;
revoke all on function public.fantasy_get_open_matchday()            from public, anon, authenticated;
revoke all on function public.fantasy_sync_manager_for_matchday(uuid, public.matchdays) from public, anon, authenticated;
revoke all on function public.fantasy_prepare_matchday_snapshots(uuid) from public, anon, authenticated;