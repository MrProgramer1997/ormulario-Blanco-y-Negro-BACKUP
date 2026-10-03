-- Initially used for diagnosis; retained as the dependency of the service-only lookup.
create extension if not exists http with schema extensions;
do $$ declare f record; begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_depend d on d.classid='pg_proc'::regclass and d.objid=p.oid join pg_extension e on e.oid=d.refobjid where e.extname='http' and d.deptype='e' loop
  execute format('revoke all on function %s from public, anon, authenticated', f.signature);
 end loop;
end $$;
