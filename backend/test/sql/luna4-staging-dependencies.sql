-- STAGING-ONLY dependency repair: copied from production SCHEMA METADATA only.
-- No personal rows, prices, flags, existing table ACLs or production changes.
-- Deliberately outside supabase/migrations: production already has these objects.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';
do $$begin if to_regprocedure('public.luna21_analytics(integer)') is not null and encode(sha256(convert_to(pg_get_functiondef(to_regprocedure('public.luna21_analytics(integer)')),'UTF8')),'hex')<>'a5e805a2eb6d685eae0802496f8e62727986a29e92d50c324760c5fc0ee77177' then raise exception 'Existing dependency differs: luna21_analytics';end if;end $$;
do $$begin if to_regprocedure('public.luna21_buy_seed_reading(bigint,uuid,text,integer)') is not null and encode(sha256(convert_to(pg_get_functiondef(to_regprocedure('public.luna21_buy_seed_reading(bigint,uuid,text,integer)')),'UTF8')),'hex')<>'f64b2b30e066b0ee9fbbb235e215b751107ee0017ae8288cf95e462305e9d1e9' then raise exception 'Existing dependency differs: luna21_buy_seed_reading';end if;end $$;
do $$begin if to_regprocedure('public.luna21_claim_stars_checkout(bigint,uuid,text,integer,text)') is not null and encode(sha256(convert_to(pg_get_functiondef(to_regprocedure('public.luna21_claim_stars_checkout(bigint,uuid,text,integer,text)')),'UTF8')),'hex')<>'102ba593949468e54420cf12cf77347c6202a8df9f10a60123e1305635eb3a9a' then raise exception 'Existing dependency differs: luna21_claim_stars_checkout';end if;end $$;
do $$begin if to_regprocedure('public.luna21_fulfill_existing_stars(bigint,text,text,integer,text,text)') is not null and encode(sha256(convert_to(pg_get_functiondef(to_regprocedure('public.luna21_fulfill_existing_stars(bigint,text,text,integer,text,text)')),'UTF8')),'hex')<>'7e43e14be6a5972571425eea596d53dffc15f7bef73f471f49e96d6882118be7' then raise exception 'Existing dependency differs: luna21_fulfill_existing_stars';end if;end $$;
do $$begin if to_regprocedure('public.luna21_fulfill_stars_reading(bigint,uuid,text,text,integer)') is not null and encode(sha256(convert_to(pg_get_functiondef(to_regprocedure('public.luna21_fulfill_stars_reading(bigint,uuid,text,text,integer)')),'UTF8')),'hex')<>'ad666b1c564bb56508f863ca42480f900e1a4838149fecb96c214744db6bafa5' then raise exception 'Existing dependency differs: luna21_fulfill_stars_reading';end if;end $$;
do $$begin if to_regprocedure('public.luna21_prepare_stars_reading(bigint,uuid,text,integer)') is not null and encode(sha256(convert_to(pg_get_functiondef(to_regprocedure('public.luna21_prepare_stars_reading(bigint,uuid,text,integer)')),'UTF8')),'hex')<>'bd5a18a5e3f991bd795ff2dc13d3560da699b5a292947370b9188bcda18d64e9' then raise exception 'Existing dependency differs: luna21_prepare_stars_reading';end if;end $$;
do $$begin if to_regprocedure('public.luna21_reward(bigint,text,uuid)') is not null and encode(sha256(convert_to(pg_get_functiondef(to_regprocedure('public.luna21_reward(bigint,text,uuid)')),'UTF8')),'hex')<>'7af6bb7ef4388ef88e5b6296ff87c2578cbb59015d7029d0208ec0097b6aee41' then raise exception 'Existing dependency differs: luna21_reward';end if;end $$;
do $$begin if to_regprocedure('public.reserve_luna_daily_card(bigint,text,text,text,boolean,integer,integer,date)') is not null and encode(sha256(convert_to(pg_get_functiondef(to_regprocedure('public.reserve_luna_daily_card(bigint,text,text,text,boolean,integer,integer,date)')),'UTF8')),'hex')<>'b88499d69249867530de00df7e050551ab62519a8d05964b4d23b8301600870a' then raise exception 'Existing dependency differs: reserve_luna_daily_card';end if;end $$;
create table if not exists public.luna_daily_cards(telegram_id bigint not null references public.users(telegram_id) on delete cascade,reading_day date not null,client_reading_id uuid not null default gen_random_uuid(),card_id text not null check(card_id ~ '^[a-z-]{3,60}$'),orientation text not null check(orientation in('upright','reversed')),language text not null check(language in('en','ru')),created_at timestamptz not null default now(),primary key(telegram_id,reading_day),unique(telegram_id,client_reading_id));
create table if not exists public.luna_payment_fulfillments(telegram_charge_id text primary key,payment_id uuid not null references public.payments(id) on delete restrict,telegram_id bigint not null references public.users(telegram_id) on delete cascade,fulfilled_at timestamptz not null default now());
alter table public.luna_daily_cards enable row level security;alter table public.luna_daily_cards force row level security;revoke all on public.luna_daily_cards from public,anon,authenticated,service_role;grant select,insert on public.luna_daily_cards to service_role;
alter table public.luna_payment_fulfillments enable row level security;alter table public.luna_payment_fulfillments force row level security;revoke all on public.luna_payment_fulfillments from public,anon,authenticated,service_role;grant select,insert on public.luna_payment_fulfillments to service_role;
CREATE OR REPLACE FUNCTION public.luna21_analytics(p_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
 SET statement_timeout TO '8s'
AS $function$
 with bounds as(select (now() at time zone 'UTC')::date today,least(90,greatest(1,p_days)) days),
 activity(telegram_id,activity_day) as(
  select telegram_id,(created_at at time zone 'UTC')::date from public.luna_tarot_readings
  union select telegram_id,(created_at at time zone 'UTC')::date from public.practice_days
  union select telegram_id,(created_at at time zone 'UTC')::date from public.daily_checkins
  union select telegram_id,(created_at at time zone 'UTC')::date from public.ai_messages where role='user'
  union select telegram_id,(last_seen_at at time zone 'UTC')::date from public.users where last_seen_at is not null
 ),cohorts(telegram_id,cohort_day) as(select telegram_id,(created_at at time zone 'UTC')::date from public.users),
 retention as(select d.days,count(*) filter(where c.cohort_day+d.days<=b.today) eligible,
  count(*) filter(where c.cohort_day+d.days<=b.today and exists(select 1 from activity a where a.telegram_id=c.telegram_id and a.activity_day=c.cohort_day+d.days)) returned
  from cohorts c cross join bounds b cross join (values(1),(7),(30)) d(days) group by d.days),
 cost_types as(select coalesce(r.reading_kind,'chat') kind,count(*) requests,coalesce(sum(u.estimated_cost),0) usd
  from public.ai_usage u cross join bounds b left join public.luna_tarot_readings r on r.telegram_id=u.telegram_id and u.request_id='tarot:'||r.client_reading_id::text
  where u.created_at>=((b.today-b.days+1)::timestamp at time zone 'UTC') group by coalesce(r.reading_kind,'chat')),
 user_costs as(select u.telegram_id,sum(u.estimated_cost) usd from public.ai_usage u cross join bounds b where u.created_at>=((b.today-b.days+1)::timestamp at time zone 'UTC') group by u.telegram_id)
 select jsonb_build_object(
  'timezone','UTC','windowDays',b.days,'activityCoverage','Recorded events and last seen, not unrecorded historical opens',
  'dailyActiveUsers',(select count(*) from activity where activity_day=b.today),
  'dailyCardUniqueOpens',(select count(*) from public.luna_daily_cards where reading_day=b.today),
  'aiRequests',(select coalesce(sum(requests),0) from cost_types),
  'paidReadingOrders',(select count(*) from public.luna_reading_orders where status in ('entitled','consumed') and created_at>=((b.today-b.days+1)::timestamp at time zone 'UTC')),
  'paidReadingConversion',(select count(*) filter(where status in ('entitled','consumed'))::numeric/nullif(count(*),0) from public.luna_reading_orders where created_at>=((b.today-b.days+1)::timestamp at time zone 'UTC')),
  'premiumConversion',(select count(distinct telegram_id)::numeric/nullif((select count(*) from public.users),0) from public.payments where status='paid' and created_at>=((b.today-b.days+1)::timestamp at time zone 'UTC')),
  'starsRevenue',(select coalesce(sum(amount_stars),0) from public.payments where status='paid' and currency='XTR' and created_at>=((b.today-b.days+1)::timestamp at time zone 'UTC'))+(select coalesce(sum(amount),0) from public.luna_reading_orders where currency='XTR' and telegram_charge_id is not null and status in ('entitled','consumed') and created_at>=((b.today-b.days+1)::timestamp at time zone 'UTC')),
  'seedsEarned',(select coalesce(sum(delta) filter(where delta>0),0) from public.luna_seed_ledger where created_at>=((b.today-b.days+1)::timestamp at time zone 'UTC')),
  'seedsSpent',(select coalesce(-sum(delta) filter(where delta<0),0) from public.luna_seed_ledger where created_at>=((b.today-b.days+1)::timestamp at time zone 'UTC')),
  'aiCostsByReadingType',(select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'requests',requests,'usd',usd) order by kind),'[]'::jsonb) from cost_types),
  'averageAiCostPerActiveAiUser',(select coalesce(avg(usd),0) from user_costs),
  'retention',(select jsonb_agg(jsonb_build_object('day',days,'eligible',eligible,'returned',returned,'rate',returned::numeric/nullif(eligible,0)) order by days) from retention),
  'ledgerCoverage','V2 only; legacy awards and garden purchases are not backfilled') from bounds b;
$function$;

revoke all on function public.luna21_analytics(integer) from public,anon,authenticated;grant execute on function public.luna21_analytics(integer) to service_role;
CREATE OR REPLACE FUNCTION public.luna21_buy_seed_reading(p_telegram_id bigint, p_request_id uuid, p_kind text, p_expected_amount integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare s public.luna21_settings%rowtype;g public.moon_gardens%rowtype;o public.luna_reading_orders%rowtype;cost integer;
begin
 select * into strict s from public.luna21_settings where id;
 if not s.wallet_enabled or not s.paid_readings_enabled then return jsonb_build_object('status','disabled');end if;
 if p_kind not in ('single','three','five') or p_request_id is null then raise exception 'Invalid reading order';end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna21_wallet:'||p_telegram_id::text,0));
 select * into o from public.luna_reading_orders where telegram_id=p_telegram_id and request_id=p_request_id;
 if found then
  if o.kind<>p_kind or o.currency<>'SEEDS' then return jsonb_build_object('status','conflict');end if;
  return jsonb_build_object('status','duplicate','order',to_jsonb(o)-'telegram_id');
 end if;
 cost:=case p_kind when 'single' then s.single_seeds when 'three' then s.three_seeds else s.five_seeds end;
 if p_expected_amount is not null and p_expected_amount<>cost then return jsonb_build_object('status','price_changed');end if;
 select * into g from public.moon_gardens where telegram_id=p_telegram_id for update;
 if not found or g.moon_seeds_available<cost then return jsonb_build_object('status','insufficient');end if;
 insert into public.luna_reading_orders(telegram_id,request_id,kind,currency,amount,status) values(p_telegram_id,p_request_id,p_kind,'SEEDS',cost,'entitled') returning * into o;
 update public.moon_gardens set moon_seeds_available=g.moon_seeds_available-cost,updated_at=now() where telegram_id=p_telegram_id;
 insert into public.luna_seed_ledger(telegram_id,event_key,kind,delta,balance_after) values(p_telegram_id,'order:'||o.id,'reading_purchase',-cost,g.moon_seeds_available-cost);
 return jsonb_build_object('status','ok','order',to_jsonb(o)-'telegram_id','balance',g.moon_seeds_available-cost);
end $function$;

revoke all on function public.luna21_buy_seed_reading(bigint,uuid,text,integer) from public,anon,authenticated;grant execute on function public.luna21_buy_seed_reading(bigint,uuid,text,integer) to service_role;
CREATE OR REPLACE FUNCTION public.luna21_claim_stars_checkout(p_telegram_id bigint, p_order_id uuid, p_currency text, p_amount integer, p_query_id text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare o public.luna_reading_orders%rowtype;
begin
 if p_currency is distinct from 'XTR' or p_query_id is null or length(p_query_id) not between 1 and 512 then return false;end if;
 if not exists(select 1 from public.luna21_settings where id and paid_readings_enabled) then return false;end if;
 select * into o from public.luna_reading_orders where id=p_order_id and telegram_id=p_telegram_id for update;
 if not found or o.currency<>'XTR' or o.amount is distinct from p_amount or o.status<>'pending' then return false;end if;
 if o.checkout_query_id is not null then return o.checkout_query_id=p_query_id;end if;
 update public.luna_reading_orders set checkout_query_id=p_query_id,checkout_accepted_at=now(),updated_at=now() where id=o.id;
 return true;
end $function$;

revoke all on function public.luna21_claim_stars_checkout(bigint,uuid,text,integer,text) from public,anon,authenticated;grant execute on function public.luna21_claim_stars_checkout(bigint,uuid,text,integer,text) to service_role;
CREATE OR REPLACE FUNCTION public.luna21_fulfill_existing_stars(p_telegram_id bigint, p_plan text, p_currency text, p_amount integer, p_charge_id text, p_provider_charge_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
end $function$;

revoke all on function public.luna21_fulfill_existing_stars(bigint,text,text,integer,text,text) from public,anon,authenticated;grant execute on function public.luna21_fulfill_existing_stars(bigint,text,text,integer,text,text) to service_role;
CREATE OR REPLACE FUNCTION public.luna21_fulfill_stars_reading(p_telegram_id bigint, p_order_id uuid, p_charge_id text, p_currency text, p_amount integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare o public.luna_reading_orders%rowtype;
begin
 if p_charge_id is null or length(p_charge_id) not between 1 and 512 or p_currency is distinct from 'XTR' then raise exception 'Invalid Stars receipt';end if;
 select * into strict o from public.luna_reading_orders where id=p_order_id and telegram_id=p_telegram_id for update;
 if o.currency<>'XTR' or o.amount is distinct from p_amount then raise exception 'Stars order mismatch';end if;
 if o.telegram_charge_id is not null then
  if o.telegram_charge_id<>p_charge_id then raise exception 'Stars charge mismatch';end if;
  return jsonb_build_object('status','duplicate','order',to_jsonb(o)-'telegram_id');
 end if;
 if o.status<>'pending' or exists(select 1 from public.payments where telegram_payment_charge_id=p_charge_id) then raise exception 'Invalid Stars order state';end if;
 update public.luna_reading_orders set status='entitled',telegram_charge_id=p_charge_id,updated_at=now() where id=o.id returning * into o;
 return jsonb_build_object('status','ok','order',to_jsonb(o)-'telegram_id');
end $function$;

revoke all on function public.luna21_fulfill_stars_reading(bigint,uuid,text,text,integer) from public,anon,authenticated;grant execute on function public.luna21_fulfill_stars_reading(bigint,uuid,text,text,integer) to service_role;
CREATE OR REPLACE FUNCTION public.luna21_prepare_stars_reading(p_telegram_id bigint, p_request_id uuid, p_kind text, p_expected_amount integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare s public.luna21_settings%rowtype;o public.luna_reading_orders%rowtype;cost integer;
begin
 select * into strict s from public.luna21_settings where id;
 if not s.paid_readings_enabled then return jsonb_build_object('status','disabled');end if;
 if p_kind not in ('single','three','five') or p_request_id is null then raise exception 'Invalid order';end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna21_wallet:'||p_telegram_id::text,0));
 select * into o from public.luna_reading_orders where telegram_id=p_telegram_id and request_id=p_request_id;
 if found then
  if o.kind<>p_kind or o.currency<>'XTR' then return jsonb_build_object('status','conflict');end if;
  return jsonb_build_object('status','duplicate','order',to_jsonb(o)-'telegram_id');
 end if;
 cost:=case p_kind when 'single' then s.single_stars when 'three' then s.three_stars else s.five_stars end;
 if p_expected_amount is not null and p_expected_amount<>cost then return jsonb_build_object('status','price_changed');end if;
 insert into public.luna_reading_orders(telegram_id,request_id,kind,currency,amount,status) values(p_telegram_id,p_request_id,p_kind,'XTR',cost,'pending') returning * into o;
 return jsonb_build_object('status','ok','order',to_jsonb(o)-'telegram_id');
end $function$;

revoke all on function public.luna21_prepare_stars_reading(bigint,uuid,text,integer) from public,anon,authenticated;grant execute on function public.luna21_prepare_stars_reading(bigint,uuid,text,integer) to service_role;
CREATE OR REPLACE FUNCTION public.luna21_reward(p_telegram_id bigint, p_kind text, p_source_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare s public.luna21_settings%rowtype;g public.moon_gardens%rowtype;v_day date:=(now() at time zone 'UTC')::date;amount integer;earned integer;days integer;bonus integer:=0;valid boolean:=false;
begin
 select * into strict s from public.luna21_settings where id;
 if not s.wallet_enabled or not s.rewards_enabled then return jsonb_build_object('status','disabled','awarded',0);end if;
 if p_kind not in ('meditation','breath','checkin') or p_source_id is null then raise exception 'Invalid reward source';end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna21_wallet:'||p_telegram_id::text,0));
 if p_kind='meditation' then
  select exists(select 1 from public.playback_sessions p join public.meditations m on m.id=p.meditation_id where p.id=p_source_id and p.telegram_id=p_telegram_id and p.completed_at>=v_day::timestamp at time zone 'UTC' and p.completed_at<((v_day+1)::timestamp at time zone 'UTC') and p.listened_seconds>=ceil(m.duration*.9)) into valid;amount:=s.reward_meditation;
 elsif p_kind='breath' then
  select exists(select 1 from public.luna_breath_proofs b where b.id=p_source_id and b.telegram_id=p_telegram_id and b.completed_at>=v_day::timestamp at time zone 'UTC' and b.completed_at<((v_day+1)::timestamp at time zone 'UTC') and b.verified_seconds>=b.duration_seconds*.9 and b.completed_at-b.started_at>=make_interval(secs=>b.duration_seconds*.9)) into valid;amount:=s.reward_breath;
 else
  select exists(select 1 from public.daily_checkins c where c.id=p_source_id and c.telegram_id=p_telegram_id and c.created_at>=v_day::timestamp at time zone 'UTC' and c.created_at<((v_day+1)::timestamp at time zone 'UTC')) into valid;amount:=s.reward_checkin;
 end if;
 if not valid then return jsonb_build_object('status','unverified','awarded',0);end if;
 if exists(select 1 from public.luna_seed_ledger l where l.telegram_id=p_telegram_id and l.reward_day=v_day and l.kind=p_kind) then return jsonb_build_object('status','duplicate','awarded',0);end if;
 select coalesce(sum(delta),0) into earned from public.luna_seed_ledger l where l.telegram_id=p_telegram_id and l.reward_day=v_day and l.kind in ('meditation','breath','checkin');
 amount:=least(amount,greatest(0,s.reward_daily_cap-earned));
 if amount<=0 then return jsonb_build_object('status','limit','awarded',0);end if;
 insert into public.moon_gardens(telegram_id) values(p_telegram_id) on conflict(telegram_id) do nothing;
 select * into strict g from public.moon_gardens where telegram_id=p_telegram_id for update;
 insert into public.luna_seed_ledger(telegram_id,event_key,kind,delta,balance_after,reward_day) values(p_telegram_id,'reward:'||v_day||':'||p_kind,p_kind,amount,g.moon_seeds_available+amount,v_day);
 select count(distinct reward_day) into days from public.luna_seed_ledger l where l.telegram_id=p_telegram_id and l.kind in ('meditation','breath','checkin');
 if days>0 and days%7=0 and s.reward_seven_days>0 then
  insert into public.luna_seed_ledger(telegram_id,event_key,kind,delta,balance_after,reward_day) values(p_telegram_id,'seven_days:'||(days/7),'seven_days',s.reward_seven_days,g.moon_seeds_available+amount+s.reward_seven_days,v_day) on conflict(telegram_id,event_key) do nothing;
  if found then bonus:=s.reward_seven_days;end if;
 end if;
 update public.moon_gardens set moon_seeds_available=g.moon_seeds_available+amount+bonus,moon_seeds_earned_total=g.moon_seeds_earned_total+amount+bonus,last_moon_seed_earned_at=now(),updated_at=now() where telegram_id=p_telegram_id;
 return jsonb_build_object('status','ok','awarded',amount,'bonus',bonus,'balance',g.moon_seeds_available+amount+bonus);
end $function$;

revoke all on function public.luna21_reward(bigint,text,uuid) from public,anon,authenticated;grant execute on function public.luna21_reward(bigint,text,uuid) to service_role;
CREATE OR REPLACE FUNCTION public.reserve_luna_daily_card(p_telegram_id bigint, p_card_id text, p_orientation text, p_language text, p_generate boolean, p_daily_limit integer, p_global_limit integer, p_expected_day date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_day date:=(now() at time zone 'UTC')::date;
 v_daily public.luna_daily_cards%rowtype;v_new boolean;v_hash text;v_result jsonb;
begin
 if p_generate and p_expected_day is not null and p_expected_day<>v_day then return jsonb_build_object('status','day_changed','acquired',false);end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna_tarot:'||p_telegram_id::text,0));
 insert into public.luna_daily_cards(telegram_id,reading_day,card_id,orientation,language)
 values(p_telegram_id,v_day,p_card_id,p_orientation,p_language)
 on conflict(telegram_id,reading_day) do nothing;
 v_new:=found;
 select * into v_daily from public.luna_daily_cards d where d.telegram_id=p_telegram_id and d.reading_day=v_day;
 -- Removing private interpretation must not allow rerolling or spending AI again.
 if not v_new and not exists(select 1 from public.luna_tarot_readings r where r.telegram_id=p_telegram_id and r.client_reading_id=v_daily.client_reading_id) then
  return jsonb_build_object('status','deleted','acquired',false);
 end if;
 v_hash:=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(v_daily.client_reading_id::text||':'||v_daily.card_id||':'||v_daily.orientation||':'||v_daily.language,'UTF8')),'hex');
 v_result:=public.reserve_luna_tarot_reading(p_telegram_id,v_daily.client_reading_id,v_hash,v_daily.card_id,v_daily.orientation,'general','',v_daily.language,p_generate,p_daily_limit,p_global_limit);
 if v_new then
  update public.luna_tarot_readings set reading_kind='daily',cards=jsonb_build_array(jsonb_build_object('cardId',v_daily.card_id,'orientation',v_daily.orientation)) where telegram_id=p_telegram_id and client_reading_id=v_daily.client_reading_id;
  v_result:=jsonb_set(v_result,'{reading,reading_kind}','"daily"'::jsonb);
  v_result:=jsonb_set(v_result,'{reading,cards}',jsonb_build_array(jsonb_build_object('cardId',v_daily.card_id,'orientation',v_daily.orientation)));
 end if;
 return v_result||jsonb_build_object('day',v_day,'resetsAt',((v_day+1)::timestamp at time zone 'UTC'));
end $function$;

revoke all on function public.reserve_luna_daily_card(bigint,text,text,text,boolean,integer,integer,date) from public,anon,authenticated;grant execute on function public.reserve_luna_daily_card(bigint,text,text,text,boolean,integer,integer,date) to service_role;
notify pgrst,'reload schema';commit;
-- Non-destructive rollback: close only new callers/grants if needed; retain all
-- saved cards/receipt identity rows. Never restore old settings or wallet totals.
