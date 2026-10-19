-- Candidate catalog delivery only; no activation, historical repricing, wallet
-- reset, or Telegram payment changes. Daily uses the existing reading order.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';
create table if not exists public.luna4_reading_terms(
 order_id uuid primary key references public.luna_reading_orders(id),
 telegram_id bigint not null references public.users(telegram_id),
 kind text not null check(kind in('daily','single','three','five')),
 catalog_version text not null,catalog_revision integer not null check(catalog_revision>=0),
 seeds integer not null check(seeds between 1 and 10000),
 daily_client_id uuid,daily_day date,created_at timestamptz not null default now(),
 check((kind='daily' and daily_client_id is not null and daily_day is not null) or(kind<>'daily' and daily_client_id is null and daily_day is null))
);
create unique index if not exists luna4_one_daily_order on public.luna4_reading_terms(telegram_id,daily_day) where kind='daily';
alter table public.luna4_reading_terms enable row level security;alter table public.luna4_reading_terms force row level security;
revoke all on public.luna4_reading_terms from public,anon,authenticated,service_role;
grant select,insert on public.luna4_reading_terms to service_role;

create or replace function public.luna4_tarot_prices()
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare cfg public.luna34_commercial_settings%rowtype;
begin
 select * into strict cfg from public.luna34_commercial_settings where id;
 if cfg.catalog->>'version'<>'luna-4.0-completion-v1' then return null;end if;
 if not public.luna4_valid_economy_catalog(cfg.catalog) then raise exception 'Invalid reviewed catalog';end if;
 return jsonb_build_object('version',cfg.catalog->>'version','revision',cfg.catalog_revision,'enabled',cfg.checkout_enabled and cfg.owner_approved and cfg.live_payment_verified and cfg.luna4_activation_verified and cfg.luna4_cutover_at<=now(),'daily',(cfg.catalog#>>'{products,daily}')::integer,'single',(cfg.catalog#>>'{products,single}')::integer,'three',(cfg.catalog#>>'{products,three}')::integer,'five',(cfg.catalog#>>'{products,five}')::integer);
end $$;

create or replace function public.luna4_buy_seed_reading(p_telegram_id bigint,p_request_id uuid,p_kind text,p_expected_amount integer,p_daily_client uuid default null,p_daily_day date default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare cfg public.luna34_commercial_settings%rowtype;s public.luna21_settings%rowtype;g public.moon_gardens%rowtype;
 o public.luna_reading_orders%rowtype;t public.luna4_reading_terms%rowtype;cost integer;actual_kind text;prices jsonb;
begin
 if p_kind not in('daily','single','three','five') or p_request_id is null then raise exception 'Invalid reading order';end if;
 actual_kind:=case when p_kind='daily' then 'single' else p_kind end;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna21_wallet:'||p_telegram_id::text,0));
 select * into o from public.luna_reading_orders where telegram_id=p_telegram_id and request_id=p_request_id;
 if found then
  select * into t from public.luna4_reading_terms where telegram_id=p_telegram_id and order_id=o.id;
  if o.kind<>actual_kind or o.currency<>'SEEDS' or(t.order_id is not null and(t.kind<>p_kind or t.daily_client_id is distinct from p_daily_client or t.daily_day is distinct from p_daily_day)) then return jsonb_build_object('status','conflict');end if;
  return jsonb_build_object('status','duplicate','order',to_jsonb(o)-'telegram_id');
 end if;
 select * into strict cfg from public.luna34_commercial_settings where id;
 if cfg.catalog->>'version'<>'luna-4.0-completion-v1' and p_kind<>'daily' then return public.luna21_buy_seed_reading(p_telegram_id,p_request_id,p_kind,p_expected_amount);end if;
 prices:=public.luna4_tarot_prices();
 select * into strict s from public.luna21_settings where id;
 if not coalesce((prices->>'enabled')::boolean,false) or not(s.wallet_enabled and s.paid_readings_enabled) then return jsonb_build_object('status','disabled');end if;
 if p_kind='daily' then
  if p_daily_day is distinct from (now() at time zone 'UTC')::date or not exists(select 1 from public.luna_daily_cards d join public.luna_tarot_readings r on r.telegram_id=d.telegram_id and r.client_reading_id=d.client_reading_id where d.telegram_id=p_telegram_id and d.client_reading_id=p_daily_client and d.reading_day=p_daily_day and r.status='local') then return jsonb_build_object('status','invalid_daily');end if;
  select rt.* into t from public.luna4_reading_terms rt where rt.telegram_id=p_telegram_id and rt.kind='daily' and rt.daily_day=p_daily_day;
  if found then select * into strict o from public.luna_reading_orders where id=t.order_id and telegram_id=p_telegram_id;return jsonb_build_object('status','duplicate','order',to_jsonb(o)-'telegram_id');end if;
 elsif p_daily_client is not null or p_daily_day is not null then raise exception 'Invalid daily identity';end if;
 cost:=(prices->>p_kind)::integer;
 if p_expected_amount is distinct from cost then return jsonb_build_object('status','price_changed');end if;
 select * into g from public.moon_gardens where telegram_id=p_telegram_id for update;
 if not found or g.moon_seeds_available<cost then return jsonb_build_object('status','insufficient');end if;
 insert into public.luna_reading_orders(telegram_id,request_id,kind,currency,amount,status,client_reading_id) values(p_telegram_id,p_request_id,actual_kind,'SEEDS',cost,'entitled',p_daily_client) returning * into o;
 insert into public.luna4_reading_terms(order_id,telegram_id,kind,catalog_version,catalog_revision,seeds,daily_client_id,daily_day) values(o.id,p_telegram_id,p_kind,cfg.catalog->>'version',cfg.catalog_revision,cost,p_daily_client,p_daily_day);
 update public.moon_gardens set moon_seeds_available=g.moon_seeds_available-cost,updated_at=now() where telegram_id=p_telegram_id;
 insert into public.luna_seed_ledger(telegram_id,event_key,kind,delta,balance_after) values(p_telegram_id,'order:'||o.id,'reading_purchase',-cost,g.moon_seeds_available-cost);
 return jsonb_build_object('status','ok','order',to_jsonb(o)-'telegram_id','balance',g.moon_seeds_available-cost);
end $$;

create or replace function public.luna4_daily_quote(p_owner bigint)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare cfg public.luna34_commercial_settings%rowtype;runtime public.luna32_runtime_settings%rowtype;contract jsonb;d public.luna_daily_cards%rowtype;o public.luna_reading_orders%rowtype;
begin
 select * into strict cfg from public.luna34_commercial_settings where id;
 select * into d from public.luna_daily_cards where telegram_id=p_owner and reading_day=(now() at time zone 'UTC')::date;
 if d.telegram_id is not null then
  select ord.* into o from public.luna4_reading_terms t join public.luna_reading_orders ord on ord.id=t.order_id and ord.telegram_id=t.telegram_id where t.telegram_id=p_owner and t.kind='daily' and t.daily_client_id=d.client_reading_id;
  if found then return jsonb_build_object('seeds',0,'confirmationRequired',false,'source',case when o.status='refunded' then 'recovered' else 'owned' end,'orderId',o.id,'orderStatus',o.status,'paidSeeds',o.amount);end if;
  if exists(select 1 from public.luna_tarot_readings r where r.telegram_id=p_owner and r.client_reading_id=d.client_reading_id and r.status<>'local') then return jsonb_build_object('seeds',0,'confirmationRequired',false,'source','saved');end if;
 end if;
 if cfg.catalog->>'version'<>'luna-4.0-completion-v1' then return jsonb_build_object('seeds',0,'confirmationRequired',false,'source','existing_free');end if;
 if not(cfg.luna4_activation_verified and cfg.owner_approved) or cfg.luna4_cutover_at is null or cfg.luna4_cutover_at>now() then raise exception 'Verified daily configuration required';end if;
 if d.telegram_id is not null and d.created_at<cfg.luna4_cutover_at then return jsonb_build_object('seeds',0,'confirmationRequired',false,'source','preserved_daily');end if;
 contract:=public.luna4_membership_contract(p_owner);
 if coalesce((contract->>'preserveLegacy')::boolean,false) then return jsonb_build_object('seeds',0,'confirmationRequired',false,'source','preserved_legacy');end if;
 select * into strict runtime from public.luna32_runtime_settings where id;
 if runtime.public_beta and runtime.beta_starts_at<=now() and runtime.beta_expires_at>now() and runtime.beta_features ? 'tarot' then return jsonb_build_object('seeds',0,'confirmationRequired',false,'source','public_beta');end if;
 return jsonb_build_object('seeds',(cfg.catalog#>>'{products,daily}')::integer,'confirmationRequired',true,'source','new_daily');
end $$;

create or replace function public.luna4_reserve_daily_card(p_telegram_id bigint,p_card_id text,p_orientation text,p_language text,p_generate boolean,p_daily_limit integer,p_global_limit integer,p_expected_day date default null,p_confirmed boolean default false,p_expected_seeds integer default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result_value jsonb;quote jsonb;bought jsonb;client uuid;order_value uuid;
begin
 if p_expected_day is not null and p_expected_day<>(now() at time zone 'UTC')::date then return jsonb_build_object('status','day_changed','acquired',false);end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna_tarot:'||p_telegram_id::text,0));
 result_value:=public.reserve_luna_daily_card(p_telegram_id,p_card_id,p_orientation,p_language,false,p_daily_limit,p_global_limit,p_expected_day);
 if result_value->>'status' in('deleted','conflict','day_changed') then return result_value;end if;
 quote:=public.luna4_daily_quote(p_telegram_id);
 if not p_generate or result_value#>>'{reading,status}' is distinct from 'local' then return result_value||jsonb_build_object('quote',quote,'orderId',quote->'orderId');end if;
 if coalesce((quote->>'seeds')::integer,0)>0 then
  if not p_confirmed then return result_value||jsonb_build_object('status','confirmation_required','quote',quote);end if;
  if p_expected_seeds is distinct from (quote->>'seeds')::integer then return result_value||jsonb_build_object('status','price_changed','quote',quote);end if;
  client:=(result_value#>>'{reading,client_reading_id}')::uuid;
  bought:=public.luna4_buy_seed_reading(p_telegram_id,client,'daily',p_expected_seeds,client,(result_value->>'day')::date);
  if bought->'order' is null then return result_value||jsonb_build_object('status',bought->>'status','quote',quote);end if;
  order_value:=(bought#>>'{order,id}')::uuid;quote:=public.luna4_daily_quote(p_telegram_id);
 elsif quote->>'orderId' is not null and quote->>'orderStatus'<>'refunded' then order_value:=(quote->>'orderId')::uuid;end if;
 result_value:=public.reserve_luna_daily_card(p_telegram_id,p_card_id,p_orientation,p_language,true,p_daily_limit,p_global_limit,p_expected_day);
 return result_value||jsonb_build_object('quote',quote,'orderId',order_value);
end $$;

create or replace function public.luna4_finish_daily_access(p_owner bigint,p_client uuid,p_success boolean)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare o public.luna_reading_orders%rowtype;r public.luna_tarot_readings%rowtype;balance_value integer;
begin
 if p_success is null then raise exception 'Explicit final outcome required';end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna_tarot:'||p_owner::text,0));
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna21_wallet:'||p_owner::text,0));
 select ord.* into o from public.luna4_reading_terms t join public.luna_reading_orders ord on ord.id=t.order_id and ord.telegram_id=t.telegram_id where t.telegram_id=p_owner and t.kind='daily' and t.daily_client_id=p_client for update of ord;
 if not found then return jsonb_build_object('status','no_paid_daily');end if;
 if o.status in('consumed','refunded') then return jsonb_build_object('status',o.status,'replay',true);end if;
 select * into r from public.luna_tarot_readings where telegram_id=p_owner and client_reading_id=p_client;
 if p_success then
  if r.status is distinct from 'ready' or not exists(select 1 from public.luna32_ai_operations op join public.luna32_ai_attempts a on a.telegram_id=op.telegram_id and a.operation_key=op.operation_key and a.lease=op.lease where op.telegram_id=p_owner and op.operation_key='tarot:'||p_client::text and op.state='succeeded' and a.state='settled' and a.provider_status='completed' and a.output_tokens>0 and a.actual_cost_microusd is not null) then raise exception 'Verified saved daily result required';end if;
  update public.luna_reading_orders set status='consumed',updated_at=now() where id=o.id;
  return jsonb_build_object('status','consumed','replay',false);
 end if;
 if r.status is distinct from 'fallback' then return jsonb_build_object('status','pending');end if;
 select moon_seeds_available into strict balance_value from public.moon_gardens where telegram_id=p_owner for update;
 insert into public.luna_seed_ledger(telegram_id,event_key,kind,delta,balance_after) values(p_owner,'luna4:reading_refund:'||o.id::text,'refund',o.amount,balance_value+o.amount);
 update public.moon_gardens set moon_seeds_available=balance_value+o.amount,updated_at=now() where telegram_id=p_owner;
 update public.luna_reading_orders set status='refunded',updated_at=now() where id=o.id;
 return jsonb_build_object('status','refunded','seeds',o.amount,'replay',false);
end $$;

create or replace function public.luna4_cancel_daily_delivery(p_owner bigint,p_reading uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.luna_tarot_readings%rowtype;
begin
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna_tarot:'||p_owner::text,0));
 select * into r from public.luna_tarot_readings where telegram_id=p_owner and id=p_reading for update;
 if not found or r.status='ready' or not exists(select 1 from public.luna4_reading_terms t join public.luna_reading_orders o on o.id=t.order_id and o.telegram_id=t.telegram_id where t.telegram_id=p_owner and t.kind='daily' and t.daily_client_id=r.client_reading_id and o.status='entitled') then return jsonb_build_object('status','no_pending_daily');end if;
 if r.status in('local','processing') then update public.luna_tarot_readings set status='fallback',fallback_reason='user_removed',updated_at=now() where id=r.id;end if;
 return public.luna4_finish_daily_access(p_owner,r.client_reading_id,false);
end $$;

-- Preserve the proven source journal; add ONLY the new exact reading refund
-- identity. Historical classifications and rows are not rewritten.
create or replace function public.luna4_journal_seed_sources()
returns trigger language plpgsql security invoker set search_path='' as $$
declare s public.luna4_seed_sources%rowtype; original public.luna4_seed_provenance%rowtype;
 before_value bigint:=new.balance_after::bigint-new.delta::bigint;
 promo bigint:=0;paid bigint:=0;legacy bigint:=0;remaining bigint;take_value bigint;source text;original_id uuid;
begin
 perform 1 from public.moon_gardens where telegram_id=new.telegram_id for update;
 if before_value<0 then raise exception 'Invalid seed ledger balance' using errcode='23514';end if;
 insert into public.luna4_seed_sources(telegram_id,legacy_unclassified) values(new.telegram_id,before_value) on conflict do nothing;
 select * into strict s from public.luna4_seed_sources where telegram_id=new.telegram_id for update;
 if s.promotional+s.purchased+s.legacy_unclassified<>before_value then raise exception 'Seed provenance requires reconciliation' using errcode='23514';end if;
 if new.event_key like 'luna4:reading_refund:%' then
  select p.* into original from public.luna4_seed_provenance p join public.luna_seed_ledger l on l.id=p.ledger_id where l.telegram_id=new.telegram_id and l.event_key='order:'||substr(new.event_key,length('luna4:reading_refund:')+1);
 elsif new.event_key like 'luna43:deep_refund:%' then
  select p.* into original from public.luna4_seed_provenance p join public.luna_seed_ledger l on l.id=p.ledger_id where l.telegram_id=new.telegram_id and l.event_key='luna43:purchase:'||substr(new.event_key,length('luna43:deep_refund:')+1);
 elsif new.event_key like 'luna30:refund:%' then
  select p.* into original from public.luna4_seed_provenance p join public.luna_seed_ledger l on l.id=p.ledger_id where l.telegram_id=new.telegram_id and l.event_key='luna30:charge:'||substr(new.event_key,length('luna30:refund:')+1);
 end if;
 if original.ledger_id is not null and new.delta>0 and original.promotional_delta+original.purchased_delta+original.legacy_delta=-new.delta then
  promo:=-original.promotional_delta;paid:=-original.purchased_delta;legacy:=-original.legacy_delta;source:='refund';original_id:=original.ledger_id;
 elsif original.ledger_id is not null and new.delta<0 and original.promotional_delta+original.purchased_delta+original.legacy_delta=-new.delta then
  remaining:=-new.delta;paid:=-least(s.purchased,greatest(0,original.purchased_delta),remaining);remaining:=remaining+paid;
  promo:=-least(s.promotional,greatest(0,original.promotional_delta),remaining);remaining:=remaining+promo;
  legacy:=-least(s.legacy_unclassified,remaining);remaining:=remaining+legacy;
  if remaining>0 then take_value:=least(s.purchased+paid,remaining);paid:=paid-take_value;remaining:=remaining-take_value;end if;
  if remaining>0 then promo:=promo-remaining;end if;source:='purchase_refund';original_id:=original.ledger_id;
 elsif new.delta<0 then
  remaining:=-new.delta;promo:=-least(s.promotional,remaining);remaining:=remaining+promo;
  legacy:=-least(s.legacy_unclassified,remaining);remaining:=remaining+legacy;paid:=-remaining;source:='spend';
 elsif new.kind='stars_package' then paid:=new.delta;source:='purchased';
 elsif new.kind in('checkin','seven_days','meditation','breath','journal','referral','premium_renewal','welcome') then promo:=new.delta;source:='promotional';
 else legacy:=new.delta;source:='legacy_unclassified';end if;
 if promo+paid+legacy<>new.delta or s.promotional+promo<0 or s.purchased+paid<0 or s.legacy_unclassified+legacy<0 then raise exception 'Invalid provenance split' using errcode='23514';end if;
 update public.luna4_seed_sources set promotional=promotional+promo,purchased=purchased+paid,legacy_unclassified=legacy_unclassified+legacy,revision=revision+1,updated_at=now() where telegram_id=new.telegram_id returning * into s;
 insert into public.luna4_seed_provenance(ledger_id,telegram_id,promotional_delta,purchased_delta,legacy_delta,original_ledger_id,classification,revision) values(new.id,new.telegram_id,promo,paid,legacy,original_id,source,s.revision);
 return new;
end $$;
revoke all on function public.luna4_tarot_prices(),public.luna4_buy_seed_reading(bigint,uuid,text,integer,uuid,date),public.luna4_daily_quote(bigint),public.luna4_reserve_daily_card(bigint,text,text,text,boolean,integer,integer,date,boolean,integer),public.luna4_finish_daily_access(bigint,uuid,boolean),public.luna4_cancel_daily_delivery(bigint,uuid) from public,anon,authenticated;
grant execute on function public.luna4_tarot_prices(),public.luna4_buy_seed_reading(bigint,uuid,text,integer,uuid,date),public.luna4_daily_quote(bigint),public.luna4_reserve_daily_card(bigint,text,text,text,boolean,integer,integer,date,boolean,integer),public.luna4_finish_daily_access(bigint,uuid,boolean),public.luna4_cancel_daily_delivery(bigint,uuid) to service_role;
notify pgrst,'reload schema';commit;
-- Rollback closes new prices/checkout and reverts callers, retaining accepted
-- orders, exact-origin refunds and immutable terms. Never reset a paid balance.
