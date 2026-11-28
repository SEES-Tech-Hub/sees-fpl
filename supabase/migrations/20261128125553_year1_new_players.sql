-- =============================================================================
-- Year 1: seven players who played on Matchday 1 but weren't registered
-- Owner: Tayo
--
-- From Year 1's real team sheet against Year 2. ₦4.0m each; positions from
-- where they played (Solomon and Michael came off the bench: midfield).
-- Pickable in fantasy from Matchday 2. Fixed ids, so safe to run twice.
-- =============================================================================

insert into public.players (id, team_id, full_name, display_name, position, price_tenths, status)
select p.id::uuid, t.id, p.full_name, p.display_name, p.position::public.player_position, 40, 'available'
from public.teams t
cross join (values
  ('67003c0e-f806-4d24-9c9a-654f10aaa9be', 'Bayo',               'Bayo',    'DEF'),
  ('05e08def-90c9-4c0f-a7f2-d0a1b59f3737', 'Xenon',              'Xenon',   'DEF'),
  ('39adc53c-71f7-4705-86ff-cc9dedf41665', 'Jude',               'Jude',    'MID'),
  ('e3260831-daec-4f76-89c1-06bdd95f2a2b', 'Destiny',            'Destiny', 'MID'),
  ('6ca0cccc-4048-4741-9e3f-ff5763bd176a', 'Akindele Oluwaseun', 'Seun',    'FWD'),
  ('65c59b4b-305c-46ab-a01a-bc9b6a71755a', 'Solomon',            'Solomon', 'MID'),
  ('e92367d4-0e9a-4fe8-bbdc-550c728c0613', 'Michael',            'Michael', 'MID')
) as p(id, full_name, display_name, position)
where t.year = 1
on conflict (id) do nothing;
