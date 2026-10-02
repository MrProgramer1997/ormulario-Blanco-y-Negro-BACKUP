-- Isolated 2026 schema. Does not rename, delete or copy historic reservations.
-- This release enables TEST operations only. No real checkout is enabled.
begin;
create table if not exists public.bn_events (
 id uuid primary key default gen_random_uuid(), slug text not null unique,
 name text not null, starts_at timestamptz not null, environment text not null check(environment in ('test','live')),
 enabled boolean not null default false, member_price integer not null check(member_price>0),
 guest_price integer not null check(guest_price>0), created_at timestamptz not null default now()
);
create table if not exists public.bn_tables (
 event_id uuid not null references public.bn_events(id), number integer not null check(number between 1 and 45),
 zone text not null check(zone in ('Rialto','Lobby')), capacity integer not null default 10 check(capacity between 8 and 10),
 blocked boolean not null default false, primary key(event_id,number)
);
create table if not exists public.bn_admin_users (
 user_id uuid primary key references auth.users(id) on delete cascade,
 username text not null unique check(username ~ '^[a-z0-9_]{3,40}$'),
 email text not null, enabled boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.bn_reservations (
 id uuid primary key default gen_random_uuid(), event_id uuid not null, table_number integer not null,
 request_id uuid not null unique, request_hash text not null, status_token_hash text not null,
 created_by uuid not null references auth.users(id), invoice text not null unique,
 status text not null default 'held' check(status in ('held','opening','payment_pending','confirmed','declined','expired','review','cancelled')),
 responsible_name text not null, email text not null, phone text not null,
 quantity integer not null check(quantity between 8 and 10), member_count integer not null check(member_count>=0),
 guest_count integer not null check(guest_count>=0), amount integer not null check(amount>0),
 commercial_amount integer not null check(commercial_amount>0), test_case text,
 expires_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(quantity=member_count+guest_count), foreign key(event_id,table_number) references public.bn_tables(event_id,number)
);
create unique index if not exists bn_one_active_table on public.bn_reservations(event_id,table_number)
 where status in ('held','opening','payment_pending','confirmed','review');
create index if not exists bn_reservations_created_by_idx on public.bn_reservations(created_by);
create index if not exists bn_reservations_event_created_idx on public.bn_reservations(event_id,created_at desc);
create table if not exists public.bn_attendees (
 id uuid primary key default gen_random_uuid(), reservation_id uuid not null references public.bn_reservations(id) on delete cascade,
 kind text not null check(kind in ('member','guest')), first_name text not null, last_name text not null,
 member_action text, doc_type text, document text, email text, phone text,
 check((kind='member' and length(trim(member_action))>0) or (kind='guest' and length(trim(document))>0 and length(trim(email))>0 and length(trim(phone))>0))
);
create index if not exists bn_attendees_reservation_idx on public.bn_attendees(reservation_id);
create table if not exists public.bn_payments (
 reservation_id uuid primary key references public.bn_reservations(id), session_id text,
 provider_ref text unique, transaction_id text, status text not null default 'created',
 amount_paid integer, provider_status text, verified_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.bn_audit (
 id bigint generated always as identity primary key, reservation_id uuid references public.bn_reservations(id),
 actor uuid references auth.users(id), action text not null, detail jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists bn_audit_reservation_idx on public.bn_audit(reservation_id);
create index if not exists bn_audit_actor_idx on public.bn_audit(actor);
create table if not exists public.bn_rate_limits (
 bucket text primary key, window_start timestamptz not null, hits integer not null
);
alter table public.bn_events enable row level security;
alter table public.bn_tables enable row level security;
alter table public.bn_admin_users enable row level security;
alter table public.bn_reservations enable row level security;
alter table public.bn_attendees enable row level security;
alter table public.bn_payments enable row level security;
alter table public.bn_audit enable row level security;
alter table public.bn_rate_limits enable row level security;
-- No permissive browser policies. The API exposes only approved projections and
-- verifies every admin session server-side before using the service credential.
revoke all on public.bn_events,public.bn_tables,public.bn_admin_users,public.bn_reservations,
 public.bn_attendees,public.bn_payments,public.bn_audit,public.bn_rate_limits from anon,authenticated;
grant all on public.bn_events,public.bn_tables,public.bn_admin_users,public.bn_reservations,
 public.bn_attendees,public.bn_payments,public.bn_audit,public.bn_rate_limits to service_role;
grant usage,select on sequence public.bn_audit_id_seq to service_role;
insert into public.bn_events(slug,name,starts_at,environment,enabled,member_price,guest_price)
values ('blanco-negro-2026','Fiesta Blanco y Negro 2026','2026-11-06 19:00:00-05','live',false,180000,260000),
 ('blanco-negro-2026-test','Pruebas - Fiesta Blanco y Negro 2026','2026-11-06 19:00:00-05','test',true,180000,260000)
on conflict(slug) do nothing;
insert into public.bn_tables(event_id,number,zone)
select e.id,n,case when n<=33 then 'Rialto' else 'Lobby' end
from public.bn_events e cross join generate_series(1,45) n
where e.slug in ('blanco-negro-2026','blanco-negro-2026-test') on conflict do nothing;

create or replace function public.bn_rate_limit(p_bucket text,p_limit integer,p_seconds integer)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_hits integer;
begin
 if length(p_bucket)>160 or p_limit<1 or p_seconds<1 then return false; end if;
 insert into public.bn_rate_limits(bucket,window_start,hits) values(p_bucket,now(),1)
 on conflict(bucket) do update set
 hits=case when public.bn_rate_limits.window_start<now()-make_interval(secs=>p_seconds) then 1 else public.bn_rate_limits.hits+1 end,
 window_start=case when public.bn_rate_limits.window_start<now()-make_interval(secs=>p_seconds) then now() else public.bn_rate_limits.window_start end
 returning hits into v_hits;
 return v_hits<=p_limit;
end $$;

create or replace function public.bn_catalog()
returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('mode','test','memberPrice',e.member_price,'guestPrice',e.guest_price,
 'tables',(select jsonb_agg(jsonb_build_object('number',t.number,'zone',t.zone,'capacity',t.capacity,'status',
 case when t.blocked then 'blocked' when exists(select 1 from public.bn_reservations r where r.event_id=t.event_id and r.table_number=t.number and r.status='confirmed') then 'occupied'
 when exists(select 1 from public.bn_reservations r where r.event_id=t.event_id and r.table_number=t.number and r.status in ('held','opening','payment_pending','review') and (r.status<>'held' or r.expires_at>now())) then 'held'
 else 'available' end) order by t.number) from public.bn_tables t where t.event_id=e.id))
 from public.bn_events e where e.slug='blanco-negro-2026-test';
$$;

create or replace function public.bn_create_test_reservation(p_data jsonb,p_request_id uuid,p_request_hash text,p_token_hash text,p_actor uuid,p_case text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare ev public.bn_events; r public.bn_reservations; item jsonb; q integer; m integer; g integer; a integer; commercial integer; n integer; invoice_id text;
begin
 if not exists(select 1 from public.bn_admin_users where user_id=p_actor and enabled) then raise exception 'NOT_AUTHORIZED'; end if;
 if p_token_hash !~ '^[a-f0-9]{64}$' or p_request_hash !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_REQUEST'; end if;
 -- Serializes retries sharing an idempotency key, including a competing table change.
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 select * into r from public.bn_reservations where request_id=p_request_id;
 if found then
  if r.created_by<>p_actor or r.status_token_hash<>p_token_hash or r.request_hash<>p_request_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  return to_jsonb(r);
 end if;
 select * into ev from public.bn_events where slug='blanco-negro-2026-test' and environment='test' and enabled;
 if not found then raise exception 'TESTS_DISABLED'; end if;
 q=(p_data->>'quantity')::integer;n=(p_data->>'table')::integer;
 if q not between 8 and 10 or jsonb_typeof(p_data->'attendees')<>'array' or jsonb_array_length(p_data->'attendees')<>q then raise exception 'INVALID_ATTENDEES'; end if;
 select count(*) filter(where x->>'type'='member'),count(*) filter(where x->>'type'='guest') into m,g from jsonb_array_elements(p_data->'attendees') x;
 if m+g<>q then raise exception 'INVALID_ATTENDEE_TYPE'; end if;
 commercial=m*ev.member_price+g*ev.guest_price;
 a=case p_case when 'T1000' then 1000 when 'T1500' then 1500 when 'T3000' then 3000 when 'T5500' then 5500 else commercial end;
 if p_case is not null and p_case not in ('T1000','T1500','T3000','T5500') then raise exception 'INVALID_TEST_CASE'; end if;
 perform 1 from public.bn_tables where event_id=ev.id and number=n and not blocked for update;
 if not found then raise exception 'TABLE_UNAVAILABLE'; end if;
 update public.bn_reservations set status='expired',updated_at=now() where event_id=ev.id and table_number=n and status='held' and expires_at<=now();
 if exists(select 1 from public.bn_reservations where event_id=ev.id and table_number=n and status in ('held','opening','payment_pending','confirmed','review')) then raise exception 'TABLE_UNAVAILABLE'; end if;
 invoice_id='BN26TEST-'||replace(gen_random_uuid()::text,'-','');
 insert into public.bn_reservations(event_id,table_number,request_id,request_hash,status_token_hash,created_by,invoice,responsible_name,email,phone,quantity,member_count,guest_count,amount,commercial_amount,test_case,expires_at)
 values(ev.id,n,p_request_id,p_request_hash,p_token_hash,p_actor,invoice_id,concat_ws(' ',p_data->'responsible'->>'firstName',p_data->'responsible'->>'lastName'),p_data->'responsible'->>'email',p_data->'responsible'->>'phone',q,m,g,a,commercial,p_case,now()+interval '15 minutes') returning * into r;
 for item in select value from jsonb_array_elements(p_data->'attendees') loop
  insert into public.bn_attendees(reservation_id,kind,first_name,last_name,member_action,doc_type,document,email,phone)
  values(r.id,item->>'type',item->>'firstName',item->>'lastName',nullif(item->>'action',''),nullif(item->>'docType',''),nullif(item->>'document',''),nullif(item->>'email',''),nullif(item->>'phone',''));
 end loop;
 insert into public.bn_payments(reservation_id) values(r.id);
 insert into public.bn_audit(reservation_id,actor,action,detail) values(r.id,p_actor,'test_request_created',jsonb_build_object('test_case',p_case,'amount',a));
 return to_jsonb(r);
end $$;

-- Claim is atomic: simultaneous retries must not create two ePayco sessions.
create or replace function public.bn_claim_checkout(p_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 update public.bn_reservations set status='opening',expires_at=null,updated_at=now() where id=p_id and status='held' and expires_at>now();
 return found;
end $$;

create or replace function public.bn_apply_payment(p_invoice text,p_ref text,p_transaction text,p_amount integer,p_currency text,p_test boolean,p_status text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.bn_reservations; pay public.bn_payments; ev public.bn_events; next_state text;
begin
 if p_ref is null or length(p_ref)>128 or p_status not in ('approved','pending','declined','review') then raise exception 'INVALID_PAYMENT'; end if;
 -- Lock table first, then reservation: same order as booking creation.
 select * into r from public.bn_reservations where invoice=p_invoice;
 if not found then return jsonb_build_object('ignored',true); end if;
 perform 1 from public.bn_tables where event_id=r.event_id and number=r.table_number for update;
 select * into r from public.bn_reservations where id=r.id for update;
 select * into ev from public.bn_events where id=r.event_id;
 select * into pay from public.bn_payments where reservation_id=r.id for update;
 if pay.provider_ref is not null and pay.provider_ref<>p_ref then
  insert into public.bn_audit(reservation_id,action,detail) values(r.id,'additional_payment_requires_review',jsonb_build_object('ref',p_ref));
  return jsonb_build_object('review',true);
 end if;
 if exists(select 1 from public.bn_payments where provider_ref=p_ref and reservation_id<>r.id) then raise exception 'REFERENCE_ALREADY_USED'; end if;
 if p_currency<>'COP' or p_amount<>r.amount or p_test is distinct from true or ev.environment<>'test' then
  insert into public.bn_audit(reservation_id,action,detail) values(r.id,'payment_mismatch',jsonb_build_object('ref',p_ref,'amount',p_amount,'currency',p_currency,'test',p_test));
  -- Invalid payment data never confirms or releases the requested table.
  if r.status not in ('confirmed','declined','expired','cancelled') then update public.bn_reservations set status='review',updated_at=now() where id=r.id; end if;
  return jsonb_build_object('review',true);
 end if;
 if pay.status='approved' then return jsonb_build_object('duplicate',true,'status',r.status); end if;
 if pay.status=p_status and pay.provider_ref=p_ref then return jsonb_build_object('duplicate',true,'status',r.status); end if;
 if pay.status='declined' and p_status='pending' then return jsonb_build_object('ignored_stale',true); end if;
 next_state=case p_status when 'approved' then 'confirmed' when 'pending' then 'payment_pending' when 'declined' then 'declined' else 'review' end;
 if p_status='approved' and exists(select 1 from public.bn_reservations x where x.id<>r.id and x.event_id=r.event_id and x.table_number=r.table_number and x.status in ('held','opening','payment_pending','confirmed','review')) then
  -- Do not take a table already assigned to another group after expiry.
  update public.bn_payments set provider_ref=p_ref,transaction_id=p_transaction,status='approved',provider_status='late_payment_conflict',amount_paid=p_amount,verified_at=now(),updated_at=now() where reservation_id=r.id;
  insert into public.bn_audit(reservation_id,action,detail) values(r.id,'late_payment_conflict',jsonb_build_object('ref',p_ref));
  return jsonb_build_object('review',true);
 end if;
 update public.bn_payments set provider_ref=p_ref,transaction_id=p_transaction,status=p_status,provider_status=p_status,amount_paid=p_amount,verified_at=now(),updated_at=now() where reservation_id=r.id;
 update public.bn_reservations set status=next_state,expires_at=null,updated_at=now() where id=r.id;
 insert into public.bn_audit(reservation_id,action,detail) values(r.id,'payment_'||p_status,jsonb_build_object('ref',p_ref,'amount',p_amount,'test',p_test));
 return jsonb_build_object('status',next_state);
end $$;
revoke all on function public.bn_rate_limit(text,integer,integer),public.bn_catalog(),public.bn_create_test_reservation(jsonb,uuid,text,text,uuid,text),public.bn_claim_checkout(uuid),public.bn_apply_payment(text,text,text,integer,text,boolean,text) from public,anon,authenticated;
grant execute on function public.bn_rate_limit(text,integer,integer),public.bn_catalog(),public.bn_create_test_reservation(jsonb,uuid,text,text,uuid,text),public.bn_claim_checkout(uuid),public.bn_apply_payment(text,text,text,integer,text,boolean,text) to service_role;
commit;
