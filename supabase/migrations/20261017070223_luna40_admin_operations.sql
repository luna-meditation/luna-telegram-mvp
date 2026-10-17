-- Luna only. No seed data, pricing, legacy entitlement, payment or other-app changes.
begin;
create table if not exists public.luna40_admin_audit (
 id uuid primary key default gen_random_uuid(), actor bigint not null, target bigint,
 request_id uuid not null, action text not null, reason text not null check(length(reason) between 3 and 500),
 input jsonb not null, previous jsonb, result jsonb not null, created_at timestamptz not null default now(),
 unique(actor,request_id)
);
create index if not exists luna40_admin_audit_target_created on public.luna40_admin_audit(target,created_at desc);
create table if not exists public.luna40_entitlement_grants (
 id uuid primary key default gen_random_uuid(), telegram_id bigint not null references public.users(telegram_id) on delete cascade,
 source text not null check(source in ('gift','promotion','support','partnership','beta','manual')),
 starts_at timestamptz not null default now(), expires_at timestamptz, lifetime boolean not null default false,
 revoked_at timestamptz, actor bigint not null, reason text not null, created_at timestamptz not null default now(),
 check ((lifetime and expires_at is null) or (not lifetime and expires_at > starts_at))
);
create index if not exists luna40_grants_owner on public.luna40_entitlement_grants(telegram_id,expires_at);
create table if not exists public.luna40_quota_grants (
 id uuid primary key default gen_random_uuid(), telegram_id bigint not null references public.users(telegram_id) on delete cascade,
 quantity integer not null check(quantity between 1 and 100), expires_at timestamptz not null,
 revoked_at timestamptz,actor bigint not null,reason text not null,created_at timestamptz not null default now()
);
create index if not exists luna40_quota_owner_expiry on public.luna40_quota_grants(telegram_id,expires_at);
create table if not exists public.luna40_quota_uses (
 telegram_id bigint not null references public.users(telegram_id) on delete cascade,operation_key text not null,
 grant_id uuid not null references public.luna40_quota_grants(id),lease uuid not null,
 state text not null check(state in ('held','consumed','released')),created_at timestamptz not null default now(),
 primary key(telegram_id,operation_key)
);
create index if not exists luna40_quota_uses_grant on public.luna40_quota_uses(grant_id,state);
create table if not exists public.luna40_wallet_adjustments (
 id uuid primary key default gen_random_uuid(), telegram_id bigint not null references public.users(telegram_id) on delete cascade,
 actor bigint not null, request_id uuid not null, delta integer not null check(delta<>0),
 balance_before integer not null check(balance_before>=0), balance_after integer not null check(balance_after>=0),
 reason text not null, created_at timestamptz not null default now(), unique(actor,request_id),
 check(balance_after=balance_before+delta)
);
create index if not exists luna40_adjustments_owner on public.luna40_wallet_adjustments(telegram_id,created_at desc);
create table if not exists public.luna40_content_versions (
 id uuid primary key default gen_random_uuid(), kind text not null check(kind in ('meditation','breathwork','tarot','astrology','garden','achievement','share','bot')),
 content_key text not null check(length(content_key) between 1 and 100), version integer not null check(version>0),
 state text not null check(state in ('draft','published','archived')), body jsonb not null check(jsonb_typeof(body)='object'),
 actor bigint not null, created_at timestamptz not null default now(), unique(kind,content_key,version)
);
create index if not exists luna40_content_latest on public.luna40_content_versions(kind,content_key,version desc);
create table if not exists public.luna40_support_workflow (
 ticket_id uuid primary key references public.support_requests(id) on delete cascade,
 status text not null check(status in ('open','in_progress','resolved','closed')),
 priority text not null check(priority in ('low','normal','high','urgent')), revision integer not null default 1,
 actor bigint not null, updated_at timestamptz not null default now()
);
create table if not exists public.luna40_support_notes (
 id uuid primary key default gen_random_uuid(), ticket_id uuid not null references public.support_requests(id) on delete cascade,
 actor bigint not null, note text not null check(length(note) between 1 and 2000), created_at timestamptz not null default now()
);
create index if not exists luna40_support_notes_ticket on public.luna40_support_notes(ticket_id,created_at);
alter table public.luna40_admin_audit enable row level security;
alter table public.luna40_admin_audit force row level security;
alter table public.luna40_quota_grants enable row level security;
alter table public.luna40_quota_grants force row level security;
alter table public.luna40_quota_uses enable row level security;
alter table public.luna40_quota_uses force row level security;
revoke all on public.luna40_quota_grants,public.luna40_quota_uses from public,anon,authenticated;
grant select,insert,update on public.luna40_quota_grants,public.luna40_quota_uses to service_role;
alter table public.luna40_entitlement_grants enable row level security;
alter table public.luna40_entitlement_grants force row level security;
alter table public.luna40_wallet_adjustments enable row level security;
alter table public.luna40_wallet_adjustments force row level security;
alter table public.luna40_content_versions enable row level security;
alter table public.luna40_content_versions force row level security;
alter table public.luna40_support_workflow enable row level security;
alter table public.luna40_support_workflow force row level security;
alter table public.luna40_support_notes enable row level security;
alter table public.luna40_support_notes force row level security;
revoke all on public.luna40_admin_audit,public.luna40_entitlement_grants,public.luna40_wallet_adjustments,public.luna40_content_versions,public.luna40_support_workflow,public.luna40_support_notes from public,anon,authenticated;
grant select,insert on public.luna40_admin_audit,public.luna40_wallet_adjustments,public.luna40_content_versions,public.luna40_support_notes to service_role;
grant select,insert,update on public.luna40_entitlement_grants,public.luna40_support_workflow to service_role;

create or replace function public.luna40_admin_operation(p_actor bigint,p_target bigint,p_request uuid,p_action text,p_reason text,p_input jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare prior public.luna40_admin_audit%rowtype; before_value jsonb; result_value jsonb; balance_value integer; next_balance bigint; grant_row public.luna40_entitlement_grants%rowtype; quota_row public.luna40_quota_grants%rowtype; latest integer; ticket public.support_requests%rowtype; workflow public.luna40_support_workflow%rowtype; item public.meditations%rowtype; key_value text;
begin
 if p_actor is null or p_actor<=0 or p_request is null or p_reason is null or length(btrim(p_reason)) not between 3 and 500 or p_input is null or jsonb_typeof(p_input)<>'object' then raise exception 'Invalid admin operation' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('luna40_admin:'||p_actor||':'||p_request,0));
 select * into prior from public.luna40_admin_audit where actor=p_actor and request_id=p_request;
 if found then
  if prior.action<>p_action or prior.target is distinct from p_target or prior.input<>p_input or prior.reason<>p_reason then raise exception 'Idempotency conflict' using errcode='23505';end if;
  return prior.result;
 end if;
 if p_action in ('wallet.adjust','entitlement.grant','entitlement.revoke','entitlement.restore','quota.grant','quota.revoke') and not exists(select 1 from public.users where telegram_id=p_target) then raise exception 'User not found' using errcode='P0002';end if;
 if p_action='wallet.adjust' then
  perform pg_advisory_xact_lock(hashtextextended('luna21_wallet:'||p_target,0));
  select moon_seeds_available into balance_value from public.moon_gardens where telegram_id=p_target for update;
  if not found then raise exception 'Wallet not initialized; no implicit creation' using errcode='P0002';end if;
  if balance_value<>(p_input->>'expectedBalance')::integer then raise exception 'Wallet changed; refresh confirmation' using errcode='40001';end if;
  next_balance:=balance_value+(p_input->>'delta')::bigint;
  if next_balance<0 or next_balance>2147483647 or abs((p_input->>'delta')::bigint)>1000000 or (p_input->>'delta')::integer=0 then raise exception 'Invalid wallet adjustment' using errcode='22023';end if;
  before_value:=jsonb_build_object('balance',balance_value);result_value:=jsonb_build_object('balance',next_balance,'delta',(p_input->>'delta')::integer);
  update public.moon_gardens set moon_seeds_available=next_balance::integer,updated_at=now() where telegram_id=p_target;
  insert into public.luna40_wallet_adjustments(telegram_id,actor,request_id,delta,balance_before,balance_after,reason) values(p_target,p_actor,p_request,(p_input->>'delta')::integer,balance_value,next_balance::integer,p_reason);
 elsif p_action='entitlement.grant' then
  if coalesce(p_input->>'source','') not in ('gift','promotion','support','partnership','beta','manual') or coalesce(p_input->>'duration','') not in ('7','30','90','365','lifetime') then raise exception 'Invalid grant' using errcode='22023';end if;
  insert into public.luna40_entitlement_grants(telegram_id,source,expires_at,lifetime,actor,reason) values(p_target,p_input->>'source',case when p_input->>'duration'='lifetime' then null else now()+make_interval(days=>(p_input->>'duration')::integer) end,p_input->>'duration'='lifetime',p_actor,p_reason) returning * into grant_row;
  result_value:=to_jsonb(grant_row);
 elsif p_action in ('entitlement.revoke','entitlement.restore') then
  select * into grant_row from public.luna40_entitlement_grants where id=(p_input->>'grantId')::uuid and telegram_id=p_target for update;
  if not found then raise exception 'Independent grant not found' using errcode='P0002';end if;
  if p_action='entitlement.restore' and not grant_row.lifetime and grant_row.expires_at<=now() then raise exception 'Expired grant cannot be restored' using errcode='22023';end if;
  before_value:=to_jsonb(grant_row);
  update public.luna40_entitlement_grants set revoked_at=case when p_action='entitlement.revoke' then now() else null end where id=grant_row.id returning * into grant_row;result_value:=to_jsonb(grant_row);
 elsif p_action='entitlement.extend' then
  select * into grant_row from public.luna40_entitlement_grants where id=(p_input->>'grantId')::uuid and telegram_id=p_target for update;
  if not found then raise exception 'Independent grant not found' using errcode='P0002';end if;
  if grant_row.lifetime or grant_row.revoked_at is not null or coalesce(p_input->>'days','') not in ('7','30','90','365') then raise exception 'Only an eligible fixed-term admin grant can be extended' using errcode='22023';end if;
  if grant_row.expires_at is distinct from (p_input->>'expectedExpiresAt')::timestamptz then raise exception 'Grant changed; refresh confirmation' using errcode='40001';end if;
  before_value:=to_jsonb(grant_row);update public.luna40_entitlement_grants set expires_at=greatest(now(),expires_at)+make_interval(days=>(p_input->>'days')::integer) where id=grant_row.id returning * into grant_row;result_value:=to_jsonb(grant_row);
 elsif p_action='quota.grant' then
  if (p_input->>'quantity')::integer not between 1 and 100 or (p_input->>'expiresAt')::timestamptz<=now() or (p_input->>'expiresAt')::timestamptz>now()+interval '366 days' then raise exception 'Invalid quota grant' using errcode='22023';end if;
  insert into public.luna40_quota_grants(telegram_id,quantity,expires_at,actor,reason) values(p_target,(p_input->>'quantity')::integer,(p_input->>'expiresAt')::timestamptz,p_actor,p_reason) returning * into quota_row;result_value:=to_jsonb(quota_row);
 elsif p_action='quota.revoke' then
  perform pg_advisory_xact_lock(3272001);
  select * into quota_row from public.luna40_quota_grants where telegram_id=p_target and id=(p_input->>'grantId')::uuid for update;
  if not found then raise exception 'Quota grant not found' using errcode='P0002';end if;
  before_value:=to_jsonb(quota_row);update public.luna40_quota_grants set revoked_at=now() where id=quota_row.id returning * into quota_row;result_value:=to_jsonb(quota_row);
 elsif p_action='role.grant' then
  if coalesce(p_input->>'role','') not in ('administrator','content_manager','support_agent','analyst') then raise exception 'Invalid role' using errcode='22023';end if;
  select to_jsonb(r) into before_value from public.luna40_admin_roles r where telegram_id=p_target for update;
  insert into public.luna40_admin_roles(telegram_id,role,granted_by) values(p_target,p_input->>'role',p_actor) on conflict(telegram_id) do update set role=excluded.role,granted_by=excluded.granted_by,revoked_at=null;
  result_value:=jsonb_build_object('telegram_id',p_target,'role',p_input->>'role');
 elsif p_action='role.revoke' then
  select to_jsonb(r) into before_value from public.luna40_admin_roles r where telegram_id=p_target for update;
  if before_value is null then raise exception 'Role not found' using errcode='P0002';end if;
  update public.luna40_admin_roles set revoked_at=now() where telegram_id=p_target;
  result_value:=jsonb_build_object('telegram_id',p_target,'revoked',true);
 elsif p_action='content.save' then
  key_value:=p_input->>'key';
  perform pg_advisory_xact_lock(hashtextextended('luna40_content:'||(p_input->>'kind')||':'||key_value,0));
  select coalesce(max(version),0) into latest from public.luna40_content_versions where kind=p_input->>'kind' and content_key=key_value;
  if latest<>(p_input->>'expectedVersion')::integer then raise exception 'Content changed; reload version' using errcode='40001';end if;
  if p_input->>'state'='published' and p_input->>'kind'<>'meditation' then raise exception 'Editorial consumer not verified; keep as draft' using errcode='22023';end if;
  if p_input->>'kind'='meditation' and p_input->>'state' in ('published','archived') then
   select * into item from public.meditations where id=key_value::uuid for update;
   before_value:=case when found then to_jsonb(item) else null end;
   if p_input->>'state'='archived' then
    if item.id is null then raise exception 'Meditation not found' using errcode='P0002';end if;
    update public.meditations set published=false,updated_at=now() where id=item.id;
   else
    insert into public.meditations(id,title,subtitle,description,category,duration,cover_image,audio_file,premium,mood,published,translations)
    values(key_value::uuid,p_input#>>'{body,title}',coalesce(p_input#>>'{body,subtitle}',''),p_input#>>'{body,description}',p_input#>>'{body,category}',(p_input#>>'{body,duration}')::integer,p_input#>>'{body,cover_image}',p_input#>>'{body,audio_file}',(p_input#>>'{body,premium}')::boolean,p_input#>>'{body,mood}',true,p_input#>'{body,translations}')
    on conflict(id) do update set title=excluded.title,subtitle=excluded.subtitle,description=excluded.description,category=excluded.category,duration=excluded.duration,cover_image=excluded.cover_image,audio_file=excluded.audio_file,premium=excluded.premium,mood=excluded.mood,published=true,translations=excluded.translations,updated_at=now();
   end if;
  end if;
  insert into public.luna40_content_versions(kind,content_key,version,state,body,actor) values(p_input->>'kind',key_value,latest+1,p_input->>'state',p_input->'body',p_actor);
  result_value:=jsonb_build_object('key',key_value,'version',latest+1,'state',p_input->>'state');
 elsif p_action='support.update' then
  select * into ticket from public.support_requests where id=(p_input->>'ticketId')::uuid for update;
  if not found then raise exception 'Ticket not found' using errcode='P0002';end if;
  select * into workflow from public.luna40_support_workflow where ticket_id=ticket.id;
  if coalesce(workflow.revision,0)<>(p_input->>'expectedRevision')::integer then raise exception 'Ticket changed; reload' using errcode='40001';end if;
  before_value:=jsonb_build_object('status',coalesce(workflow.status,case when ticket.status='new' then 'open' else ticket.status end),'priority',coalesce(workflow.priority,'normal'));
  insert into public.luna40_support_workflow(ticket_id,status,priority,actor) values(ticket.id,p_input->>'status',p_input->>'priority',p_actor) on conflict(ticket_id) do update set status=excluded.status,priority=excluded.priority,revision=public.luna40_support_workflow.revision+1,actor=p_actor,updated_at=now() returning * into workflow;
  update public.support_requests set status=case when workflow.status='open' then 'new' when workflow.status='closed' then 'resolved' else workflow.status end,updated_at=now() where id=ticket.id;
  if length(btrim(coalesce(p_input->>'note','')))>0 then insert into public.luna40_support_notes(ticket_id,actor,note) values(ticket.id,p_actor,p_input->>'note');end if;
  result_value:=to_jsonb(workflow);
 else raise exception 'Unsupported admin operation' using errcode='22023';end if;
 insert into public.luna40_admin_audit(actor,target,request_id,action,reason,input,previous,result) values(p_actor,p_target,p_request,p_action,p_reason,p_input,before_value,result_value);
 return result_value;
end;$$;
revoke all on function public.luna40_admin_operation(bigint,bigint,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.luna40_admin_operation(bigint,bigint,uuid,text,text,jsonb) to service_role;
-- Narrow legacy grants needed by invoker; these are existing Luna objects only.
grant select,insert,update on public.meditations to service_role;
grant select,update on public.moon_gardens,public.support_requests to service_role;
grant insert,update on public.luna40_admin_roles to service_role;
create or replace function public.luna40_quota_available(p_owner bigint) returns integer language sql stable security invoker set search_path='' as $$
 select coalesce(sum(greatest(0,g.quantity-(select count(*) from public.luna40_quota_uses u where u.grant_id=g.id and u.state in ('held','consumed')))),0)::integer
 from public.luna40_quota_grants g where g.telegram_id=p_owner and g.revoked_at is null and g.expires_at>now()
$$;
-- Wrap, do not replace, the existing authoritative global budget reservation.
create or replace function public.luna40_reserve_ai_attempt(p_owner bigint,p_operation text,p_lease uuid,p_call integer,p_attempt uuid,p_model text,p_ceiling bigint,p_limit integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare used integer; selected_grant uuid; held public.luna40_quota_uses%rowtype; result_value jsonb;begin
 perform pg_advisory_xact_lock(3272001);
 if p_limit is null or p_limit not between 1 and 500 then raise exception 'Invalid base limit' using errcode='22023';end if;
 used:=public.luna32_ai_used(p_owner,p_operation);
 if used<p_limit then return public.luna32_reserve_ai_attempt(p_owner,p_operation,p_lease,p_call,p_attempt,p_model,p_ceiling,p_limit);end if;
 if used>=500 then return jsonb_build_object('status','daily_limit');end if;
 select * into held from public.luna40_quota_uses where telegram_id=p_owner and operation_key=p_operation;
 if found and held.state='held' and held.lease=p_lease then selected_grant:=held.grant_id;
 else
  select g.id into selected_grant from public.luna40_quota_grants g where g.telegram_id=p_owner and g.revoked_at is null and g.expires_at>now() and g.quantity>(select count(*) from public.luna40_quota_uses u where u.grant_id=g.id and u.state in ('held','consumed')) order by g.expires_at,g.id limit 1 for update;
 end if;
 if selected_grant is null then return jsonb_build_object('status','daily_limit');end if;
 result_value:=public.luna32_reserve_ai_attempt(p_owner,p_operation,p_lease,p_call,p_attempt,p_model,p_ceiling,used+1);
 if result_value->>'status'='reserved' then
  insert into public.luna40_quota_uses(telegram_id,operation_key,grant_id,lease,state) values(p_owner,p_operation,selected_grant,p_lease,'held') on conflict(telegram_id,operation_key) do update set grant_id=excluded.grant_id,lease=excluded.lease,state='held';
 end if;return result_value;
end;$$;
create or replace function public.luna40_finish_quota(p_owner bigint,p_operation text,p_lease uuid,p_success boolean)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if p_success is null then raise exception 'Missing quota outcome' using errcode='22023';end if;
 perform pg_advisory_xact_lock(3272001);
 update public.luna40_quota_uses set state=case when p_success then 'consumed' else 'released' end where telegram_id=p_owner and operation_key=p_operation and lease=p_lease and state='held';
 return found;
end;$$;
revoke all on function public.luna40_quota_available(bigint),public.luna40_reserve_ai_attempt(bigint,text,uuid,integer,uuid,text,bigint,integer),public.luna40_finish_quota(bigint,text,uuid,boolean) from public,anon,authenticated;
grant execute on function public.luna40_quota_available(bigint),public.luna40_reserve_ai_attempt(bigint,text,uuid,integer,uuid,text,bigint,integer),public.luna40_finish_quota(bigint,text,uuid,boolean) to service_role;
create or replace function public.luna40_admin_operational_report(p_from timestamptz,p_to timestamptz)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare tools jsonb; acknowledgements jsonb; providers jsonb; referrals jsonb; economy jsonb;begin
 if p_from is null or p_to is null or p_to<=p_from or p_to-p_from>interval '366 days' then raise exception 'Invalid report period' using errcode='22023';end if;
 select coalesce(jsonb_agg(to_jsonb(t)),'[]') into tools from (select tool_name,status,error_code,count(*) as operations,round(avg(latency_ms)) as average_latency_ms,percentile_disc(0.95) within group(order by latency_ms) as p95_latency_ms from public.luna40_tool_executions where created_at>=p_from and created_at<p_to group by tool_name,status,error_code order by count(*) desc limit 100)t;
 select coalesce(jsonb_agg(to_jsonb(t)),'[]') into acknowledgements from (select event,count(*) as observed from public.luna40_ui_acknowledgements where observed_at>=p_from and observed_at<p_to group by event)t;
 select coalesce(jsonb_agg(to_jsonb(t)),'[]') into providers from (select model,state,count(*) as calls,sum(actual_cost_microusd) as known_cost_microusd,count(*) filter(where actual_cost_microusd is null) as unknown_cost_calls from public.luna32_ai_attempts where created_at>=p_from and created_at<p_to group by model,state)t;
 if to_regclass('public.luna30_referrals') is not null then
  execute 'select coalesce(jsonb_agg(to_jsonb(t)),''[]'') from (select state,count(*) as users from public.luna30_referrals where created_at>=$1 and created_at<$2 group by state)t' into referrals using p_from,p_to;
 end if;
 if to_regclass('public.luna_seed_ledger') is not null then
  execute 'select coalesce(jsonb_agg(to_jsonb(t)),''[]'') from (select kind,count(*) as transactions,sum(delta) as net_seeds from public.luna_seed_ledger where created_at>=$1 and created_at<$2 group by kind)t' into economy using p_from,p_to;
 end if;
 return jsonb_build_object('from',p_from,'to',p_to,'timezone','UTC','generatedAt',now(),'tools',tools,'uiAcknowledgements',acknowledgements,'providers',providers,'referrals',referrals,'economy',economy,'coverage',jsonb_build_object('preTelemetryEventsAvailable',false,'privateMessagesIncluded',false,'usdRevenueAvailable',false,'unknownCostIsZero',false));
end;$$;
revoke all on function public.luna40_admin_operational_report(timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.luna40_admin_operational_report(timestamptz,timestamptz) to service_role;
commit;
-- SAFE ROLLBACK: disable FEATURE_ADMIN_V4_MUTATIONS and FEATURE_ADMIN_V4 first;
-- revoke execute on function public.luna40_admin_operation(bigint,bigint,uuid,text,text,jsonb) from service_role;
-- Keep audit, versions, grants and ledger. Do NOT drop them or reverse genuine wallet transactions.
-- Metadata rollback is a NEW version using the reviewed previous body, never a DELETE.
