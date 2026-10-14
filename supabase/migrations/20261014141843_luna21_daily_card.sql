-- Luna only. Requires reviewed Tarot history migration + its service-only RPC.
-- PREPARED, NOT APPLIED. UTC is the server calendar, never a client supplied day.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $$ begin
 if to_regprocedure('public.reserve_luna_tarot_reading(bigint,uuid,text,text,text,text,text,text,boolean,integer,integer)') is null then
  raise exception 'Missing Luna Tarot reservation dependency';
 end if;
end $$;
alter table public.luna_tarot_readings add column if not exists reading_kind text not null default 'single' check(reading_kind in ('single','daily','three','five'));
alter table public.luna_tarot_readings add column if not exists cards jsonb not null default '[]'::jsonb check(jsonb_typeof(cards)='array');
create table if not exists public.luna_daily_cards (
 telegram_id bigint not null references public.users(telegram_id) on delete cascade,
 reading_day date not null,
 client_reading_id uuid not null default gen_random_uuid(),
 card_id text not null check(card_id ~ '^[a-z-]{3,60}$'),
 orientation text not null check(orientation in ('upright','reversed')),
 language text not null check(language in ('en','ru')),
 created_at timestamptz not null default now(),
 primary key(telegram_id,reading_day),
 unique(telegram_id,client_reading_id)
);
alter table public.luna_daily_cards enable row level security;
alter table public.luna_daily_cards force row level security;
revoke all on public.luna_daily_cards from public,anon,authenticated,service_role;
grant select,insert on public.luna_daily_cards to service_role;

create or replace function public.reserve_luna_daily_card(
 p_telegram_id bigint,p_card_id text,p_orientation text,p_language text,
 p_generate boolean,p_daily_limit integer,p_global_limit integer,p_expected_day date default null
) returns jsonb language plpgsql security invoker set search_path='' as $$
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
end $$;
revoke all on function public.reserve_luna_daily_card(bigint,text,text,text,boolean,integer,integer,date) from public,anon,authenticated;
grant execute on function public.reserve_luna_daily_card(bigint,text,text,text,boolean,integer,integer,date) to service_role;
notify pgrst,'reload schema';
commit;
-- Operational rollback: disable FEATURE_DAILY_CARD_V2 + VITE_FEATURE_DAILY_CARD_V2,
-- drain requests, revoke this RPC from service_role. Keep registry/history/attempts;
-- never reset day registry, counters, balances, or restore stale data over production.
-- Reapply migration to restore explicit privileges when safe.
