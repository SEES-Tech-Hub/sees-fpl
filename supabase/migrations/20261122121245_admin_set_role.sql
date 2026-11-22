-- =============================================================================
-- Admin: promote and remove officials
-- Author: Akeem (admin backend)
-- PRD: "Users and roles"; "Feature: Admin portal and match console", item 5
-- Needs: 20261122120701_admin_players_prices.sql (admin_fail)
--
-- What this adds
--   * admin_set_role(profile_id, role): the admin promotes a signed-in account
--     to official or makes it a plain user again. In one transaction:
--       - demoting an official clears console_holder on every fixture they
--         hold that isn't finished (not full time, walkover or cancelled), and
--         returns those fixtures so the admin portal can warn;
--       - the role changes (Tayo's guard_profile_role still checks it).
--     Setting the role an account already has changes nothing (safe to retry).
--
-- Refused:
--   * changing your own role (admin.own_role);
--   * granting admin, or changing an admin account's role
--     (admin.role_forbidden: admins are set by Tayo in the SQL editor);
--   * demoting the last admin (admin.last_admin). guard_profile_role already
--     stops the app removing any admin; this check names the case plainly and
--     keeps holding if that guard is ever relaxed.
--
-- Runs as the caller (SECURITY INVOKER): row-level security and every
-- existing trigger apply, and the audit log records the admin.
-- Safe to run twice.
-- =============================================================================

create or replace function public.admin_set_role(p_profile_id uuid, p_role public.app_role)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_current  public.app_role;
  v_released jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then
    perform public.admin_fail('admin.forbidden', 'Only the admin can change roles.');
  end if;
  if p_profile_id = auth.uid() then
    perform public.admin_fail('admin.own_role', 'You can''t change your own role.');
  end if;

  select role into v_current from public.profiles where id = p_profile_id for update;
  if not found then
    perform public.admin_fail('admin.not_found', 'That account wasn''t found. They need to sign in once first.');
  end if;

  if v_current = 'admin' then
    if (select count(*) from public.profiles where role = 'admin') <= 1 then
      perform public.admin_fail('admin.last_admin', 'This is the last admin account, so it can''t be demoted.');
    end if;
    perform public.admin_fail('admin.role_forbidden',
      'Admin accounts can only be changed in the database. Ask Tayo.');
  end if;
  if p_role = 'admin' then
    perform public.admin_fail('admin.role_forbidden',
      'Admin can only be granted in the database. Ask Tayo.');
  end if;

  if v_current = p_role then
    return jsonb_build_object('profileId', p_profile_id, 'role', p_role, 'releasedFixtures', v_released);
  end if;

  perform set_config('sees.audit_context', jsonb_build_object('action', 'set_role')::text, true);

  if p_role = 'user' then
    with released as (
      update public.fixtures f
      set console_holder = null
      where f.console_holder = p_profile_id
        and f.status not in ('full_time', 'walkover', 'cancelled')
      returning f.id, f.kickoff_at, f.stage, f.status, f.home_team_id, f.away_team_id, f.event_id
    )
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', r.id,
             'kickoffAt', r.kickoff_at,
             'stage', r.stage,
             'status', r.status,
             'eventName', e.name,
             'home', h.short_name,
             'away', a.short_name
           ) order by r.kickoff_at nulls last), '[]'::jsonb)
    into v_released
    from released r
    join public.events e on e.id = r.event_id
    left join public.teams h on h.id = r.home_team_id
    left join public.teams a on a.id = r.away_team_id;
  end if;

  update public.profiles set role = p_role where id = p_profile_id;

  -- The context is transaction-local; clear it so later statements in the
  -- same transaction aren't tagged with it.
  perform set_config('sees.audit_context', '', true);
  return jsonb_build_object('profileId', p_profile_id, 'role', p_role, 'releasedFixtures', v_released);
end;
$$;

revoke all on function public.admin_set_role(uuid, public.app_role) from public, anon;
grant execute on function public.admin_set_role(uuid, public.app_role) to authenticated;

-- =============================================================================
-- Verify (for Tayo, after applying). As the admin in the app, or in the SQL
-- editor with: set local role authenticated;
--              set local request.jwt.claims = '{"sub": "<admin profile id>"}';
-- =============================================================================
-- 1. Promote, then hold a fixture, then demote:
--    select public.admin_set_role('<user id>', 'official');   -- {"role": "official", "releasedFixtures": []}
--    update public.fixtures set console_holder = '<user id>'
--      where id = (select id from public.fixtures where status = 'scheduled' order by kickoff_at limit 1);
--    select public.admin_set_role('<user id>', 'user');       -- releasedFixtures lists that fixture
--    select console_holder from public.fixtures where ...;    -- null
-- 2. select public.admin_set_role('<user id>', 'user');       -- again: no change, empty list
-- 3. select public.admin_set_role('<user id>', 'admin');      -- admin.role_forbidden
--    select public.admin_set_role('<your own id>', 'user');   -- admin.own_role
--    select public.admin_set_role('<another admin id>', 'user'); -- admin.last_admin if it's the only one,
--                                                             -- otherwise admin.role_forbidden
-- 4. select action, old, new from public.audit_log
--      where table_name in ('profiles', 'fixtures') order by id desc limit 3;
--    -- the role change and the holder release, by the admin
-- 5. As a plain user: admin.forbidden. As anon: permission denied.
