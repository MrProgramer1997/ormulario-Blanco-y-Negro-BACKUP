-- Prepared only; enable after the webhook deployment and safety checks.
do $$ declare v_job bigint; begin
 v_job:=cron.schedule('bn2026-confirmation-retries','* * * * *','select public.bn_confirmation_dispatch();');
 perform cron.alter_job(v_job,active:=false);
end $$;
