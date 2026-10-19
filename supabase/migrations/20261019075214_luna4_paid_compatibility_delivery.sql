-- Same authoritative wallet, purchase journal and calculated report cache.
-- No catalog activation, historic backfill, balance or entitlement changes.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';
alter table public.luna43_seed_purchases drop constraint if exists luna43_seed_purchases_product_check;
alter table public.luna43_seed_purchases add constraint luna43_seed_purchases_product_check check(product in('ai_messages','deep_analysis','personal_portrait','compatibility_report'));
create unique index if not exists luna4_one_owned_compatibility_purchase on public.luna43_seed_purchases(telegram_id,(parameters->>'cacheKey')) where product='compatibility_report' and state in('entitled','processing','ready');

create or replace function public.luna4_purchase_compatibility(p_owner bigint,p_request uuid,p_hash text,p_expected integer,p_revision integer,p_parameters jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare cfg public.luna34_commercial_settings%rowtype;p public.luna43_seed_purchases%rowtype;price integer;balance_value integer;key_value text;first_value uuid;second_value uuid;
begin
 if coalesce(p_request is null or p_hash !~ '^[a-f0-9]{64}$' or p_expected<1 or p_revision<0 or jsonb_typeof(p_parameters)<>'object' or octet_length(p_parameters::text)>1500 or p_parameters->>'cacheKey' !~ '^[a-f0-9]{64}$' or p_parameters->>'language' not in('en','ru') or p_parameters->>'relationship' not in('romantic','business','friendship','family') or p_parameters->>'consent' is distinct from 'true',true) then raise exception 'Confirmed compatibility terms required' using errcode='22023';end if;
 first_value:=(p_parameters->>'firstChartId')::uuid;second_value:=(p_parameters->>'secondChartId')::uuid;key_value:=p_parameters->>'cacheKey';
 if first_value is null or second_value is null or first_value=second_value or not exists(select 1 from public.luna30_chart_cache a join public.luna30_chart_cache b on b.telegram_id=a.telegram_id and b.profile_id<>a.profile_id where a.telegram_id=p_owner and a.id=first_value and b.id=second_value) then raise exception 'Different owned calculations required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna21_wallet:'||p_owner::text,0));
 select * into p from public.luna43_seed_purchases where telegram_id=p_owner and request_id=p_request;
 if found then if p.product<>'compatibility_report' or p.request_hash<>p_hash or p.parameters<>p_parameters then raise exception 'Purchase identity conflict' using errcode='23505';end if;return jsonb_build_object('status','duplicate','purchase',to_jsonb(p)-'telegram_id'-'request_hash');end if;
 if exists(select 1 from public.luna30_astrology_reports where telegram_id=p_owner and cache_key=key_value and report_kind='compatibility') then return jsonb_build_object('status','cached');end if;
 select * into p from public.luna43_seed_purchases where telegram_id=p_owner and product='compatibility_report' and parameters->>'cacheKey'=key_value and state in('entitled','processing','ready');
 if found then if p.parameters<>p_parameters then raise exception 'Original report context required';end if;return jsonb_build_object('status','duplicate','purchase',to_jsonb(p)-'telegram_id'-'request_hash');end if;
 if exists(select 1 from public.luna30_astrology_jobs where telegram_id=p_owner and cache_key=key_value) then return jsonb_build_object('status','delivery_review_required');end if;
 select * into strict cfg from public.luna34_commercial_settings where id;
 if cfg.catalog->>'version'<>'luna-4.0-completion-v1' or not(cfg.luna4_activation_verified and cfg.checkout_enabled and cfg.owner_approved and cfg.live_payment_verified and cfg.quotas_enabled) or cfg.luna4_cutover_at is null or cfg.luna4_cutover_at>now() or not public.luna4_valid_economy_catalog(cfg.catalog) or not exists(select 1 from public.luna21_settings where id and wallet_enabled) or not exists(select 1 from public.luna30_release_settings where id and astrology_enabled and astrology_ai_enabled and paid_compatibility_enabled) or not exists(select 1 from public.luna32_runtime_settings where id and generation_enabled and cost_baseline_verified) then return jsonb_build_object('status','disabled');end if;
 price:=(cfg.catalog#>>'{products,compatibility}')::integer;if price is null or price not between 1 and 10000 or price<>p_expected or p_revision<>cfg.catalog_revision then return jsonb_build_object('status','price_changed');end if;
 select moon_seeds_available into balance_value from public.moon_gardens where telegram_id=p_owner for update;if not found or balance_value<price then return jsonb_build_object('status','insufficient');end if;
 insert into public.luna43_seed_purchases(telegram_id,request_id,request_hash,product,seeds,quantity,catalog_revision,parameters,state,funding) values(p_owner,p_request,p_hash,'compatibility_report',price,1,cfg.catalog_revision,p_parameters,'entitled','seeds') returning * into p;
 insert into public.luna_seed_ledger(telegram_id,event_key,kind,delta,balance_after) values(p_owner,'luna43:purchase:'||p.id::text,'deep_analysis_purchase',-price,balance_value-price);
 update public.moon_gardens set moon_seeds_available=balance_value-price,updated_at=now() where telegram_id=p_owner;
 return jsonb_build_object('status','purchased','balance',balance_value-price,'purchase',to_jsonb(p)-'telegram_id'-'request_hash');
end $$;

create or replace function public.luna4_claim_compatibility_purchase(p_owner bigint,p_purchase uuid,p_lease uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.luna43_seed_purchases%rowtype;
begin
 if p_lease is null then raise exception 'Missing purchase lease';end if;
 select * into p from public.luna43_seed_purchases where id=p_purchase and telegram_id=p_owner and product='compatibility_report' for update;
 if not found then return jsonb_build_object('status','not_found');end if;
 if p.state<>'entitled' then return jsonb_build_object('status',p.state,'purchase',to_jsonb(p)-'telegram_id'-'request_hash');end if;
 update public.luna43_seed_purchases set state='processing',lease=p_lease,updated_at=now() where id=p.id returning * into p;
 return jsonb_build_object('status','claimed','purchase',to_jsonb(p)-'telegram_id'-'request_hash');
end $$;

create or replace function public.luna4_claim_paid_compatibility(p_owner bigint,p_purchase uuid,p_key text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.luna43_seed_purchases%rowtype;j public.luna30_astrology_jobs%rowtype;day_start timestamptz:=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
begin
 select * into p from public.luna43_seed_purchases where id=p_purchase and telegram_id=p_owner and product='compatibility_report' and state='processing';
 if not found or p.parameters->>'cacheKey' is distinct from p_key then raise exception 'Owned paid report required' using errcode='42501';end if;
 if not exists(select 1 from public.luna30_release_settings where id and astrology_enabled and astrology_ai_enabled) then return jsonb_build_object('status','disabled','acquired',false);end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna30_astrology_budget',0));
 select * into j from public.luna30_astrology_jobs where telegram_id=p_owner and cache_key=p_key;
 if found then return jsonb_build_object('status',j.state,'acquired',false);end if;
 -- The same bounded report-rate budget still applies; the paid deliverable
 -- does not reserve/consume another ordinary successful-answer allowance.
 if(select count(*)from public.luna30_astrology_jobs where created_at>=day_start)>=20 or(select count(*)from public.luna30_astrology_jobs where telegram_id=p_owner and created_at>=day_start)>=2 then return jsonb_build_object('status','limit','acquired',false);end if;
 insert into public.luna30_astrology_jobs(telegram_id,cache_key,first_chart_id,second_chart_id,report_kind,language,state) values(p_owner,p_key,(p.parameters->>'firstChartId')::uuid,(p.parameters->>'secondChartId')::uuid,'compatibility',p.parameters->>'language','processing');
 return jsonb_build_object('status','processing','acquired',true);
end $$;

create or replace function public.luna4_finish_paid_compatibility(p_owner bigint,p_purchase uuid,p_key text,p_report jsonb,p_model text,p_input integer,p_output integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.luna43_seed_purchases%rowtype;j public.luna30_astrology_jobs%rowtype;r public.luna30_astrology_reports%rowtype;
begin
 select * into p from public.luna43_seed_purchases where id=p_purchase and telegram_id=p_owner and product='compatibility_report' and state='processing';
 if not found or p.parameters->>'cacheKey' is distinct from p_key then raise exception 'Owned paid report required' using errcode='42501';end if;
 select * into strict j from public.luna30_astrology_jobs where telegram_id=p_owner and cache_key=p_key for update;
 if j.state<>'processing' or j.report_kind<>'compatibility' or jsonb_typeof(p_report)<>'object' or p_input<0 or p_output<=0 or not exists(select 1 from public.ai_usage where telegram_id=p_owner and request_id='astro:'||p_key and request_status='success' and input_tokens=p_input and output_tokens=p_output and model=p_model) then raise exception 'Verified paid report usage required';end if;
 insert into public.luna30_astrology_reports(telegram_id,first_chart_id,second_chart_id,report_kind,language,cache_key,report,model,input_tokens,output_tokens) values(p_owner,j.first_chart_id,j.second_chart_id,'compatibility',j.language,p_key,p_report,p_model,p_input,p_output) returning * into r;
 update public.luna30_astrology_jobs set state='completed',updated_at=now() where telegram_id=p_owner and cache_key=p_key;
 return to_jsonb(r)-'telegram_id'-'cache_key'-'input_tokens'-'output_tokens'-'model';
end $$;

create or replace function public.luna4_finish_compatibility_purchase(p_owner bigint,p_purchase uuid,p_lease uuid,p_result jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
declare p public.luna43_seed_purchases%rowtype;balance_value integer;
begin
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna21_wallet:'||p_owner::text,0));
 select * into p from public.luna43_seed_purchases where id=p_purchase and telegram_id=p_owner and product='compatibility_report' for update;
 if not found or p.state<>'processing' or p.lease is distinct from p_lease then return false;end if;
 if p_result is not null then
  if not exists(select 1 from public.luna30_astrology_reports r where r.telegram_id=p_owner and r.id=(p_result->>'reportId')::uuid and r.cache_key=p.parameters->>'cacheKey' and r.report_kind='compatibility' and r.first_chart_id=(p.parameters->>'firstChartId')::uuid and r.second_chart_id=(p.parameters->>'secondChartId')::uuid and r.language=p.parameters->>'language') or p_result->>'cacheKey' is distinct from p.parameters->>'cacheKey' or not exists(select 1 from public.luna32_ai_operations o where o.telegram_id=p_owner and o.operation_key='compatibility:'||p.id::text and o.state='succeeded' and exists(select 1 from public.luna32_ai_attempts a where a.telegram_id=o.telegram_id and a.operation_key=o.operation_key and a.lease=o.lease and a.state='settled' and a.provider_status='completed' and a.actual_cost_microusd is not null and a.output_tokens>0)) then raise exception 'Verified saved compatibility delivery required';end if;
  update public.luna43_seed_purchases set state='ready',result=p_result,updated_at=now() where id=p.id;
 else
  select moon_seeds_available into strict balance_value from public.moon_gardens where telegram_id=p_owner for update;
  insert into public.luna_seed_ledger(telegram_id,event_key,kind,delta,balance_after) values(p_owner,'luna43:deep_refund:'||p.id::text,'refund',p.seeds,balance_value+p.seeds);
  update public.moon_gardens set moon_seeds_available=balance_value+p.seeds,updated_at=now() where telegram_id=p_owner;
  update public.luna43_seed_purchases set state='failed_refunded',updated_at=now() where id=p.id;
 end if;return true;
end $$;
revoke all on function public.luna4_purchase_compatibility(bigint,uuid,text,integer,integer,jsonb),public.luna4_claim_compatibility_purchase(bigint,uuid,uuid),public.luna4_claim_paid_compatibility(bigint,uuid,text),public.luna4_finish_paid_compatibility(bigint,uuid,text,jsonb,text,integer,integer),public.luna4_finish_compatibility_purchase(bigint,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.luna4_purchase_compatibility(bigint,uuid,text,integer,integer,jsonb),public.luna4_claim_compatibility_purchase(bigint,uuid,uuid),public.luna4_claim_paid_compatibility(bigint,uuid,text),public.luna4_finish_paid_compatibility(bigint,uuid,text,jsonb,text,integer,integer),public.luna4_finish_compatibility_purchase(bigint,uuid,uuid,jsonb) to service_role;
notify pgrst,'reload schema';commit;
-- Rollback: close new paid compatibility/checkout gates. Keep exact owned
-- delivery/recovery for purchases, historical receipts and all saved reports.
