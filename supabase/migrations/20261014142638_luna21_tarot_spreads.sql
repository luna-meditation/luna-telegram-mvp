-- PREPARED ONLY. Additive reading model; old single-card rows remain unchanged.
-- Depends on Tarot reservation + disabled economy foundation.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';
alter table public.luna_tarot_readings add column if not exists reading_kind text not null default 'single' check(reading_kind in ('single','daily','three','five'));
alter table public.luna_tarot_readings add column if not exists cards jsonb not null default '[]'::jsonb check(jsonb_typeof(cards)='array');
create or replace function public.reserve_luna_tarot_spread(
 p_telegram_id bigint,p_client_reading_id uuid,p_request_hash text,p_kind text,p_cards jsonb,
 p_intention text,p_question text,p_language text,p_generate boolean,p_order_id uuid,p_premium_allowed boolean,
 p_daily_limit integer,p_global_limit integer
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;r public.luna_tarot_readings%rowtype;s public.luna21_settings%rowtype;o public.luna_reading_orders%rowtype;
 v_day date:=(now() at time zone 'UTC')::date;premium boolean;used integer;quota integer;free_right boolean:=false;new_usage boolean:=false;
begin
 if p_kind not in ('single','three','five') or jsonb_typeof(p_cards)<>'array' or jsonb_array_length(p_cards)<>(case when p_kind='single' then 1 when p_kind='three' then 3 else 5 end) then raise exception 'Invalid spread';end if;
 if (select count(distinct c->>'cardId') from jsonb_array_elements(p_cards) c)<>jsonb_array_length(p_cards) or exists(select 1 from jsonb_array_elements(p_cards) c where c->>'cardId' is null or c->>'cardId' !~ '^[a-z-]{3,60}$' or c->>'orientation' is null or c->>'orientation' not in ('upright','reversed')) then raise exception 'Invalid spread cards';end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna_tarot:'||p_telegram_id::text,0));
 result:=public.reserve_luna_tarot_reading(p_telegram_id,p_client_reading_id,p_request_hash,p_cards->0->>'cardId',p_cards->0->>'orientation',p_intention,p_question,p_language,false,p_daily_limit,p_global_limit);
 if result->>'status' in ('conflict','deleted','already_attempted') then return result;end if;
 select * into strict r from public.luna_tarot_readings where telegram_id=p_telegram_id and client_reading_id=p_client_reading_id for update;
 if r.cards='[]'::jsonb and r.status='local' then update public.luna_tarot_readings set reading_kind=p_kind,cards=p_cards where id=r.id returning * into r;end if;
 if not p_generate or r.status<>'local' then return result||jsonb_build_object('reading',to_jsonb(r)-'telegram_id'-'request_hash');end if;
 select * into strict s from public.luna21_settings where id;
 select lifetime_access or coalesce(active_until>now(),false) into premium from public.users where telegram_id=p_telegram_id;
 if premium and s.premium_enabled and p_premium_allowed and p_kind in ('three','five') then
  quota:=case when p_kind='three' then s.premium_three_daily else s.premium_five_daily end;
  select count(*) into used from public.luna_premium_reading_usage where telegram_id=p_telegram_id and usage_day=v_day and kind=p_kind;
  free_right:=used<quota;
 end if;
 if not free_right then
  if not s.paid_readings_enabled or p_order_id is null then return jsonb_build_object('status','access_required','acquired',false,'reading',to_jsonb(r)-'telegram_id'-'request_hash');end if;
  select * into o from public.luna_reading_orders where id=p_order_id and telegram_id=p_telegram_id for update;
  if not found or o.kind<>p_kind or o.status<>'entitled' or o.client_reading_id is not null and o.client_reading_id<>p_client_reading_id then return jsonb_build_object('status','access_required','acquired',false,'reading',to_jsonb(r)-'telegram_id'-'request_hash');end if;
 end if;
 result:=public.reserve_luna_tarot_reading(p_telegram_id,p_client_reading_id,p_request_hash,p_cards->0->>'cardId',p_cards->0->>'orientation',p_intention,p_question,p_language,true,p_daily_limit,p_global_limit);
 if (result->>'acquired')::boolean then
  if free_right then insert into public.luna_premium_reading_usage(telegram_id,usage_day,kind,client_reading_id) values(p_telegram_id,v_day,p_kind,p_client_reading_id) on conflict do nothing;
  else update public.luna_reading_orders set client_reading_id=p_client_reading_id,updated_at=now() where id=o.id;end if;
 end if;
 return result;
end $$;
create or replace function public.settle_luna_tarot_spread(p_telegram_id bigint,p_client_reading_id uuid,p_status text,p_interpretation jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.luna_tarot_readings%rowtype;
begin
 if p_status not in ('ready','fallback') or p_status='ready' and p_interpretation is null then raise exception 'Invalid reading settlement';end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna_tarot:'||p_telegram_id::text,0));
 select * into strict r from public.luna_tarot_readings where telegram_id=p_telegram_id and client_reading_id=p_client_reading_id for update;
 if r.status<>'processing' then return to_jsonb(r)-'telegram_id'-'request_hash';end if;
 update public.luna_tarot_readings set status=p_status,interpretation=p_interpretation,fallback_reason=case when p_status='fallback' then 'provider_error' else null end,updated_at=now() where id=r.id returning * into r;
 if p_status='ready' then update public.luna_reading_orders set status='consumed',updated_at=now() where telegram_id=p_telegram_id and client_reading_id=p_client_reading_id and status='entitled';
 else update public.luna_reading_orders set client_reading_id=null,updated_at=now() where telegram_id=p_telegram_id and client_reading_id=p_client_reading_id and status='entitled';end if;
 return to_jsonb(r)-'telegram_id'-'request_hash';
end $$;
revoke all on function public.reserve_luna_tarot_spread(bigint,uuid,text,text,jsonb,text,text,text,boolean,uuid,boolean,integer,integer),public.settle_luna_tarot_spread(bigint,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.reserve_luna_tarot_spread(bigint,uuid,text,text,jsonb,text,text,text,boolean,uuid,boolean,integer,integer),public.settle_luna_tarot_spread(bigint,uuid,text,jsonb) to service_role;
notify pgrst,'reload schema';commit;
-- Rollback: disable FEATURE_TAROT_SPREADS / frontend flag, drain calls, keep saved
-- cards/interpretations/orders. Revoke RPC if needed; never drop history columns.
