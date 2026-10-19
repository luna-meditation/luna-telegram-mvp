-- Prepared new-product adapter. Existing wallet, purchases, grants, reservations
-- and receipts remain authoritative. No activation or historical backfill.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';
alter table public.luna43_seed_purchases add column if not exists funding text not null default 'seeds';
alter table public.luna43_seed_purchases add column if not exists allowance_reservation_id uuid references public.luna30_usage_reservations(id);
alter table public.luna43_seed_purchases drop constraint if exists luna43_seed_purchases_product_check;
alter table public.luna43_seed_purchases add constraint luna43_seed_purchases_product_check check(product in('ai_messages','deep_analysis','personal_portrait'));
alter table public.luna43_seed_purchases drop constraint if exists luna43_seed_purchases_seeds_check;
alter table public.luna43_seed_purchases add constraint luna43_seed_purchases_seeds_check check((funding='seeds' and seeds>0 and allowance_reservation_id is null) or(funding='included' and product='deep_analysis' and seeds=0 and allowance_reservation_id is not null));

create or replace function public.luna4_analysis_allowance_status(p_owner bigint)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare cfg public.luna34_commercial_settings%rowtype;c jsonb;n integer:=0;used_value integer:=0;
begin
 select * into strict cfg from public.luna34_commercial_settings where id;
 if cfg.catalog->>'version'<>'luna-4.0-completion-v1' or not(cfg.luna4_activation_verified and cfg.quotas_enabled and cfg.owner_approved) then return jsonb_build_object('enabled',false,'remaining',0);end if;
 c:=public.luna4_membership_contract(p_owner);
 if (c->>'paid')::boolean and not(c->>'preserveLegacy')::boolean then
  n:=(c#>>'{allowances,deep}')::integer;
  if n is null or n not between 0 and 10000 then raise exception 'Original deep allowance unavailable';end if;
  select count(*) into used_value from public.luna30_usage_reservations where telegram_id=p_owner and bucket='deep' and period_key=c->>'periodKey' and state in('reserved','success');
 end if;
 -- Public Beta covers the named discovery/chat features, not every separately
 -- purchased deep product. It never burns or hides the explicit paid benefit.
 return jsonb_build_object('enabled',true,'limit',n,'used',used_value,'remaining',greatest(0,n-used_value),'periodKey',c->>'periodKey','resetAt',c#>>'{window,end}');
end $$;

create or replace function public.luna4_purchase_seed_product(p_owner bigint,p_request uuid,p_hash text,p_product text,p_expected integer,p_revision integer,p_parameters jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare cfg public.luna34_commercial_settings%rowtype;prior public.luna43_seed_purchases%rowtype;p public.luna43_seed_purchases%rowtype;
 price integer;quantity_value integer:=1;balance_value integer;included jsonb;purchase_id uuid:=gen_random_uuid();hold_id uuid;identity_hash text;identity_id uuid;operation_value text;funding_value text:='seeds';
begin
 if coalesce(p_request is null or p_hash !~ '^[a-f0-9]{64}$' or p_product not in('ai_messages','deep_analysis','personal_portrait') or p_expected is null or p_expected<0 or p_revision is null or p_parameters is null or jsonb_typeof(p_parameters)<>'object' or octet_length(p_parameters::text)>16000,true) then raise exception 'Invalid purchase' using errcode='22023';end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna21_wallet:'||p_owner::text,0));
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna34_allowance:'||p_owner::text,0));
 select * into prior from public.luna43_seed_purchases where telegram_id=p_owner and request_id=p_request;
 if found then if prior.request_hash<>p_hash then raise exception 'Purchase identity conflict' using errcode='23505';end if;return jsonb_build_object('status','duplicate','purchase',to_jsonb(prior)-'telegram_id'-'request_hash');end if;
 select * into strict cfg from public.luna34_commercial_settings where id;
 if cfg.catalog->>'version'<>'luna-4.0-completion-v1' or not(cfg.checkout_enabled and cfg.owner_approved and cfg.live_payment_verified and cfg.luna4_activation_verified and cfg.quotas_enabled) or not exists(select 1 from public.luna21_settings where id and wallet_enabled) then return jsonb_build_object('status','disabled');end if;
 if p_revision<>cfg.catalog_revision then return jsonb_build_object('status','price_changed');end if;
 if p_product='ai_messages' then price:=(cfg.catalog#>>'{products,aiMessages,seeds}')::integer;quantity_value:=(cfg.catalog#>>'{products,aiMessages,quantity}')::integer;
 elsif p_product='personal_portrait' then price:=(cfg.catalog#>>'{products,portrait}')::integer;
 else
  price:=(cfg.catalog#>>'{products,deep}')::integer;included:=public.luna4_analysis_allowance_status(p_owner);
  if (included->>'remaining')::integer>0 then price:=0;funding_value:='included';end if;
 end if;
 if price is null or price not between 0 and 10000 or quantity_value is null or quantity_value not between 1 and 100 or price<>p_expected then return jsonb_build_object('status','price_changed');end if;
 if p_product<>'ai_messages' and coalesce(p_parameters->>'contextHash' !~ '^[a-f0-9]{64}$' or p_parameters->>'personalContextConsent' is distinct from 'true' or p_parameters->>'language' not in('en','ru'),true) then raise exception 'Confirmed analysis context required';end if;
 if not exists(select 1 from public.users where telegram_id=p_owner) then raise exception 'Unknown owner';end if;
 if price>0 then select moon_seeds_available into balance_value from public.moon_gardens where telegram_id=p_owner for update;if not found or balance_value<price then return jsonb_build_object('status','insufficient');end if;else select moon_seeds_available into balance_value from public.moon_gardens where telegram_id=p_owner;balance_value:=coalesce(balance_value,0);end if;
 if funding_value='included' then
  operation_value:='deep:'||purchase_id::text;identity_hash:=encode(sha256(convert_to('luna34:'||p_owner::text||':'||operation_value,'UTF8')),'hex');
  identity_id:=(substr(identity_hash,1,8)||'-'||substr(identity_hash,9,4)||'-4'||substr(identity_hash,14,3)||'-8'||substr(identity_hash,18,3)||'-'||substr(identity_hash,21,12))::uuid;
  insert into public.luna30_usage_reservations(telegram_id,request_id,request_hash,bucket,period_key,allowance,state) values(p_owner,identity_id,identity_hash,'deep',included->>'periodKey',(included->>'limit')::integer,'reserved') returning id into hold_id;
 end if;
 insert into public.luna43_seed_purchases(id,telegram_id,request_id,request_hash,product,seeds,quantity,catalog_revision,parameters,state,funding,allowance_reservation_id) values(purchase_id,p_owner,p_request,p_hash,p_product,price,quantity_value,cfg.catalog_revision,p_parameters,'entitled',funding_value,hold_id) returning * into p;
 if price>0 then
  insert into public.luna_seed_ledger(telegram_id,event_key,kind,delta,balance_after) values(p_owner,'luna43:purchase:'||p.id::text,case when p_product='ai_messages' then 'ai_allowance_purchase' else 'deep_analysis_purchase' end,-price,balance_value-price);
  update public.moon_gardens set moon_seeds_available=balance_value-price,updated_at=now() where telegram_id=p_owner;
 end if;
 if p_product='ai_messages' then
  insert into public.luna40_quota_grants(telegram_id,quantity,expires_at,actor,reason,purchase_id) values(p_owner,quantity_value,'infinity'::timestamptz,p_owner,'Purchased standard AI messages',p.id);
  update public.luna43_seed_purchases set state='ready',result=jsonb_build_object('quantity',quantity_value,'expiresAt',null),updated_at=now() where id=p.id returning * into p;
 end if;
 return jsonb_build_object('status','purchased','balance',balance_value-price,'purchase',to_jsonb(p)-'telegram_id'-'request_hash');
end $$;

create or replace function public.luna4_claim_personal_analysis(p_owner bigint,p_purchase uuid,p_lease uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.luna43_seed_purchases%rowtype;
begin
 if p_lease is null then raise exception 'Missing purchase lease';end if;
 select * into p from public.luna43_seed_purchases where id=p_purchase and telegram_id=p_owner and product in('deep_analysis','personal_portrait') for update;
 if not found then return jsonb_build_object('status','not_found');end if;
 if p.state<>'entitled' then return jsonb_build_object('status',p.state,'purchase',to_jsonb(p)-'telegram_id'-'request_hash');end if;
 update public.luna43_seed_purchases set state='processing',lease=p_lease,updated_at=now() where id=p.id returning * into p;
 return jsonb_build_object('status','claimed','purchase',to_jsonb(p)-'telegram_id'-'request_hash');
end $$;

create or replace function public.luna4_finish_personal_analysis(p_owner bigint,p_purchase uuid,p_lease uuid,p_result jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
declare p public.luna43_seed_purchases%rowtype;r public.luna30_usage_reservations%rowtype;balance_value integer;operation_value text;
begin
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna21_wallet:'||p_owner::text,0));
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna34_allowance:'||p_owner::text,0));
 select * into p from public.luna43_seed_purchases where id=p_purchase and telegram_id=p_owner and product in('deep_analysis','personal_portrait') for update;
 if not found or p.state<>'processing' or p.lease is distinct from p_lease then return false;end if;
 operation_value:=(case when p.product='personal_portrait' then 'portrait:' else 'deep:' end)||p.id::text;
 if p.funding='included' then
  select * into r from public.luna30_usage_reservations where id=p.allowance_reservation_id and telegram_id=p_owner and bucket='deep' for update;
  if not found or r.state<>'reserved' or r.request_hash<>encode(sha256(convert_to('luna34:'||p_owner::text||':'||operation_value,'UTF8')),'hex') then raise exception 'Original included benefit required';end if;
 end if;
 if p_result is not null then
  if jsonb_typeof(p_result)<>'object' or octet_length(p_result::text)>36000 then raise exception 'Invalid saved report';end if;
  if not exists(select 1 from public.luna32_ai_operations o where o.telegram_id=p_owner and o.operation_key=operation_value and o.state='succeeded' and exists(select 1 from public.luna32_ai_attempts a where a.telegram_id=o.telegram_id and a.operation_key=o.operation_key and a.lease=o.lease and a.state='settled' and a.provider_status='completed' and a.output_tokens>0 and a.actual_cost_microusd is not null)) then raise exception 'Verified successful report delivery required';end if;
  update public.luna43_seed_purchases set state='ready',result=p_result,updated_at=now() where id=p.id;
  if p.funding='included' then update public.luna30_usage_reservations set state='success',settled_at=now() where id=r.id;end if;
 else
  if p.funding='included' then update public.luna30_usage_reservations set state='failed',settled_at=now() where id=r.id;
  else
   select moon_seeds_available into strict balance_value from public.moon_gardens where telegram_id=p_owner for update;
   insert into public.luna_seed_ledger(telegram_id,event_key,kind,delta,balance_after) values(p_owner,'luna43:deep_refund:'||p.id::text,'refund',p.seeds,balance_value+p.seeds);
   update public.moon_gardens set moon_seeds_available=balance_value+p.seeds,updated_at=now() where telegram_id=p_owner;
  end if;
  update public.luna43_seed_purchases set state='failed_refunded',updated_at=now() where id=p.id;
 end if;return true;
end $$;
-- Older backend entrypoints must not turn a zero-Seed included purchase into
-- an untracked free result during an incremental/rollback code deployment.
-- Positive-Seed historical behavior is preserved byte-for-byte in its branch.
create or replace function public.luna43_claim_deep_analysis(p_owner bigint,p_purchase uuid,p_lease uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.luna43_seed_purchases%rowtype;
begin
 if p_lease is null then raise exception 'Missing lease' using errcode='22023';end if;
 select * into p from public.luna43_seed_purchases where id=p_purchase and telegram_id=p_owner and product='deep_analysis' for update;
 if not found then return jsonb_build_object('status','not_found');end if;
 if p.seeds=0 then return public.luna4_claim_personal_analysis(p_owner,p_purchase,p_lease);end if;
 if p.state<>'entitled' then return jsonb_build_object('status',p.state,'purchase',to_jsonb(p)-'telegram_id'-'request_hash');end if;
 update public.luna43_seed_purchases set state='processing',lease=p_lease,updated_at=now() where id=p.id returning * into p;
 return jsonb_build_object('status','claimed','purchase',to_jsonb(p)-'telegram_id'-'request_hash');
end $$;
create or replace function public.luna43_finish_deep_analysis(p_owner bigint,p_purchase uuid,p_lease uuid,p_result jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
declare p public.luna43_seed_purchases%rowtype;balance integer;
begin
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna21_wallet:'||p_owner::text,0));
 select * into p from public.luna43_seed_purchases where id=p_purchase and telegram_id=p_owner and product='deep_analysis' for update;
 if not found or p.state<>'processing' or p.lease is distinct from p_lease then return false;end if;
 if p.seeds=0 then return public.luna4_finish_personal_analysis(p_owner,p_purchase,p_lease,p_result);end if;
 if p_result is null then
  select moon_seeds_available into strict balance from public.moon_gardens where telegram_id=p_owner for update;
  insert into public.luna_seed_ledger(telegram_id,event_key,kind,delta,balance_after) values(p_owner,'luna43:deep_refund:'||p.id::text,'refund',p.seeds,balance+p.seeds);
  update public.moon_gardens set moon_seeds_available=balance+p.seeds,updated_at=now() where telegram_id=p_owner;
  update public.luna43_seed_purchases set state='failed_refunded',updated_at=now() where id=p.id;
 else
  if jsonb_typeof(p_result)<>'object' or octet_length(p_result::text)>30000 then raise exception 'Invalid result' using errcode='22023';end if;
  update public.luna43_seed_purchases set state='ready',result=p_result,updated_at=now() where id=p.id;
 end if;return true;
end $$;
revoke all on function public.luna4_analysis_allowance_status(bigint),public.luna4_purchase_seed_product(bigint,uuid,text,text,integer,integer,jsonb),public.luna4_claim_personal_analysis(bigint,uuid,uuid),public.luna4_finish_personal_analysis(bigint,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.luna4_analysis_allowance_status(bigint),public.luna4_purchase_seed_product(bigint,uuid,text,text,integer,integer,jsonb),public.luna4_claim_personal_analysis(bigint,uuid,uuid),public.luna4_finish_personal_analysis(bigint,uuid,uuid,jsonb) to service_role;
notify pgrst,'reload schema';commit;
-- Rollback closes NEW purchases only. Retain owner-bound delivery/recovery for
-- already confirmed Seed purchases and included holds. Never restore balances
-- from a snapshot, re-credit a ready report or delete historical purchases.
