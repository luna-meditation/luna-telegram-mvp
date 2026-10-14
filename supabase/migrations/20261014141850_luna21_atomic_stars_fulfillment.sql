-- Existing annual/lifetime/legacy fixed-term Stars products ONLY. No new prices.
-- PREPARED, NOT APPLIED. Depends on service-only luna_mutate_garden.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';
do $$ begin if to_regprocedure('public.luna_mutate_garden(bigint,text,text,integer,integer)') is null then raise exception 'Missing garden dependency';end if;end $$;
create table if not exists public.luna_payment_fulfillments (
 telegram_charge_id text primary key,payment_id uuid not null references public.payments(id) on delete restrict,
 telegram_id bigint not null references public.users(telegram_id) on delete cascade,
 fulfilled_at timestamptz not null default now()
);
alter table public.luna_payment_fulfillments enable row level security;
alter table public.luna_payment_fulfillments force row level security;
revoke all on public.luna_payment_fulfillments from public,anon,authenticated,service_role;
grant select,insert on public.luna_payment_fulfillments to service_role;

create or replace function public.luna21_fulfill_existing_stars(
 p_telegram_id bigint,p_plan text,p_currency text,p_amount integer,p_charge_id text,p_provider_charge_id text
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare u public.users%rowtype;p public.payments%rowtype;expected integer;days integer;g jsonb;
begin
 expected:=case p_plan when 'annual' then 750 when 'lifetime' then 2499 when 'monthly' then 499 else null end;
 if expected is null or p_currency is distinct from 'XTR' or p_amount is distinct from expected or p_charge_id is null or length(p_charge_id) not between 1 and 512 then raise exception 'Invalid Stars payment';end if;
 select * into strict u from public.users where telegram_id=p_telegram_id for update;
 select * into p from public.payments where telegram_payment_charge_id=p_charge_id;
 if found then
  if p.telegram_id<>p_telegram_id or p.amount_stars<>p_amount or p.currency<>'XTR' or p.plan<>(case when p_plan='lifetime' then 'lifetime' else 'monthly' end) or p.status<>'paid' then raise exception 'Stars charge conflict';end if;
  -- Historical paid rows are not replayed to extend current access. Review any
  -- old incomplete fulfillment individually, never backfill new entitlements.
  return jsonb_build_object('status','duplicate','isNewPayment',false,'seedsGranted',false);
 end if;
 insert into public.payments(telegram_id,plan,amount_stars,currency,telegram_payment_charge_id,provider_payment_charge_id,status)
 values(p_telegram_id,case when p_plan='lifetime' then 'lifetime' else 'monthly' end,p_amount,'XTR',p_charge_id,nullif(p_provider_charge_id,''),'paid') returning * into p;
 if u.lifetime_access or p_plan='lifetime' then
  update public.users set lifetime_access=true,active_until=null where telegram_id=p_telegram_id;
 else
  days:=case when p_plan='annual' then 365 else 30 end;
  update public.users set lifetime_access=false,active_until=greatest(now(),coalesce(u.active_until,now()))+make_interval(days=>days) where telegram_id=p_telegram_id;
 end if;
 g:=public.luna_mutate_garden(p_telegram_id,'premium',null,0,0);
 insert into public.luna_payment_fulfillments(telegram_charge_id,payment_id,telegram_id) values(p_charge_id,p.id,p_telegram_id);
 return jsonb_build_object('status','ok','isNewPayment',true,'seedsGranted',g->>'status'='ok');
end $$;
revoke all on function public.luna21_fulfill_existing_stars(bigint,text,text,integer,text,text) from public,anon,authenticated;
grant execute on function public.luna21_fulfill_existing_stars(bigint,text,text,integer,text,text) to service_role;
notify pgrst,'reload schema';commit;
-- Rollback: disable FEATURE_PAYMENT_ATOMIC before reverting code; retain ledger.
-- Existing duplicate detection must remain enabled. Never undo balances or
-- Lifetime/fixed-term access using an older database snapshot.
