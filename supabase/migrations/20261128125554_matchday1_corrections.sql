-- =============================================================================
-- Matchday 1 corrections, from the officials' notes
-- Owner: Tayo. Run after 20261128125553_year1_new_players.sql.
--
-- Year 2 v Year 1 (Year 1's official recorded a placeholder lineup and no
-- events, by agreement; the real sheet came afterwards):
--   * Year 1's lineup: the ten who started (Inioluwa in goal; Ezekiel,
--     Waliylahi, Bayo, Xenon; Jude, Wahab, Destiny; Seun, Femi Testimony)
--     and the four who came on. Everyone else is off the sheet.
--   * Subs at half-time (minutes weren't kept): Adejare (David) for Jude
--     ("Jululia"), Damoski (Oluwadamilola) for Destiny ("Apex"), Solomon for
--     Waliylahi, Michael for Seun.
--   * Inioluwa: 5 saves.
--   * Year 2: Sayf was a stand-in name on the sheet and didn't play: bench.
--   * Damisi's goal was assisted by Boye, not Show.
--   * Samuel Azubuike's goal was in the 13th minute, not the 19th.
-- Year 5 v Year 3: 2 saves each, Jeager (Year 5) and Joel (in goal for Year 3).
--
-- Events are never edited: wrong ones are voided and replaced. Fixed client
-- event ids and existence checks make it safe to run twice; it does nothing
-- where these fixtures don't exist.
-- =============================================================================

do $$
declare
  f_y2y1 constant uuid := 'a47f3afa-3665-4838-9e54-ecb591d7039e';
  f_y5y3 constant uuid := 'defde20c-0bce-4ece-8350-421b07d3ece1';
  y1 uuid := (select id from public.teams where year = 1);
  y2 uuid := (select id from public.teams where year = 2);
  y3 uuid := (select id from public.teams where year = 3);
  y5 uuid := (select id from public.teams where year = 5);
  v_first  timestamptz;
  v_second timestamptz;
  v_old    record;
begin
  -- ---------------------------------------------------------------- Y2 v Y1
  if exists (select 1 from public.fixtures where id = f_y2y1) then
    select occurred_at into v_first from public.match_events
      where fixture_id = f_y2y1 and type = 'period_start' and period = 'first_half' and voided_at is null;
    select occurred_at into v_second from public.match_events
      where fixture_id = f_y2y1 and type = 'period_start' and period = 'second_half' and voided_at is null;

    -- Year 1's real team sheet.
    delete from public.lineups where fixture_id = f_y2y1 and team_id = y1;
    insert into public.lineups (fixture_id, team_id, player_id, role)
    select f_y2y1, y1, p.id, s.role::public.lineup_role
    from (values
      ('Inioluwa Shinayomi', 'starter'), ('Ezekiel', 'starter'), ('Waliylahi', 'starter'),
      ('Bayo', 'starter'), ('Xenon', 'starter'), ('Jude', 'starter'), ('Wahab', 'starter'),
      ('Destiny', 'starter'), ('Seun', 'starter'), ('Testimony', 'starter'),
      ('David', 'bench'), ('Oluwadamilola', 'bench'), ('Solomon', 'bench'), ('Michael', 'bench')
    ) as s(name, role)
    join public.players p on p.team_id = y1 and p.display_name = s.name;

    -- Sayf didn't play.
    update public.lineups set role = 'bench'
    where fixture_id = f_y2y1 and team_id = y2
      and player_id = (select id from public.players where team_id = y2 and display_name = 'Sayf');

    -- Year 1's subs, at the start of the second half (a second apart, in order).
    insert into public.match_events (fixture_id, client_event_id, type, period, team_id, player_id, other_player_id, occurred_at, side)
    select f_y2y1, s.cid::uuid, 'substitution', 'second_half', y1,
           (select id from public.players where team_id = y1 and display_name = s.off_name),
           (select id from public.players where team_id = y1 and display_name = s.on_name),
           v_second + make_interval(secs => s.n), 'away'
    from (values
      ('fc9d1160-a382-4a17-8baa-a74ee7f16667', 'Jude',      'David',         1),
      ('8aef4db3-41a0-4f76-9f25-f059b03e5716', 'Destiny',   'Oluwadamilola', 2),
      ('5bdf3355-4b7c-409f-a1c2-9c6826e20977', 'Waliylahi', 'Solomon',       3),
      ('0d4cc080-8c59-4d24-82f6-bc33184c70c6', 'Seun',      'Michael',       4)
    ) as s(cid, off_name, on_name, n)
    where v_second is not null
      and not exists (select 1 from public.match_events e where e.client_event_id = s.cid::uuid);

    -- Inioluwa's 5 saves (minutes weren't kept: spread across both halves).
    insert into public.match_events (fixture_id, client_event_id, type, period, team_id, player_id, occurred_at, side)
    select f_y2y1, s.cid::uuid, 'save', s.period::public.match_period, y1,
           (select id from public.players where team_id = y1 and display_name = 'Inioluwa Shinayomi'),
           case when s.period = 'first_half' then v_first else v_second end + make_interval(mins => s.m), 'away'
    from (values
      ('71befd3d-e631-43bd-a3ef-1df159906c14', 'first_half', 6),
      ('631662f8-35f7-4780-bf68-03aad8e42d40', 'first_half', 14),
      ('d378c2b3-57a9-44ea-828b-5aa312a52521', 'first_half', 20),
      ('8e837db4-04b1-484f-8b5a-42e389a91bae', 'second_half', 6),
      ('8670508c-79ee-4cf3-ab59-67a26e24af11', 'second_half', 14)
    ) as s(cid, period, m)
    where v_first is not null and v_second is not null
      and not exists (select 1 from public.match_events e where e.client_event_id = s.cid::uuid);

    -- Damisi's goal: assisted by Boye, not Show. Void and replace at the same moment.
    select * into v_old from public.match_events
    where fixture_id = f_y2y1 and type = 'goal' and voided_at is null
      and player_id = (select id from public.players where team_id = y2 and display_name = 'Damisi')
      and other_player_id = (select id from public.players where team_id = y2 and display_name = 'Show');
    if found then
      update public.match_events set voided_at = now(), void_reason = 'Assist was Boye, not Show (official''s notes)'
      where id = v_old.id;
      insert into public.match_events (fixture_id, client_event_id, type, period, team_id, player_id, other_player_id,
                                       is_penalty, is_own_goal, points, occurred_at, side)
      values (f_y2y1, '59831eab-21ea-4acc-9e36-8f57acfd4ab3', 'goal', v_old.period, v_old.team_id, v_old.player_id,
              (select id from public.players where team_id = y2 and display_name = 'Boye'),
              v_old.is_penalty, false, v_old.points, v_old.occurred_at, v_old.side);
    end if;

    -- Samuel Azubuike's goal: the 13th minute (when the wrong Samuel's voided goal was), not the 19th.
    select * into v_old from public.match_events
    where fixture_id = f_y2y1 and type = 'goal' and voided_at is null
      and player_id = (select id from public.players where team_id = y2 and display_name = 'Samuel Azubuike')
      and client_event_id <> 'ce35a2b4-0190-469c-99c1-8cf27962e7de';
    if found then
      update public.match_events set voided_at = now(), void_reason = 'Scored in the 13th minute, recorded late (official''s notes)'
      where id = v_old.id;
      insert into public.match_events (fixture_id, client_event_id, type, period, team_id, player_id, other_player_id,
                                       is_penalty, is_own_goal, points, occurred_at, side)
      select f_y2y1, 'ce35a2b4-0190-469c-99c1-8cf27962e7de', 'goal', v_old.period, v_old.team_id, v_old.player_id,
             v_old.other_player_id, v_old.is_penalty, false, v_old.points,
             -- When the wrong Samuel's goal was recorded (voided), else 13:00 into the half.
             coalesce((select w.occurred_at from public.match_events w
                       where w.fixture_id = f_y2y1 and w.type = 'goal' and w.voided_at is not null
                         and w.player_id <> v_old.player_id
                         and w.occurred_at < v_old.occurred_at
                         and w.team_id = v_old.team_id
                       order by w.occurred_at desc limit 1),
                      v_first + interval '12 minutes 30 seconds'),
             v_old.side;
    end if;
  end if;

  -- ---------------------------------------------------------------- Y5 v Y3
  if exists (select 1 from public.fixtures where id = f_y5y3) then
    select occurred_at into v_first from public.match_events
      where fixture_id = f_y5y3 and type = 'period_start' and period = 'first_half' and voided_at is null;
    select occurred_at into v_second from public.match_events
      where fixture_id = f_y5y3 and type = 'period_start' and period = 'second_half' and voided_at is null;

    insert into public.match_events (fixture_id, client_event_id, type, period, team_id, player_id, occurred_at, side)
    select f_y5y3, s.cid::uuid, 'save', s.period::public.match_period, s.team,
           (select id from public.players where team_id = s.team and display_name = s.keeper),
           case when s.period = 'first_half' then v_first else v_second end + make_interval(mins => s.m), s.side
    from (values
      ('75187f3d-839b-4005-b158-3ce845f1c035', y5, 'Jeager', 'first_half', 10, 'home'),
      ('66db6f77-9279-4420-8d0a-79faac534c2d', y3, 'Joel',   'first_half', 15, 'away'),
      ('fa1d3c5e-2b4a-4f6e-9c1d-7e8f9a0b1c2d', y3, 'Joel',   'second_half', 5, 'away'),
      ('0b2c4d6e-8f1a-4b3c-9d5e-6f7a8b9c0d1e', y5, 'Jeager', 'second_half', 12, 'home')
    ) as s(cid, team, keeper, period, m, side)
    where v_first is not null and v_second is not null
      and not exists (select 1 from public.match_events e where e.client_event_id = s.cid::uuid);
  end if;
end;
$$;
