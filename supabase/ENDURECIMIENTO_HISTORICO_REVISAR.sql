-- Apply only after reviewing existing consumers. Not part of automatic migration.
-- The current public form reads mesas and calls reserve_seats_v2; it does not
-- need SELECT access to the personal data in reservas.
begin;
drop policy if exists reservas_read on public.reservas;
revoke select on public.reservas from anon,authenticated;
alter function public.reserve_seats_v2(integer,integer,text,text,text,text,jsonb,jsonb) set search_path='';
-- The old admin procedure uses unqualified names. Qualify safely without exposing it anew.
create or replace function public.admin_update_reservados(p_code text,p_mesa_id integer,p_reservados integer)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.app_config where admin_code=p_code) then raise exception 'NO_AUTH'; end if;
 if p_reservados<0 or p_reservados>(select aforo from public.mesas where id=p_mesa_id) then raise exception 'INVALID_COUNT'; end if;
 update public.mesas set reservados=p_reservados where id=p_mesa_id;
end $$;
commit;
-- Legacy password-code administration remains a cutover concern. At replacement,
-- revoke execution of this old procedure from anon/authenticated and PUBLIC.
-- Do not shut down the legacy booking RPC while the original page is still active.
