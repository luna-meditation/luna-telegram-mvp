-- STAGING ONLY: funvzpmpbgazsisehiru. No production application approval.
-- Dependencies: users and luna_tarot_readings (existing canonical Tarot history).
-- No seed balances, entitlements, payments, or existing RPC definitions are changed.
create table if not exists public.luna24_qa_ai_budget (
 grant_id uuid primary key default gen_random_uuid(),
 telegram_id bigint not null references public.users(telegram_id),
 budget_microusd integer not null check (budget_microusd between 1 and 20000),
 committed_microusd integer not null default 0 check (committed_microusd>=0 and committed_microusd<=budget_microusd),
 enabled boolean not null default false,
 expires_at timestamptz not null,
 created_at timestamptz not null default now()
);
create table if not exists public.luna24_qa_ai_calls (
 grant_id uuid not null references public.luna24_qa_ai_budget(grant_id),
 client_reading_id uuid not null,
 reserved_microusd integer not null default 12000 check (reserved_microusd=12000),
 actual_microusd integer check (actual_microusd between 0 and 12000),
 created_at timestamptz not null default now(),
 settled_at timestamptz,
 primary key(grant_id,client_reading_id)
);
alter table public.luna24_qa_ai_budget enable row level security;
alter table public.luna24_qa_ai_budget force row level security;
alter table public.luna24_qa_ai_calls enable row level security;
alter table public.luna24_qa_ai_calls force row level security;
revoke all on public.luna24_qa_ai_budget,public.luna24_qa_ai_calls from public,anon,authenticated;
grant select,insert,update on public.luna24_qa_ai_budget,public.luna24_qa_ai_calls to service_role;

create or replace function public.reserve_luna24_qa_ai_call(p_grant_id uuid,p_telegram_id bigint,p_client_reading_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare b public.luna24_qa_ai_budget;
begin
 select * into b from public.luna24_qa_ai_budget where grant_id=p_grant_id and telegram_id=p_telegram_id for update;
 if not found or not b.enabled or b.expires_at<=now() then return jsonb_build_object('acquired',false,'reason','denied');end if;
 if exists(select 1 from public.luna24_qa_ai_calls where grant_id=p_grant_id and client_reading_id=p_client_reading_id) then
  return jsonb_build_object('acquired',false,'reason','already_attempted');end if;
 if not exists(select 1 from public.luna_tarot_readings where telegram_id=p_telegram_id and client_reading_id=p_client_reading_id and status='processing') then
  return jsonb_build_object('acquired',false,'reason','reading_required');end if;
 if b.committed_microusd+12000>b.budget_microusd then return jsonb_build_object('acquired',false,'reason','budget_limit');end if;
 insert into public.luna24_qa_ai_calls(grant_id,client_reading_id) values(p_grant_id,p_client_reading_id);
 update public.luna24_qa_ai_budget set committed_microusd=committed_microusd+12000 where grant_id=p_grant_id;
 return jsonb_build_object('acquired',true);
end $$;
create or replace function public.settle_luna24_qa_ai_call(p_grant_id uuid,p_telegram_id bigint,p_client_reading_id uuid,p_actual_microusd integer)
returns boolean language plpgsql security invoker set search_path='' as $$
declare c public.luna24_qa_ai_calls;
begin
 if p_actual_microusd is null or p_actual_microusd<0 or p_actual_microusd>12000 then return false;end if;
 perform 1 from public.luna24_qa_ai_budget where grant_id=p_grant_id and telegram_id=p_telegram_id for update;
 if not found then return false;end if;
 select * into c from public.luna24_qa_ai_calls where grant_id=p_grant_id and client_reading_id=p_client_reading_id for update;
 if not found then return false;end if;
 if c.settled_at is not null then return c.actual_microusd=p_actual_microusd;end if;
 update public.luna24_qa_ai_calls set actual_microusd=p_actual_microusd,settled_at=now() where grant_id=p_grant_id and client_reading_id=p_client_reading_id;
 update public.luna24_qa_ai_budget set committed_microusd=committed_microusd-12000+p_actual_microusd where grant_id=p_grant_id;
 return true;
end $$;
revoke all on function public.reserve_luna24_qa_ai_call(uuid,bigint,uuid) from public,anon,authenticated;
revoke all on function public.settle_luna24_qa_ai_call(uuid,bigint,uuid,integer) from public,anon,authenticated;
grant execute on function public.reserve_luna24_qa_ai_call(uuid,bigint,uuid) to service_role;
grant execute on function public.settle_luna24_qa_ai_call(uuid,bigint,uuid,integer) to service_role;
-- Operational rollback: set enabled=false for this grant; history remains readable.
-- Never reset committed_microusd or delete calls to retry a failed provider request.
-- Structural rollback only after disabling the staging flag and archiving budget audit:
-- drop function public.reserve_luna24_qa_ai_call(uuid,bigint,uuid);
-- drop function public.settle_luna24_qa_ai_call(uuid,bigint,uuid,integer);
-- drop table public.luna24_qa_ai_calls; drop table public.luna24_qa_ai_budget;
