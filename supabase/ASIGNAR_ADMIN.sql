-- FIRST create the administrator through Supabase Dashboard > Authentication > Users.
-- Use a real email controlled by Events for password recovery. Do not store a
-- password in this script. Replace ONLY the placeholder email below.
do $$
declare wanted_email text := 'REEMPLAZAR_CORREO_ADMIN'; user_record record;
begin
 if wanted_email='REEMPLAZAR_CORREO_ADMIN' then raise exception 'Primero escribe el correo del usuario creado en Supabase Auth'; end if;
 select id,email into user_record from auth.users where lower(email)=lower(wanted_email);
 if not found then raise exception 'Primero crea este usuario en Supabase Auth'; end if;
 insert into public.bn_admin_users(user_id,username,email,enabled)
 values(user_record.id,'eventosyservicios',user_record.email,true)
 on conflict(user_id) do update set username=excluded.username,email=excluded.email,enabled=true;
end $$;
-- The interface accepts EventosyServicios. Authentication and password hashing are
-- handled by Supabase Auth; the browser cannot self-assign this role.
