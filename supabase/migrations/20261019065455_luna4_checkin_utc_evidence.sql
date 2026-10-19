-- Server UTC evidence for an explicit check-in INSERT/UPDATE, including an
-- edit of yesterday's local-calendar row. No mood text or historical backfill.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';
create table if not exists public.luna4_checkin_calendar(
 telegram_id bigint not null references public.users(telegram_id) on delete cascade,
 utc_day date not null,source_id uuid not null references public.daily_checkins(id) on delete cascade,
 created_at timestamptz not null default now(),primary key(telegram_id,utc_day)
);
alter table public.luna4_checkin_calendar enable row level security;alter table public.luna4_checkin_calendar force row level security;
revoke all on public.luna4_checkin_calendar from public,anon,authenticated,service_role;
grant select,insert on public.luna4_checkin_calendar to service_role;
create or replace function public.luna4_record_checkin_day()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if exists(select 1 from public.luna34_commercial_settings where id and catalog->>'version'='luna-4.0-completion-v1' and luna4_activation_verified and rewards_enabled and owner_approved and luna4_cutover_at<=now()) then
  insert into public.luna4_checkin_calendar(telegram_id,utc_day,source_id) values(new.telegram_id,(now() at time zone 'UTC')::date,new.id) on conflict do nothing;
 end if;
 return new;
end $$;
revoke all on function public.luna4_record_checkin_day() from public,anon,authenticated;grant execute on function public.luna4_record_checkin_day() to service_role;
drop trigger if exists luna4_checkin_calendar_evidence on public.daily_checkins;
create trigger luna4_checkin_calendar_evidence after insert or update on public.daily_checkins for each row execute function public.luna4_record_checkin_day();

create or replace function public.luna4_reward_checkin(p_owner bigint,p_source uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare cfg public.luna34_commercial_settings%rowtype;day_value date:=(now() at time zone 'UTC')::date;start_value timestamptz;
 amount integer;bonus integer:=0;balance_value integer;days integer;
begin
 select * into strict cfg from public.luna34_commercial_settings where id;
 if cfg.catalog->>'version'<>'luna-4.0-completion-v1' or not(cfg.luna4_activation_verified and cfg.rewards_enabled and cfg.owner_approved) or cfg.luna4_cutover_at is null or cfg.luna4_cutover_at>now() or not exists(select 1 from public.luna21_settings where id and wallet_enabled) then return jsonb_build_object('status','disabled','awarded',0);end if;
 start_value:=day_value::timestamp at time zone 'UTC';
 if not exists(select 1 from public.daily_checkins c where c.telegram_id=p_owner and c.id=p_source and((c.created_at>=greatest(start_value,cfg.luna4_cutover_at) and c.created_at<start_value+interval '24 hours') or exists(select 1 from public.luna4_checkin_calendar e where e.telegram_id=p_owner and e.source_id=c.id and e.utc_day=day_value and e.created_at>=greatest(start_value,cfg.luna4_cutover_at)))) then return jsonb_build_object('status','unverified','awarded',0);end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna21_wallet:'||p_owner::text,0));
 if exists(select 1 from public.luna_seed_ledger where telegram_id=p_owner and kind='checkin' and reward_day=day_value) then return jsonb_build_object('status','duplicate','awarded',0);end if;
 amount:=(cfg.catalog#>>'{rewards,dailyCheckin}')::integer;
 select count(*) into days from(
  select (c.created_at at time zone 'UTC')::date as day from public.daily_checkins c where c.telegram_id=p_owner and c.created_at>=greatest(start_value-interval '6 days',cfg.luna4_cutover_at) and c.created_at<start_value+interval '24 hours'
  union select e.utc_day from public.luna4_checkin_calendar e where e.telegram_id=p_owner and e.utc_day between day_value-6 and day_value and e.created_at>=cfg.luna4_cutover_at
 ) actual_days;
 if days=7 and not exists(select 1 from public.luna_seed_ledger where telegram_id=p_owner and kind='seven_days' and reward_day>day_value-7 and reward_day<=day_value) then bonus:=(cfg.catalog#>>'{rewards,sevenDayStreak}')::integer;end if;
 if amount+bonus=0 then return jsonb_build_object('status','no_reward','awarded',0);end if;
 insert into public.moon_gardens(telegram_id) values(p_owner) on conflict do nothing;
 select moon_seeds_available into strict balance_value from public.moon_gardens where telegram_id=p_owner for update;
 if amount>0 then insert into public.luna_seed_ledger(telegram_id,event_key,kind,delta,balance_after,reward_day) values(p_owner,'luna4:checkin:'||day_value::text,'checkin',amount,balance_value+amount,day_value);end if;
 if bonus>0 then insert into public.luna_seed_ledger(telegram_id,event_key,kind,delta,balance_after,reward_day) values(p_owner,'luna4:streak:'||day_value::text,'seven_days',bonus,balance_value+amount+bonus,day_value);end if;
 update public.moon_gardens set moon_seeds_available=balance_value+amount+bonus,moon_seeds_earned_total=moon_seeds_earned_total+amount+bonus,last_moon_seed_earned_at=now(),updated_at=now() where telegram_id=p_owner;
 return jsonb_build_object('status','awarded','awarded',amount,'bonus',bonus,'timezone','UTC','day',day_value);
end $$;
revoke all on function public.luna4_reward_checkin(bigint,uuid) from public,anon,authenticated;grant execute on function public.luna4_reward_checkin(bigint,uuid) to service_role;
notify pgrst,'reload schema';commit;
-- Rollback: disable new rewards. Keep actual UTC evidence and ledger entries;
-- do not replace server calendar proof with client local_date or reset rewards.
