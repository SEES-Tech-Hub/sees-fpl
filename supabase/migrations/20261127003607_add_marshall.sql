-- =============================================================================
-- Add Marshall (Year 4, forward, N11.5m)
-- Author: Tayo, 27 Nov
--
-- Marshall plays for Year 4 (SEES 28) but was missing from the squad. He's
-- one of the most valuable players, at N11.5m, which is above the old N11.0m
-- price cap, so the cap goes up to N12.0m (the check constraint and
-- admin_price_rules(), which the admin price editor reads).
--
-- He gets a fixed id so his photo (public/players/<id>.webp) ships in the
-- same change. Safe to run twice.
-- =============================================================================

alter table public.players drop constraint if exists players_price_tenths_check;
alter table public.players add constraint players_price_tenths_check
  check (price_tenths between 30 and 120 and price_tenths % 5 = 0);

create or replace function public.admin_price_rules()
returns table (min_tenths smallint, max_tenths smallint, step_tenths smallint)
language sql
immutable
set search_path = ''
as $$
  select 30::smallint, 120::smallint, 5::smallint;
$$;

insert into public.players (id, team_id, full_name, display_name, position, price_tenths, status)
select '8baba44b-69a1-4780-b41c-52c23e05b31d', t.id, 'Marshall', 'Marshall', 'FWD', 115, 'available'
from public.teams t
where t.year = 4
on conflict do nothing;

-- =============================================================================
-- Verify (for Tayo, after applying)
-- =============================================================================
-- select p.display_name, p.position, p.price_tenths, t.year
-- from public.players p join public.teams t on t.id = p.team_id
-- where p.id = '8baba44b-69a1-4780-b41c-52c23e05b31d';   -- Marshall, FWD, 115, 4
-- select * from public.admin_price_rules();               -- 30, 120, 5
