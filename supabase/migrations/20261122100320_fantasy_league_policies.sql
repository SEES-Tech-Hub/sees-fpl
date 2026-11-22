-- =============================================================================
-- Fantasy: fix the mini-league read policies from 20261121112323_fantasy_schema.sql
--
-- The old policies broke every league read for signed-in users:
--   * "Members read league members" queried league_members from inside its own
--     policy, so Postgres raised "infinite recursion detected in policy".
--   * In "Members read own leagues", the unqualified `id` bound to managers.id,
--     not leagues.id, so no one could ever see a league.
--   * In "Members read league members", `self_lm.league_id = league_id` compared
--     the inner row with itself (always true), so any league member would have
--     seen every league's members.
--
-- The membership check now lives in a SECURITY DEFINER helper, which reads
-- league_members without going through its RLS, and each policy names its own
-- table in full. Members (and admins) see their leagues, invite codes and
-- members; everyone else sees nothing.
-- =============================================================================

create or replace function public.fantasy_is_league_member(p_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.league_members lm
    join public.managers m on m.id = lm.manager_id
    where lm.league_id = p_league_id
      and m.user_id = auth.uid()
  );
$$;

revoke all on function public.fantasy_is_league_member(uuid) from public, anon;
grant execute on function public.fantasy_is_league_member(uuid) to authenticated;

drop policy if exists "Members read own leagues" on public.leagues;
create policy "Members read own leagues" on public.leagues
  for select to authenticated
  using (public.fantasy_is_league_member(leagues.id));

drop policy if exists "Members read league members" on public.league_members;
create policy "Members read league members" on public.league_members
  for select to authenticated
  using (public.fantasy_is_league_member(league_members.league_id));
