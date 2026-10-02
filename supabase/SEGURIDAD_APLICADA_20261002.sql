-- Already applied to project cmrydhzpcuklfvigboka through the connector on 2026-10-02.
-- Included as an audit record, not an instruction to repeat unreviewed operations.
begin;
drop policy if exists reservas_read on public.reservas;
revoke select on table public.reservas from public,anon,authenticated;
grant select on table public.reservas to service_role;
alter function public.reserve_seats_v2(integer,integer,text,text,text,text,jsonb,jsonb) set search_path='';
commit;
-- Verified after applying: 24 reservation records and 36 legacy tables preserved.
-- anon and authenticated SELECT reservas = false; service_role SELECT = true.
-- Public SELECT mesas and EXECUTE reserve_seats_v2 remain available.
