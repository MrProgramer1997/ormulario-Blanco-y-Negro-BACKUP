-- Applied through Supabase migration durable_test_confirmation_queue.
-- No raw callbacks, signatures, payer data or API keys are persisted.
create extension if not exists pg_cron;
create extension if not exists pg_net;
create table public.bn_confirmation_jobs (
 id uuid primary key default gen_random_uuid(), merchant text not null, reference text not null, transaction_id text not null,
 amount integer not null check(amount>0), currency text not null check(currency='COP'), invoice_hint text, verified_invoice text,
 state text not null default 'waiting' check(state in ('waiting','processing','done','review','ignored')),
 attempts integer not null default 0 check(attempts>=0), next_attempt_at timestamptz not null default now()+interval '60 seconds',
 lease_id uuid, lease_until timestamptz, last_code text, result_status text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(merchant,reference)
);
alter table public.bn_confirmation_jobs enable row level security;
revoke all on public.bn_confirmation_jobs from public,anon,authenticated;
grant select,insert,update,delete on public.bn_confirmation_jobs to service_role;
create index bn_confirmation_due_idx on public.bn_confirmation_jobs(next_attempt_at) where state in ('waiting','processing');
create function public.bn_confirmation_enqueue(p_proof jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.bn_confirmation_jobs; m text:=p_proof->>'merchant'; r text:=p_proof->>'reference'; t text:=p_proof->>'transaction'; a text:=p_proof->>'amount'; c text:=p_proof->>'currency'; h text:=p_proof->>'invoiceHint';
begin
 if m is null or m !~ '^[0-9]{1,14}$' or r is null or r !~ '^[1-9][0-9]{0,13}$' or t is null or t !~ '^[A-Za-z0-9_-]{1,128}$' or a is null or a !~ '^[1-9][0-9]{0,8}$' or c is distinct from 'COP' then raise exception 'INVALID_PROOF'; end if;
 if h is null or h !~ '^BN26TEST-[a-f0-9]{32}$' then h:=null; end if;
 insert into public.bn_confirmation_jobs(merchant,reference,transaction_id,amount,currency,invoice_hint) values(m,r,t,a::integer,c,h) on conflict(merchant,reference) do nothing;
 select * into j from public.bn_confirmation_jobs where merchant=m and reference=r for update;
 if j.transaction_id<>t or j.amount<>a::integer or j.currency<>c then raise exception 'PROOF_CONFLICT'; end if;
 if j.state='done' and j.updated_at<now()-interval '60 seconds' then
  update public.bn_confirmation_jobs set state='waiting',attempts=0,next_attempt_at=now()+interval '60 seconds',updated_at=now(),last_code=null where id=j.id returning * into j;
 end if;
 return jsonb_build_object('queued',true,'id',j.id,'state',j.state);
end $$;
create function public.bn_confirmation_claim() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 update public.bn_confirmation_jobs set state='review',last_code='RETRIES_EXHAUSTED',lease_id=null,lease_until=null,updated_at=now()
 where (state='waiting' or (state='processing' and lease_until<now())) and (attempts>=16 or created_at<now()-interval '24 hours');
 with due as (
  select id from public.bn_confirmation_jobs where attempts<16 and ((state='waiting' and next_attempt_at<=now()) or (state='processing' and lease_until<=now()))
  order by next_attempt_at for update skip locked limit 2
 ), taken as (
  update public.bn_confirmation_jobs j set state='processing',attempts=j.attempts+1,lease_id=gen_random_uuid(),lease_until=now()+interval '3 minutes',updated_at=now()
  from due where j.id=due.id returning j.*
 ) select coalesce(jsonb_agg(to_jsonb(taken)),'[]'::jsonb) into result from taken;
 return result;
end $$;
create function public.bn_confirmation_finish(p_id uuid,p_lease uuid,p_detail jsonb default null,p_error text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.bn_confirmation_jobs; r public.bn_reservations; applied jsonb; code text; delay_seconds integer; final_state text;
begin
 select * into j from public.bn_confirmation_jobs where id=p_id for update;
 if not found or j.state<>'processing' or j.lease_id is distinct from p_lease then return jsonb_build_object('stale',true); end if;
 code:=case when p_error ~ '^[A-Z0-9_]{1,80}$' then p_error else 'VERIFICATION_NOT_COMPLETED' end;
 if p_detail is not null then
  if (p_detail->>'merchant') is distinct from j.merchant or (p_detail->>'reference') is distinct from j.reference or (p_detail->>'transaction') is distinct from j.transaction_id or (p_detail->>'currency') is distinct from j.currency or (p_detail->>'amount') is distinct from j.amount::text then
   update public.bn_confirmation_jobs set state='review',last_code='PROOF_MISMATCH',lease_id=null,lease_until=null,updated_at=now() where id=j.id;
   return jsonb_build_object('state','review');
  end if;
  if (p_detail->'isTest') is distinct from 'true'::jsonb or (p_detail->>'invoice') !~ '^BN26TEST-[a-f0-9]{32}$' or p_detail->>'invoice' is null then
   update public.bn_confirmation_jobs set state='ignored',last_code='NOT_A_TEST_PAYMENT',lease_id=null,lease_until=null,updated_at=now() where id=j.id;
   return jsonb_build_object('state','ignored');
  end if;
  select * into r from public.bn_reservations where invoice=p_detail->>'invoice';
  if not found then
   update public.bn_confirmation_jobs set state='ignored',last_code='RESERVATION_NOT_FOUND',lease_id=null,lease_until=null,updated_at=now() where id=j.id;
   return jsonb_build_object('state','ignored');
  end if;
  applied:=public.bn_apply_payment(r.invoice,j.reference,j.transaction_id,j.amount,j.currency,true,p_detail->>'status');
  select status into final_state from public.bn_reservations where id=r.id;
  if coalesce((applied->>'review')::boolean,false) or final_state='review' then
   update public.bn_confirmation_jobs set state='review',last_code='PAYMENT_REQUIRES_REVIEW',verified_invoice=r.invoice,result_status='review',lease_id=null,lease_until=null,updated_at=now() where id=j.id;
   return jsonb_build_object('state','review');
  end if;
  if final_state in ('confirmed','declined','cancelled','expired') then
   update public.bn_confirmation_jobs set state='done',last_code=null,verified_invoice=r.invoice,result_status=final_state,lease_id=null,lease_until=null,updated_at=now() where id=j.id;
   return jsonb_build_object('state','done','reservationStatus',final_state,'duplicate',coalesce((applied->>'duplicate')::boolean,false));
  end if;
  code:='PROVIDER_PENDING';
  update public.bn_confirmation_jobs set verified_invoice=r.invoice,result_status=final_state where id=j.id;
 end if;
 delay_seconds:=case j.attempts when 1 then 60 when 2 then 120 when 3 then 300 when 4 then 600 else 900 end;
 update public.bn_confirmation_jobs set state=case when j.attempts>=16 or j.created_at<now()-interval '24 hours' then 'review' else 'waiting' end,
 last_code=code,next_attempt_at=now()+make_interval(secs=>delay_seconds),lease_id=null,lease_until=null,updated_at=now() where id=j.id;
 return jsonb_build_object('state',case when j.attempts>=16 or j.created_at<now()-interval '24 hours' then 'review' else 'waiting' end,'code',code);
end $$;
do $$ begin
 if not exists(select 1 from vault.secrets where name='bn_confirmation_worker_key') then
  perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'bn_confirmation_worker_key','Server-only confirmation worker');
 end if;
end $$;
create function public.bn_confirmation_worker_authorized(p_token text) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then return false; end if;
 return exists(select 1 from vault.decrypted_secrets where name='bn_confirmation_worker_key' and extensions.digest(decrypted_secret,'sha256')=extensions.digest(p_token,'sha256'));
end $$;
create function public.bn_confirmation_dispatch() returns bigint language plpgsql security definer set search_path='' as $$
declare k text; request_id bigint;
begin
 if not exists(select 1 from public.bn_events where slug='blanco-negro-2026-test' and enabled) then return null; end if;
 if not exists(select 1 from public.bn_confirmation_jobs where (state='waiting' and next_attempt_at<=now()) or (state='processing' and lease_until<=now())) then return null; end if;
 select decrypted_secret into strict k from vault.decrypted_secrets where name='bn_confirmation_worker_key';
 request_id:=net.http_post(url:='https://cmrydhzpcuklfvigboka.supabase.co/functions/v1/bn2026-webhook',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||k),body:='{"action":"retry_batch"}'::jsonb,timeout_milliseconds:=55000);
 return request_id;
end $$;
create function public.bn_confirmation_stats() returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('waiting',count(*) filter(where state='waiting'),'processing',count(*) filter(where state='processing'),'done',count(*) filter(where state='done'),'review',count(*) filter(where state='review'),
 'issues',(select coalesce(jsonb_agg(x),'[]'::jsonb) from (select reference,attempts,last_code,updated_at from public.bn_confirmation_jobs where state='review' order by updated_at desc limit 20)x)) from public.bn_confirmation_jobs;
$$;
revoke all on function public.bn_confirmation_enqueue(jsonb),public.bn_confirmation_claim(),public.bn_confirmation_finish(uuid,uuid,jsonb,text),public.bn_confirmation_worker_authorized(text),public.bn_confirmation_stats(),public.bn_confirmation_dispatch() from public,anon,authenticated;
grant execute on function public.bn_confirmation_enqueue(jsonb),public.bn_confirmation_claim(),public.bn_confirmation_finish(uuid,uuid,jsonb,text),public.bn_confirmation_worker_authorized(text),public.bn_confirmation_stats() to service_role;
revoke all on function public.bn_confirmation_dispatch() from service_role;
revoke all on schema net from public,anon,authenticated;
revoke all on all tables in schema net from public,anon,authenticated;
revoke execute on all functions in schema net from public,anon,authenticated;
