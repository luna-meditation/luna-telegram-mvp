-- A versioned NEXT catalog in the EXISTING Luna settings. Saving a draft does
-- not change current prices, checkout, quotas, rewards or historical rights.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';
create or replace function public.luna4_valid_economy_catalog(p jsonb)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare item jsonb;group_value jsonb;key text;plan text;ids text[]:='{}';
begin
 if p is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>32000 or
  p-array['version','currency','recurring','premiumStars','premiumAllowances','packages','products','rewards']<>'{}'::jsonb or
  not(p ?& array['version','currency','recurring','premiumStars','premiumAllowances','packages','products','rewards']) or
  p->>'version' is distinct from 'luna-4.0-completion-v1' or p->>'currency' is distinct from 'XTR' or p->'recurring' is distinct from 'false'::jsonb or
  p->'premiumStars' is distinct from '{"weekly":500,"monthly":1000,"annual":5000,"lifetime":10000}'::jsonb then return false;end if;
 group_value:=p->'premiumAllowances';
 if jsonb_typeof(group_value)<>'object' or group_value-array['weekly','monthly','annual','lifetime']<>'{}'::jsonb or not(group_value ?& array['weekly','monthly','annual','lifetime']) then return false;end if;
 foreach plan in array array['weekly','monthly','annual','lifetime'] loop
  item:=group_value->plan;
  if jsonb_typeof(item)<>'object' or item-array['standard','three','deep','premiumMeditations','basicPortrait']<>'{}'::jsonb or not(item ?& array['standard','three','deep','premiumMeditations','basicPortrait']) then return false;end if;
  foreach key in array array['standard','three','deep'] loop
   if jsonb_typeof(item->key)<>'number' or (item->>key)!~'^[0-9]+$' or (item->>key)::numeric not between 0 and 10000 then return false;end if;
  end loop;
  if jsonb_typeof(item->'premiumMeditations')<>'boolean' or jsonb_typeof(item->'basicPortrait')<>'boolean' then return false;end if;
 end loop;
 if jsonb_typeof(p->'packages')<>'array' or jsonb_array_length(p->'packages')<>4 then return false;end if;
 for item in select value from jsonb_array_elements(p->'packages') loop
  if jsonb_typeof(item)<>'object' or item-array['id','name','stars','seeds']<>'{}'::jsonb or not(item ?& array['id','name','stars','seeds']) or
   jsonb_typeof(item->'id') is distinct from 'string' or item->>'id' not in('seeds_100','seeds_300','seeds_700','seeds_1500') or item->>'id'=any(ids) or jsonb_typeof(item->'name')<>'string' or length(item->>'name') not between 1 and 40 then return false;end if;
  ids:=array_append(ids,item->>'id');
  foreach key in array array['stars','seeds'] loop
   if jsonb_typeof(item->key)<>'number' or (item->>key)!~'^[0-9]+$' or (item->>key)::numeric not between 1 and 10000 then return false;end if;
  end loop;
 end loop;
 group_value:=p->'products';
 if jsonb_typeof(group_value)<>'object' or group_value-array['daily','single','three','five','deep','compatibility','portrait','aiMessages']<>'{}'::jsonb or not(group_value ?& array['daily','single','three','five','deep','compatibility','portrait','aiMessages']) then return false;end if;
 foreach key in array array['daily','single','three','five','deep','compatibility','portrait'] loop
  if jsonb_typeof(group_value->key)<>'number' or (group_value->>key)!~'^[0-9]+$' or (group_value->>key)::numeric not between 1 and 10000 then return false;end if;
 end loop;
 item:=group_value->'aiMessages';
 if jsonb_typeof(item)<>'object' or item-array['seeds','quantity']<>'{}'::jsonb or not(item ?& array['seeds','quantity']) or
  jsonb_typeof(item->'seeds')<>'number' or (item->>'seeds')!~'^[0-9]+$' or (item->>'seeds')::numeric not between 1 and 10000 or
  jsonb_typeof(item->'quantity')<>'number' or (item->>'quantity')!~'^[0-9]+$' or (item->>'quantity')::numeric not between 1 and 100 then return false;end if;
 group_value:=p->'rewards';
 if jsonb_typeof(group_value)<>'object' or group_value-array['welcomeSeeds','introductoryMessages','dailyCheckin','sevenDayStreak','referralInvitee','referralInviter','referralFirstPurchase']<>'{}'::jsonb or not(group_value ?& array['welcomeSeeds','introductoryMessages','dailyCheckin','sevenDayStreak','referralInvitee','referralInviter','referralFirstPurchase']) then return false;end if;
 foreach key in array array['welcomeSeeds','introductoryMessages','dailyCheckin','sevenDayStreak','referralInvitee','referralInviter','referralFirstPurchase'] loop
  if jsonb_typeof(group_value->key)<>'number' or (group_value->>key)!~'^[0-9]+$' or (group_value->>key)::numeric not between 0 and (case when key='introductoryMessages' then 100 else 10000 end) then return false;end if;
 end loop;
 return true;
exception when invalid_text_representation or numeric_value_out_of_range then return false;
end $$;
alter table public.luna34_commercial_settings add column if not exists next_catalog jsonb;
alter table public.luna34_commercial_settings add column if not exists next_catalog_revision integer not null default 0 check(next_catalog_revision>=0);
do $$begin if not exists(select 1 from pg_constraint where conrelid='public.luna34_commercial_settings'::regclass and conname='luna4_next_catalog_valid') then
 alter table public.luna34_commercial_settings add constraint luna4_next_catalog_valid check(next_catalog is null or public.luna4_valid_economy_catalog(next_catalog));
end if;end $$;

create or replace function public.luna4_update_next_catalog(p_actor bigint,p_request uuid,p_expected integer,p_body jsonb,p_reason text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare cfg public.luna34_commercial_settings%rowtype;prior public.luna40_admin_audit%rowtype;input_value jsonb;result_value jsonb;
begin
 if coalesce(p_actor<=0 or p_request is null or p_expected<0 or length(btrim(p_reason)) not between 3 and 500 or not public.luna4_valid_economy_catalog(p_body),true) then raise exception 'Invalid next catalog' using errcode='22023';end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna4_next_catalog:'||p_actor::text||':'||p_request::text,0));
 input_value:=jsonb_build_object('catalog',p_body,'expectedRevision',p_expected);
 select * into prior from public.luna40_admin_audit where actor=p_actor and request_id=p_request;
 if found then
  if prior.action<>'catalog.luna4.draft.update' or prior.input<>input_value or prior.reason<>p_reason then raise exception 'Catalog identity conflict' using errcode='23505';end if;
  return prior.result;
 end if;
 select * into strict cfg from public.luna34_commercial_settings where id for update;
 if cfg.next_catalog_revision<>p_expected then raise exception 'Next catalog changed' using errcode='PT409';end if;
 update public.luna34_commercial_settings set next_catalog=p_body,next_catalog_revision=next_catalog_revision+1 where id;
 result_value:=jsonb_build_object('catalog',p_body,'revision',p_expected+1,'active',false,'activation','requires_verified_release');
 insert into public.luna40_admin_audit(actor,request_id,action,reason,input,previous,result)
 values(p_actor,p_request,'catalog.luna4.draft.update',p_reason,input_value,cfg.next_catalog,result_value);
 return result_value;
end $$;
revoke all on function public.luna4_valid_economy_catalog(jsonb),public.luna4_update_next_catalog(bigint,uuid,integer,jsonb,text) from public,anon,authenticated;
grant execute on function public.luna4_valid_economy_catalog(jsonb),public.luna4_update_next_catalog(bigint,uuid,integer,jsonb,text) to service_role;
notify pgrst,'reload schema';commit;
-- Rollback the new editor endpoint/permission only. Retain audited drafts.
-- The active catalog, financial flags and existing purchase terms never change.
