-- =============================================================================
-- Admin: price rules, price lock, and player and price imports
-- Author: Akeem (admin backend)
-- PRD: "Feature: Admin portal and match console", items 3 (players, CSV import)
--      and 6 (prices, locked once the matchday 1 deadline passes);
--      "Risks": late additions get the lowest price
-- CSV formats: docs/admin-csv-formats.md
--
-- What this adds
--   * admin_price_rules(): the single place the allowed price range and step
--     live. Everything else (the lock trigger, the import functions, the app)
--     reads it.
--   * admin_price_lock_at(): matchday 1's deadline_at. Prices lock at that
--     moment. Null (no deadline set yet) means no lock.
--   * players_price_lock: a trigger on players. From the app (auth.uid() set):
--       - every price must fit admin_price_rules() (admin.price_out_of_range);
--       - after the lock, a price can't change, and a new player can only be
--         added at the lowest price (admin.price_locked);
--       - status, position and shirt number changes are always allowed.
--     The SQL editor (auth.uid() is null) is not restricted, like the other guards.
--   * admin_imports: one row per committed import, keyed by the importId the
--     browser makes, so running the same commit twice does nothing.
--   * admin_import_players(import_id, rows) and admin_set_prices(import_id, rows):
--     the CSV commits. Each checks is_admin(), re-checks every row the preview
--     checked, writes all rows or none, tags every audit row with the import id,
--     and returns { inserted, updated, unchanged, alreadyApplied }.
--
-- The import functions run as the caller (SECURITY INVOKER), so row-level
-- security applies to every write and the audit log records the admin.
--
-- Safe to run twice.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Price rules. Tenths of a million naira (55 = N5.5m).
--
-- These values mirror the players_price_tenths_check constraint in the base
-- schema. When Mary adds price columns to fantasy_rules, change only this
-- function to read them (and loosen the check constraint to match).
-- -----------------------------------------------------------------------------
create or replace function public.admin_price_rules()
returns table (min_tenths smallint, max_tenths smallint, step_tenths smallint)
language sql
immutable
set search_path = ''
as $$
  select 40::smallint, 100::smallint, 5::smallint;
$$;

-- Prices lock at matchday 1's deadline. Null means not locked yet.
create or replace function public.admin_price_lock_at()
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select deadline_at from public.matchdays where number = 1;
$$;

-- A plain-words problem with a price, or null if it's allowed.
create or replace function public.admin_price_problem(p_tenths integer)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when p_tenths is null then 'The price is missing.'
    when p_tenths < r.min_tenths then
      format('%s is below the minimum of %s.', to_char(p_tenths / 10.0, 'FM990.0'), to_char(r.min_tenths / 10.0, 'FM990.0'))
    when p_tenths > r.max_tenths then
      format('%s is above the maximum of %s.', to_char(p_tenths / 10.0, 'FM990.0'), to_char(r.max_tenths / 10.0, 'FM990.0'))
    when (p_tenths - r.min_tenths) % r.step_tenths <> 0 then
      format('%s isn''t a step of %s.', to_char(p_tenths / 10.0, 'FM990.0'), to_char(r.step_tenths / 10.0, 'FM990.0'))
  end
  from public.admin_price_rules() r;
$$;

-- -----------------------------------------------------------------------------
-- The price lock
-- -----------------------------------------------------------------------------
create or replace function public.players_price_lock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_problem text;
  v_lock_at timestamptz;
  v_min     smallint;
begin
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.price_tenths is not distinct from old.price_tenths then
    return new;
  end if;

  v_problem := public.admin_price_problem(new.price_tenths);
  if v_problem is not null then
    perform public.live_fail('admin.price_out_of_range', v_problem);
  end if;

  v_lock_at := public.admin_price_lock_at();
  if v_lock_at is null or v_lock_at > now() then
    return new;
  end if;

  select min_tenths into v_min from public.admin_price_rules();
  if tg_op = 'UPDATE' then
    perform public.live_fail('admin.price_locked',
      'Prices are locked since the matchday 1 deadline.');
  elsif new.price_tenths <> v_min then
    perform public.live_fail('admin.price_locked',
      format('Prices are locked since the matchday 1 deadline. Late additions join at %s.',
             to_char(v_min / 10.0, 'FM990.0')));
  end if;
  return new;
end;
$$;

drop trigger if exists players_price_lock on public.players;
create trigger players_price_lock
  before insert or update of price_tenths on public.players
  for each row execute function public.players_price_lock();

-- -----------------------------------------------------------------------------
-- admin_imports: makes every import safe to commit twice
-- -----------------------------------------------------------------------------
create table if not exists public.admin_imports (
  import_id  uuid primary key,
  kind       text not null check (kind in ('players', 'prices', 'fixtures')),
  actor      uuid references public.profiles (id) on delete set null default auth.uid(),
  counts     jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_imports_actor_idx on public.admin_imports (actor);

alter table public.admin_imports enable row level security;

drop policy if exists "Admins read imports" on public.admin_imports;
create policy "Admins read imports" on public.admin_imports
  for select to authenticated using (public.is_admin());

drop policy if exists "Admins record imports" on public.admin_imports;
create policy "Admins record imports" on public.admin_imports
  for insert to authenticated with check (public.is_admin());

drop policy if exists "Admins update imports" on public.admin_imports;
create policy "Admins update imports" on public.admin_imports
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

revoke delete, truncate on public.admin_imports from anon, authenticated;
revoke insert, update on public.admin_imports from anon;

-- -----------------------------------------------------------------------------
-- Shared helpers for the import functions
-- -----------------------------------------------------------------------------

-- Raised directly (not through live_fail): the import functions run as the
-- caller, and app roles can't execute live_fail.
create or replace function public.admin_fail(p_code text, p_message text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = p_message, hint = p_code;
end;
$$;

-- Starts an import: checks the caller, the row count and the import id.
-- Returns the earlier run's counts when this import id was already committed
-- (the caller returns them as they are), or null to carry on.
create or replace function public.admin_begin_import(p_import_id uuid, p_kind text, p_rows jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_existing public.admin_imports%rowtype;
begin
  if not public.is_admin() then
    perform public.admin_fail('admin.forbidden', 'Only the admin can import.');
  end if;
  if p_import_id is null then
    perform public.admin_fail('admin.invalid_input', 'The import has no id.');
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array'
     or jsonb_array_length(p_rows) = 0
     or jsonb_array_length(p_rows) > 1000 then
    perform public.admin_fail('admin.invalid_input', 'An import has between 1 and 1000 rows.');
  end if;

  -- Claim the id first. A second commit of the same import waits here until
  -- the first finishes, then sees its row.
  insert into public.admin_imports (import_id, kind) values (p_import_id, p_kind)
  on conflict (import_id) do nothing;
  if found then
    perform set_config('sees.audit_context',
      jsonb_build_object('importId', p_import_id, 'import', p_kind)::text, true);
    return null;
  end if;

  select * into v_existing from public.admin_imports where import_id = p_import_id;
  if v_existing.kind <> p_kind then
    perform public.admin_fail('admin.invalid_input', 'That import id was already used for a different file.');
  end if;
  return coalesce(v_existing.counts, '{}'::jsonb) || jsonb_build_object('alreadyApplied', true);
end;
$$;

-- Ends an import: stores and returns the counts.
create or replace function public.admin_finish_import(p_import_id uuid, p_inserted integer, p_updated integer, p_unchanged integer)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_counts jsonb := jsonb_build_object(
    'inserted', p_inserted, 'updated', p_updated, 'unchanged', p_unchanged, 'alreadyApplied', false);
begin
  update public.admin_imports set counts = v_counts - 'alreadyApplied' where import_id = p_import_id;
  -- The audit context is transaction-local; clear it so later statements in
  -- the same transaction aren't tagged with this import.
  perform set_config('sees.audit_context', '', true);
  return v_counts;
end;
$$;

-- Raises admin.import_invalid listing the first problems, if there are any.
create or replace function public.admin_raise_row_errors(p_errors text[])
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_count integer := coalesce(array_length(p_errors, 1), 0);
begin
  if v_count = 0 then
    return;
  end if;
  perform public.admin_fail('admin.import_invalid',
    array_to_string(p_errors[1:5], ' ')
    || case when v_count > 5 then format(' (and %s more)', v_count - 5) else '' end
    || ' Nothing was imported.');
end;
$$;

create or replace function public.admin_normalise_name(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'), '');
$$;

-- -----------------------------------------------------------------------------
-- admin_import_players(import_id, rows)
--
-- Each row (snake_case JSON, from previewPlayersCsv):
--   row_number, existing_id (null for a new player), team_id, full_name,
--   display_name, position, shirt_number, price_tenths, status
--
-- Existing players: only position, shirt number, price and status change.
-- Their full name and display name are never changed by an import, and their
-- team must match. New players are inserted with the display name given.
-- -----------------------------------------------------------------------------
create or replace function public.admin_import_players(p_import_id uuid, p_rows jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_done      jsonb;
  v_errors    text[];
  v_lock_at   timestamptz;
  v_locked    boolean;
  v_min       smallint;
  v_inserted  integer;
  v_updated   integer;
  v_total     integer := jsonb_array_length(p_rows);
begin
  v_done := public.admin_begin_import(p_import_id, 'players', p_rows);
  if v_done is not null then
    return v_done;
  end if;

  v_lock_at := public.admin_price_lock_at();
  v_locked := v_lock_at is not null and v_lock_at <= now();
  select min_tenths into v_min from public.admin_price_rules();

  drop table if exists pg_temp.admin_player_rows;
  create temp table admin_player_rows on commit drop as
  select
    r.row_number,
    r.existing_id,
    r.team_id,
    public.admin_normalise_name(r.full_name)    as full_name,
    public.admin_normalise_name(r.display_name) as display_name,
    r.position,
    r.shirt_number,
    r.price_tenths,
    coalesce(r.status, 'available'::public.player_status) as status
  from jsonb_to_recordset(p_rows) as r (
    row_number   integer,
    existing_id  uuid,
    team_id      uuid,
    full_name    text,
    display_name text,
    position     public.player_position,
    shirt_number smallint,
    price_tenths smallint,
    status       public.player_status
  );

  select array_agg(problem order by row_number) into v_errors
  from (
    select r.row_number, format('Row %s: %s', r.row_number, p.problem) as problem
    from admin_player_rows r
    left join public.players e on e.id = r.existing_id
    cross join lateral (values
      (case when r.existing_id is not null and e.id is null then 'that player no longer exists.' end),
      (case when e.id is not null and e.team_id is distinct from r.team_id then 'an import can''t move a player to another year.' end),
      (case when r.team_id is null or not exists (select 1 from public.teams t where t.id = r.team_id) then 'the year team is missing.' end),
      (case when r.existing_id is null and r.full_name is null then 'the full name is missing.' end),
      (case when r.existing_id is null and char_length(r.full_name) > 80 then 'the full name is longer than 80 characters.' end),
      (case when r.existing_id is null and r.display_name is null then 'the display name is missing.' end),
      (case when r.existing_id is null and char_length(r.display_name) > 40 then 'the display name is longer than 40 characters.' end),
      (case when r.position is null then 'the position is missing.' end),
      (case when r.shirt_number is not null and r.shirt_number not between 0 and 99 then 'shirt numbers go from 0 to 99.' end),
      (case when public.admin_price_problem(r.price_tenths) is not null then 'price: ' || public.admin_price_problem(r.price_tenths) end),
      (case when v_locked and e.id is not null and r.price_tenths is distinct from e.price_tenths
            then 'price: prices are locked since the matchday 1 deadline.' end),
      (case when v_locked and r.existing_id is null and r.price_tenths is distinct from v_min
            then format('price: prices are locked; late additions join at %s.', to_char(v_min / 10.0, 'FM990.0')) end),
      (case when r.existing_id is not null
             and (select count(*) from admin_player_rows d where d.existing_id = r.existing_id) > 1
            then 'the same player appears in another row.' end),
      (case when r.existing_id is null and (
              exists (select 1 from public.players x
                      where x.team_id = r.team_id and lower(x.display_name) = lower(r.display_name))
              or (select count(*) from admin_player_rows d
                  where d.existing_id is null and d.team_id = r.team_id
                    and lower(d.display_name) = lower(r.display_name)) > 1)
            then format('the display name "%s" is already used in that year.', r.display_name) end)
    ) as p (problem)
    where p.problem is not null
  ) problems;

  perform public.admin_raise_row_errors(v_errors);

  with changed as (
    update public.players p
    set position     = r.position,
        shirt_number = r.shirt_number,
        price_tenths = r.price_tenths,
        status       = r.status
    from admin_player_rows r
    where r.existing_id = p.id
      and (p.position, p.shirt_number, p.price_tenths, p.status)
          is distinct from (r.position, r.shirt_number, r.price_tenths, r.status)
    returning p.id
  )
  select count(*) into v_updated from changed;

  with added as (
    insert into public.players (team_id, full_name, display_name, position, shirt_number, price_tenths, status)
    select r.team_id, r.full_name, r.display_name, r.position, r.shirt_number, r.price_tenths, r.status
    from admin_player_rows r
    where r.existing_id is null
    order by r.row_number
    returning id
  )
  select count(*) into v_inserted from added;

  return public.admin_finish_import(p_import_id, v_inserted, v_updated, v_total - v_inserted - v_updated);
end;
$$;

-- -----------------------------------------------------------------------------
-- admin_set_prices(import_id, rows)
--
-- Each row: row_number, player_id, price_tenths. Every player must exist.
-- -----------------------------------------------------------------------------
create or replace function public.admin_set_prices(p_import_id uuid, p_rows jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_done    jsonb;
  v_errors  text[];
  v_lock_at timestamptz;
  v_locked  boolean;
  v_updated integer;
  v_total   integer := jsonb_array_length(p_rows);
begin
  v_done := public.admin_begin_import(p_import_id, 'prices', p_rows);
  if v_done is not null then
    return v_done;
  end if;

  v_lock_at := public.admin_price_lock_at();
  v_locked := v_lock_at is not null and v_lock_at <= now();

  drop table if exists pg_temp.admin_price_rows;
  create temp table admin_price_rows on commit drop as
  select r.row_number, r.player_id, r.price_tenths
  from jsonb_to_recordset(p_rows) as r (row_number integer, player_id uuid, price_tenths smallint);

  select array_agg(problem order by row_number) into v_errors
  from (
    select r.row_number, format('Row %s: %s', r.row_number, p.problem) as problem
    from admin_price_rows r
    left join public.players e on e.id = r.player_id
    cross join lateral (values
      (case when e.id is null then 'that player doesn''t exist.' end),
      (case when public.admin_price_problem(r.price_tenths) is not null then 'price: ' || public.admin_price_problem(r.price_tenths) end),
      (case when v_locked and e.id is not null and r.price_tenths is distinct from e.price_tenths
            then 'price: prices are locked since the matchday 1 deadline.' end),
      (case when (select count(*) from admin_price_rows d where d.player_id = r.player_id) > 1
            then 'the same player appears in another row.' end)
    ) as p (problem)
    where p.problem is not null
  ) problems;

  perform public.admin_raise_row_errors(v_errors);

  with changed as (
    update public.players p
    set price_tenths = r.price_tenths
    from admin_price_rows r
    where r.player_id = p.id and p.price_tenths is distinct from r.price_tenths
    returning p.id
  )
  select count(*) into v_updated from changed;

  return public.admin_finish_import(p_import_id, 0, v_updated, v_total - v_updated);
end;
$$;

-- -----------------------------------------------------------------------------
-- Function permissions
-- -----------------------------------------------------------------------------
-- Public: the rules and the lock time are shown on the fantasy pages too.
grant execute on function public.admin_price_rules()   to anon, authenticated;
grant execute on function public.admin_price_lock_at() to anon, authenticated;

-- The imports: signed-in users only (each checks is_admin() itself).
revoke all on function public.admin_import_players(uuid, jsonb) from public, anon;
grant execute on function public.admin_import_players(uuid, jsonb) to authenticated;
revoke all on function public.admin_set_prices(uuid, jsonb) from public, anon;
grant execute on function public.admin_set_prices(uuid, jsonb) to authenticated;

-- Helpers the import functions call as the caller, so authenticated keeps
-- execute; none of them does anything an admin couldn't do directly.
revoke all on function public.admin_price_problem(integer) from public, anon;
grant execute on function public.admin_price_problem(integer) to authenticated;
revoke all on function public.admin_fail(text, text) from public, anon;
grant execute on function public.admin_fail(text, text) to authenticated;
revoke all on function public.admin_begin_import(uuid, text, jsonb) from public, anon;
grant execute on function public.admin_begin_import(uuid, text, jsonb) to authenticated;
revoke all on function public.admin_finish_import(uuid, integer, integer, integer) from public, anon;
grant execute on function public.admin_finish_import(uuid, integer, integer, integer) to authenticated;
revoke all on function public.admin_raise_row_errors(text[]) from public, anon;
grant execute on function public.admin_raise_row_errors(text[]) to authenticated;
revoke all on function public.admin_normalise_name(text) from public, anon;
grant execute on function public.admin_normalise_name(text) to authenticated;

-- Trigger function: not callable directly.
revoke all on function public.players_price_lock() from public, anon, authenticated;

-- =============================================================================
-- Verify (for Tayo, after applying). Run in the SQL editor unless noted.
-- =============================================================================
-- 1. Rules and lock time:
--    select * from public.admin_price_rules();        -- 40 | 100 | 5
--    select public.admin_price_lock_at();             -- matchday 1's deadline_at
--
-- 2. The SQL editor isn't restricted (auth.uid() is null):
--    begin; update public.players set price_tenths = 70 where display_name = 'Kolade'; rollback;
--
-- 3. As the admin in the app (or with set local role authenticated and
--    request.jwt.claims set to the admin's id), before the lock:
--    update public.players set price_tenths = 75 where display_name = 'Kolade';   -- ok
--    update public.players set price_tenths = 110 where display_name = 'Kolade';  -- admin.price_out_of_range
--    update public.players set price_tenths = 53 where display_name = 'Kolade';   -- admin.price_out_of_range
--
-- 4. After the lock (simulate inside a transaction):
--    begin;
--      update public.matchdays set deadline_at = now() - interval '1 minute' where number = 1;
--      -- then, as the admin:
--      update public.players set price_tenths = 80 where display_name = 'Kolade';      -- admin.price_locked
--      update public.players set status = 'injured' where display_name = 'Kolade';     -- ok
--      insert into public.players (team_id, full_name, display_name, position, price_tenths)
--        select id, 'Late Joiner', 'Late Joiner', 'MID', 55 from public.teams where year = 1; -- admin.price_locked
--      insert into public.players (team_id, full_name, display_name, position, price_tenths)
--        select id, 'Late Joiner', 'Late Joiner', 'MID', 40 from public.teams where year = 1; -- ok
--    rollback;
--
-- 5. Imports, as the admin:
--    select public.admin_set_prices('00000000-0000-0000-0000-000000000001',
--      (select jsonb_agg(jsonb_build_object('row_number', 2, 'player_id', id, 'price_tenths', 65))
--       from public.players where display_name = 'Kolade'));
--    -- {"inserted": 0, "updated": 1, "unchanged": 0, "alreadyApplied": false}
--    -- run it again: the same counts with "alreadyApplied": true, nothing written
--    select context from public.audit_log order by id desc limit 1;  -- has the importId
--
-- 6. As a plain user or anon: admin_import_players / admin_set_prices return
--    admin.forbidden (anon: permission denied); select from admin_imports returns no rows.
