-- Reuse the existing draw/reservation engine. This access adapter does not
-- activate a catalog, charge a wallet, or consume an allowance itself.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';
create or replace function public.luna4_reserve_tarot_spread(
 p_telegram_id bigint,p_client_reading_id uuid,p_request_hash text,p_kind text,p_cards jsonb,
 p_intention text,p_question text,p_language text,p_generate boolean,p_order_id uuid,p_premium_allowed boolean,
 p_daily_limit integer,p_global_limit integer
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare cfg public.luna34_commercial_settings%rowtype;available jsonb;contract jsonb;result_value jsonb;r public.luna_tarot_readings%rowtype;
 s public.luna21_settings%rowtype;runtime public.luna32_runtime_settings%rowtype;used_value integer;quota_value integer;legacy boolean:=false;
begin
 select * into strict cfg from public.luna34_commercial_settings where id;
 if cfg.catalog->>'version'<>'luna-4.0-completion-v1' then
  return public.reserve_luna_tarot_spread(p_telegram_id,p_client_reading_id,p_request_hash,p_kind,p_cards,p_intention,p_question,p_language,p_generate,p_order_id,p_premium_allowed,p_daily_limit,p_global_limit);
 end if;
 -- An explicitly selected owned purchase is never silently replaced with a
 -- Premium benefit. Its existing engine binds it before the provider call.
 if p_order_id is not null then
  return public.reserve_luna_tarot_spread(p_telegram_id,p_client_reading_id,p_request_hash,p_kind,p_cards,p_intention,p_question,p_language,p_generate,p_order_id,false,p_daily_limit,p_global_limit);
 end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna_tarot:'||p_telegram_id::text,0));
 result_value:=public.reserve_luna_tarot_spread(p_telegram_id,p_client_reading_id,p_request_hash,p_kind,p_cards,p_intention,p_question,p_language,false,null,false,p_daily_limit,p_global_limit);
 if not p_generate or result_value->>'status' in('conflict','deleted','already_attempted') or result_value#>>'{reading,status}' is distinct from 'local' then return result_value;end if;
 if not(cfg.luna4_activation_verified and cfg.owner_approved and cfg.quotas_enabled) then return result_value||jsonb_build_object('status','access_required');end if;
 contract:=public.luna4_membership_contract(p_telegram_id);
 legacy:=coalesce((contract->>'preserveLegacy')::boolean,false);
 select * into strict runtime from public.luna32_runtime_settings where id;
 -- Preserve the current free Beta without burning a finite purchased benefit.
 if runtime.public_beta and runtime.beta_starts_at<=now() and runtime.beta_expires_at>now() and runtime.beta_features ? 'tarot' then
  return public.reserve_luna_tarot_reading(p_telegram_id,p_client_reading_id,p_request_hash,p_cards->0->>'cardId',p_cards->0->>'orientation',p_intention,p_question,p_language,true,p_daily_limit,p_global_limit);
 end if;
 if legacy then
  select * into strict s from public.luna21_settings where id;
  quota_value:=case p_kind when 'three' then s.premium_three_daily when 'five' then s.premium_five_daily else 0 end;
  select count(*) into used_value from public.luna_premium_reading_usage where telegram_id=p_telegram_id and usage_day=(now() at time zone 'UTC')::date and kind=p_kind;
  if not(s.premium_enabled and p_premium_allowed) or used_value>=quota_value then return result_value||jsonb_build_object('status','access_required');end if;
 else
  if p_kind<>'three' then return result_value||jsonb_build_object('status','access_required');end if;
  available:=public.luna4_allowance_status(p_telegram_id,p_kind);
  if p_kind<>'three' or not coalesce((available->>'enabled')::boolean,false) or coalesce((available->>'remaining')::integer,0)<=0 then return result_value||jsonb_build_object('status','access_required');end if;
 end if;
 result_value:=public.reserve_luna_tarot_reading(p_telegram_id,p_client_reading_id,p_request_hash,p_cards->0->>'cardId',p_cards->0->>'orientation',p_intention,p_question,p_language,true,p_daily_limit,p_global_limit);
 if legacy and coalesce((result_value->>'acquired')::boolean,false) then
  insert into public.luna_premium_reading_usage(telegram_id,usage_day,kind,client_reading_id) values(p_telegram_id,(now() at time zone 'UTC')::date,p_kind,p_client_reading_id) on conflict do nothing;
 end if;
 -- New contracts are held only AFTER the real global operation lease, inside
 -- guardedProviderTransport. A last-benefit race fails before provider dispatch.
 return result_value;
end $$;
revoke all on function public.luna4_reserve_tarot_spread(bigint,uuid,text,text,jsonb,text,text,text,boolean,uuid,boolean,integer,integer) from public,anon,authenticated;
grant execute on function public.luna4_reserve_tarot_spread(bigint,uuid,text,text,jsonb,text,text,text,boolean,uuid,boolean,integer,integer) to service_role;
notify pgrst,'reload schema';commit;
-- Rollback: close the new catalog/quota gates, revert only the new caller and
-- retain all paid orders, cards, successful usage, and private historical data.
