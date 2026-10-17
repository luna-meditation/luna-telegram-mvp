-- Luna 3.4: additive owner-bound progress only. No balance or entitlement writes.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
create table if not exists public.luna34_progress_settings(
 id boolean primary key default true check(id),enabled boolean not null default false,
 achievement_rewards_enabled boolean not null default false check(not achievement_rewards_enabled),
 created_at timestamptz not null default now()
);
insert into public.luna34_progress_settings(id) values(true) on conflict do nothing;
create table if not exists public.luna34_achievement_catalog(
 id text primary key check(id ~ '^[ATSRMGC][0-9]{2}$'),category text not null,metric text not null,target integer not null check(target>0),
 reward_seeds integer not null default 0 check(reward_seeds=0)
);
insert into public.luna34_achievement_catalog(id,category,metric,target) values
('A01','A','aiInteractions',1),
('A02','A','revealedCards',1),
('A03','A','threeReadings',1),
('A04','A','fiveReadings',1),
('A05','A','natalCharts',1),
('A06','A','reflections',1),
('A07','A','meditations',1),
('A08','A','breaths',1),
('T01','T','readings',3),
('T02','T','readings',10),
('T03','T','readings',25),
('T04','T','fiveReadings',5),
('T05','T','dailyCardDays',7),
('T06','T','uniqueCards',78),
('T07','T','discussedReadings',5),
('T08','T','cardDetails',10),
('S01','S','natalDetails',1),
('S02','S','placements',5),
('S03','S','aspects',5),
('S04','S','comparisons',1),
('S05','S','compatibilityThemes',3),
('S06','S','calendarDates',5),
('S07','S','pathExplorations',1),
('S08','S','astrologyAiDays',5),
('R01','R','reflections',3),
('R02','R','reflections',10),
('R03','R','reflections',30),
('R04','R','dreams',1),
('R05','R','dreams',5),
('R06','R','moodDays',7),
('R07','R','featureCategories',4),
('R08','R','reflectiveConversations',5),
('M01','M','meditations',5),
('M02','M','meditations',15),
('M03','M','meditations',30),
('M04','M','breaths',5),
('M05','M','breaths',15),
('M06','M','breathTechniques',3),
('M07','M','meditationMinutes',60),
('M08','M','combinedPracticeDays',5),
('G01','G','meaningfulDays',3),
('G02','G','meaningfulDays',7),
('G03','G','meaningfulDays',30),
('G04','G','gardenImprovements',1),
('G05','G','gardenImprovements',4),
('G06','G','gardenSeasonComplete',1),
('C01','C','qualifiedReferrals',1),
('C02','C','qualifiedReferrals',3),
('C03','C','qualifiedReferrals',5),
('C04','C','verifiedShares',1)
on conflict(id) do update set category=excluded.category,metric=excluded.metric,target=excluded.target;
create table if not exists public.luna34_progress_events(
 telegram_id bigint not null references public.users(telegram_id) on delete cascade,
 kind text not null check(kind in('reading_reveal','card_detail','natal_detail','placement','aspect','comparison','compatibility_theme','calendar_date','path_theme','share_export')),
 entity_id uuid not null,detail text not null default '' check(length(detail)<=100),
 created_at timestamptz not null default now(),primary key(telegram_id,kind,entity_id,detail)
);
create index if not exists luna34_progress_events_owner_kind on public.luna34_progress_events(telegram_id,kind,created_at);
create table if not exists public.luna34_progress_profiles(
 telegram_id bigint primary key references public.users(telegram_id) on delete cascade,initialized_at timestamptz not null default now()
);
-- Reuse the previously designed canonical breath proof table. Existing rows, if
-- any, retain their verification data. No rewards are granted by these objects.
create table if not exists public.luna_breath_proofs(
 id uuid primary key default gen_random_uuid(),telegram_id bigint not null references public.users(telegram_id) on delete cascade,
 mode text not null check(mode in('calm','box','478','coherent','triangle','sigh','anxiety_reset','sleep','morning_energy')),
 duration_seconds integer not null check(duration_seconds between 30 and 600),
 started_at timestamptz not null default now(),last_heartbeat_at timestamptz not null default now(),
 verified_seconds integer not null default 0 check(verified_seconds>=0),completed_at timestamptz
);
alter table public.luna_breath_proofs add column if not exists client_id uuid;
alter table public.luna_breath_proofs add column if not exists is_active boolean not null default true;
alter table public.luna_breath_proofs add column if not exists verified_milliseconds bigint not null default 0 check(verified_milliseconds>=0);
create unique index if not exists luna34_breath_client on public.luna_breath_proofs(telegram_id,client_id) where client_id is not null;
do $$declare t text;begin foreach t in array array['luna34_progress_settings','luna34_achievement_catalog','luna34_progress_events','luna34_progress_profiles','luna_breath_proofs'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('alter table public.%I force row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
 execute format('grant select,insert,update on public.%I to service_role',t);
end loop;end $$;

create or replace function public.luna34_progress_snapshot(p_owner bigint)
returns jsonb language sql stable security invoker set search_path='' as $$
with
 meditation as(
 select p.id,p.completed_at,p.listened_seconds,(p.completed_at at time zone 'UTC')::date as activity_day
 from public.playback_sessions p join public.meditations m on m.id=p.meditation_id
 where p.telegram_id=p_owner and p.completed_at is not null and m.duration>=60
 and p.listened_seconds>=ceil(m.duration*.9)
 and p.completed_at-p.started_at>=make_interval(secs=>ceil(m.duration*.9)::integer)
 ),
 breath as(
 select id,mode,(completed_at at time zone 'UTC')::date as activity_day from public.luna_breath_proofs
 where telegram_id=p_owner and completed_at is not null and verified_seconds>=duration_seconds*.9
 and completed_at-started_at>=make_interval(secs=>ceil(duration_seconds*.9)::integer)
 ),
 events as(select * from public.luna34_progress_events where telegram_id=p_owner),
 revealed as(
 select distinct r.* from public.luna_tarot_readings r
 where r.telegram_id=p_owner and r.status in('local','ready','fallback')
 and (
 r.status in('ready','fallback') or
 exists(select 1 from events e where e.kind='reading_reveal' and e.entity_id=r.id and e.detail='complete') or
 exists(select 1 from public.ai_messages m where m.telegram_id=p_owner and m.role='assistant'
 and m.metadata->'tarot'->>'readingId'=r.id::text
 and coalesce((m.metadata->'tarot'->>'revealed')::integer,0)>=case r.reading_kind when 'three' then 3 when 'five' then 5 else 1 end)
 )),
 cards as(
 select card_id from revealed where coalesce(reading_kind,'single') not in('three','five')
 union select c->>'cardId' from revealed r cross join lateral jsonb_array_elements(coalesce(r.cards,'[]'::jsonb)) c
 union select detail from events where kind='reading_reveal' and detail<>'complete'
 ),
 successful_ai as(
 select q.conversation_id,q.completed_at,m.metadata,(q.completed_at at time zone 'UTC')::date as activity_day
 from public.ai_chat_requests q join public.ai_messages m on m.id=q.assistant_message_id and m.telegram_id=q.telegram_id
 where q.telegram_id=p_owner and q.status='completed' and q.completed_at is not null
 and exists(select 1 from public.ai_usage u where u.telegram_id=p_owner and u.request_id=q.client_request_id and u.request_status in('completed','completed_runtime_action') and u.output_tokens>0)
 ),
 reflection as(
 select min(created_at) created_at,(created_at at time zone 'UTC')::date as activity_day from public.user_memories
 where telegram_id=p_owner and is_active and category='reflections' and confirmation_status='confirmed'
 and source_type in('user_entered','user_message','user_saved_ai_reflection') group by 2
 ),
 dreams as(select distinct (created_at at time zone 'UTC')::date as activity_day from public.luna32_dream_entries where telegram_id=p_owner),
 categories as(
 select 'meditation' category where exists(select 1 from meditation)
 union select 'breath' where exists(select 1 from breath)
 union select 'tarot' where exists(select 1 from revealed)
 union select 'astrology' where exists(select 1 from public.luna30_chart_cache where telegram_id=p_owner)
 union select 'reflection' where exists(select 1 from reflection)
 union select 'dream' where exists(select 1 from dreams)
 union select 'ai' where exists(select 1 from successful_ai)
 ),
 days as(
 select activity_day from meditation union select activity_day from breath
 union select (created_at at time zone 'UTC')::date from revealed
 union select activity_day from reflection union select activity_day from successful_ai union select activity_day from dreams
 ),
 garden as(select least(7,jsonb_array_length(coalesce(planted_garden_elements,'[]'::jsonb))) n from public.moon_gardens where telegram_id=p_owner)
select jsonb_build_object(
 'aiInteractions',(select count(*) from successful_ai),'revealedCards',(select count(*) from cards),
 'threeReadings',(select count(*) from revealed where reading_kind='three'),
 'fiveReadings',(select count(*) from revealed where reading_kind='five'),
 'natalCharts',(select count(distinct profile_id) from public.luna30_chart_cache where telegram_id=p_owner),
 'reflections',(select count(*) from reflection),'meditations',(select count(*) from meditation),'breaths',(select count(*) from breath),
 'readings',(select count(*) from revealed),'dailyCardDays',(select count(distinct (created_at at time zone 'UTC')::date) from revealed where reading_kind='daily'),
 'uniqueCards',(select count(*) from cards),
 'discussedReadings',(select count(distinct metadata->>'readingId') from successful_ai where metadata->>'readingId' in(select id::text from revealed)),
 'cardDetails',(select count(distinct detail) from events where kind='card_detail'),
 'natalDetails',(select count(*) from events where kind='natal_detail'),
 'placements',(select count(distinct detail) from events where kind='placement'),
 'aspects',(select count(distinct detail) from events where kind='aspect'),
 'comparisons',(select count(*) from events where kind='comparison'),
 'compatibilityThemes',(select count(distinct split_part(detail,':',2)) from events where kind='compatibility_theme'),
 'calendarDates',(select count(distinct detail) from events where kind='calendar_date'),
 'pathExplorations',(select count(*) from(select entity_id from events where kind='path_theme' group by entity_id having count(distinct detail)>=5)x),
 'astrologyAiDays',(select count(distinct activity_day) from successful_ai where metadata ? 'astrology'),
 'dreams',(select count(*) from dreams),
 'moodDays',(select count(distinct local_date) from public.daily_checkins where telegram_id=p_owner),
 'featureCategories',(select count(*) from categories),
 'reflectiveConversations',(select count(*) from(select conversation_id from successful_ai where coalesce(metadata->>'resolvedIntent','') in('general_chat','wellbeing','relationship','journal','emotional_support','dream') group by 1 having count(*)>=2)x),
 'breathTechniques',(select count(distinct mode) from breath),
 'meditationMinutes',(select floor(coalesce(sum(listened_seconds),0)/60) from meditation),
 'combinedPracticeDays',(select count(distinct m.activity_day) from meditation m join breath b using(activity_day)),
 'meaningfulDays',(select count(*) from days),
 'gardenImprovements',coalesce((select n from garden),0),
 'gardenSeasonComplete',case when coalesce((select n from garden),0)>=7 then 1 else 0 end,
 'qualifiedReferrals',(select count(*) from public.luna30_referrals where referrer_id=p_owner and state in('qualified','rewarded','limited') and qualified_at is not null),
 'verifiedShares',(select count(*) from events where kind='share_export')
);
$$;

create or replace function public.luna34_sync_achievements(p_owner bigint)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare metrics jsonb;first_sync boolean;definition record;v_current integer;v_unlocked boolean;v_previous public.achievements%rowtype;
begin
 if not exists(select 1 from public.luna34_progress_settings where id and enabled) then return jsonb_build_object('enabled',false);end if;
 if not exists(select 1 from public.users where telegram_id=p_owner) then raise exception 'Unknown owner';end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna34_progress:'||p_owner::text,0));
 insert into public.luna34_progress_profiles(telegram_id) values(p_owner) on conflict do nothing;first_sync:=found;
 metrics:=public.luna34_progress_snapshot(p_owner);
 for definition in select * from public.luna34_achievement_catalog order by id loop
  v_current:=greatest(0,coalesce((metrics->>definition.metric)::integer,0));
  select * into v_previous from public.achievements where telegram_id=p_owner and achievement_id=definition.id;
  v_unlocked:=v_current>=definition.target or v_previous.unlocked_at is not null;
  -- The legacy achievements table contains earned rows only (NOT NULL date).
  -- Locked progress is derived, not a fake unlock or a schema semantic change.
  if not v_unlocked then continue;end if;
  insert into public.achievements(telegram_id,achievement_id,progress,unlocked_at,metadata)
  values(p_owner,definition.id,case when v_unlocked then 100 else least(99,floor(v_current::numeric/definition.target*100))::integer end,
   case when v_unlocked then coalesce(v_previous.unlocked_at,now()) else null end,
   coalesce(v_previous.metadata,'{}'::jsonb)||jsonb_build_object('version',34,'source','verified_server_evidence','current',v_current,'target',definition.target,'backfilled',coalesce((v_previous.metadata->>'backfilled')::boolean,first_sync),
    'celebration_pending',case when first_sync then false when v_previous.unlocked_at is not null then coalesce((v_previous.metadata->>'celebration_pending')::boolean,false) else v_unlocked end))
  on conflict(telegram_id,achievement_id) do update set progress=excluded.progress,unlocked_at=excluded.unlocked_at,metadata=excluded.metadata;
 end loop;
 return jsonb_build_object('enabled',true,'metrics',metrics,'items',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'unlockedAt',a.unlocked_at,'progress',case when a.unlocked_at is not null then 100 else least(99,floor(greatest(0,coalesce((metrics->>c.metric)::numeric,0))/c.target*100))::integer end,'current',greatest(0,coalesce((metrics->>c.metric)::integer,0)),'target',c.target,'celebrationPending',coalesce((a.metadata->>'celebration_pending')::boolean,false)) order by c.id),'[]'::jsonb) from public.luna34_achievement_catalog c left join public.achievements a on a.achievement_id=c.id and a.telegram_id=p_owner));
end $$;
revoke all on function public.luna34_progress_snapshot(bigint),public.luna34_sync_achievements(bigint) from public,anon,authenticated;
grant execute on function public.luna34_progress_snapshot(bigint),public.luna34_sync_achievements(bigint) to service_role;

create or replace function public.luna34_acknowledge_achievements(p_owner bigint,p_ids text[])
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if p_ids is null or cardinality(p_ids) not between 1 and 50 or exists(select 1 from unnest(p_ids) x where x !~ '^[ATSRMGC][0-9]{2}$') then raise exception 'Invalid achievement acknowledgement';end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna34_progress:'||p_owner::text,0));
 update public.achievements set metadata=jsonb_set(metadata,'{celebration_pending}','false'::jsonb,true) where telegram_id=p_owner and achievement_id=any(p_ids) and unlocked_at is not null and metadata->>'version'='34';
 return true;
end $$;
revoke all on function public.luna34_acknowledge_achievements(bigint,text[]) from public,anon,authenticated;
grant execute on function public.luna34_acknowledge_achievements(bigint,text[]) to service_role;

create or replace function public.luna34_start_breath(p_owner bigint,p_client uuid,p_mode text,p_duration integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare b public.luna_breath_proofs%rowtype;
begin
 if p_client is null or p_mode not in('calm','box','478','coherent','triangle','sigh','anxiety_reset','sleep','morning_energy') or p_duration not in(60,180,300,600) then raise exception 'Invalid breathing session';end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna34_breath:'||p_owner::text,0));
 select * into b from public.luna_breath_proofs where telegram_id=p_owner and client_id=p_client;
 if found then
  if b.mode<>p_mode or b.duration_seconds<>p_duration then raise exception 'Breathing session conflict';end if;
 else
  -- Concurrent active sessions cannot multiply verified time or rewards.
  if exists(select 1 from public.luna_breath_proofs where telegram_id=p_owner and completed_at is null and is_active and last_heartbeat_at>now()-interval '20 seconds') then raise exception 'Breathing session already active';end if;
  insert into public.luna_breath_proofs(telegram_id,client_id,mode,duration_seconds) values(p_owner,p_client,p_mode,p_duration) returning * into b;
 end if;
 return jsonb_build_object('id',b.id,'verifiedSeconds',b.verified_seconds,'completed',b.completed_at is not null);
end $$;
create or replace function public.luna34_breath_heartbeat(p_owner bigint,p_session uuid,p_active boolean)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare b public.luna_breath_proofs%rowtype;elapsed_ms bigint;total_ms bigint;
begin
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna34_breath:'||p_owner::text,0));
 select * into strict b from public.luna_breath_proofs where telegram_id=p_owner and id=p_session for update;
 if b.completed_at is not null then return jsonb_build_object('verifiedSeconds',b.verified_seconds,'completed',true);end if;
 if p_active and exists(select 1 from public.luna_breath_proofs other where other.telegram_id=p_owner and other.id<>b.id and other.completed_at is null and other.is_active and other.last_heartbeat_at>now()-interval '20 seconds') then raise exception 'Another breathing session is active';end if;
 elapsed_ms:=case when b.is_active then least(15000,greatest(0,floor(1000*extract(epoch from now()-b.last_heartbeat_at))::bigint)) else 0 end;
 total_ms:=least(b.duration_seconds*1000,greatest(b.verified_milliseconds,b.verified_seconds*1000)+elapsed_ms);
 update public.luna_breath_proofs set verified_seconds=floor(total_ms/1000.0)::integer,verified_milliseconds=total_ms,last_heartbeat_at=now(),is_active=coalesce(p_active,false) where id=b.id returning * into b;
 return jsonb_build_object('verifiedSeconds',b.verified_seconds,'completed',false);
end $$;
create or replace function public.luna34_finish_breath(p_owner bigint,p_session uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare b public.luna_breath_proofs%rowtype;cycles integer;
begin
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna34_breath:'||p_owner::text,0));
 perform public.luna34_breath_heartbeat(p_owner,p_session,false);
 select * into strict b from public.luna_breath_proofs where telegram_id=p_owner and id=p_session for update;
 if b.completed_at is not null then return jsonb_build_object('completed',true,'newlyCompleted',false,'mode',b.mode,'duration_seconds',b.duration_seconds);end if;
 if b.verified_seconds<ceil(b.duration_seconds*.9) or now()-b.started_at<make_interval(secs=>ceil(b.duration_seconds*.9)::integer) then return jsonb_build_object('completed',false,'verifiedSeconds',b.verified_seconds);end if;
 cycles:=greatest(1,floor(b.duration_seconds/(case b.mode when 'box' then 16 when '478' then 19 when 'triangle' then 12 when 'anxiety_reset' then 12 when 'sleep' then 14 when 'morning_energy' then 12 else 10 end)::numeric)::integer);
 update public.luna_breath_proofs set completed_at=now(),is_active=false where id=b.id;
 insert into public.breath_sessions(id,telegram_id,mode,duration_seconds,breath_count) values(b.id,p_owner,b.mode,b.duration_seconds,cycles);
 -- Preserve the existing one-seed completion reward, atomically and once.
 -- The proposed +2/day economy and achievement rewards remain OFF.
 perform public.luna_mutate_garden(p_owner,'award',null,1,0);
 return jsonb_build_object('completed',true,'newlyCompleted',true,'mode',b.mode,'duration_seconds',b.duration_seconds,'breath_count',cycles);
end $$;
revoke all on function public.luna34_start_breath(bigint,uuid,text,integer),public.luna34_breath_heartbeat(bigint,uuid,boolean),public.luna34_finish_breath(bigint,uuid) from public,anon,authenticated;
grant execute on function public.luna34_start_breath(bigint,uuid,text,integer),public.luna34_breath_heartbeat(bigint,uuid,boolean),public.luna34_finish_breath(bigint,uuid) to service_role;
notify pgrst,'reload schema';
commit;
-- Rollback: UPDATE luna34_progress_settings SET enabled=false WHERE id;
-- keep canonical/legacy achievements and audit events. No balance restoration,
-- table deletion or mass progress reset is part of rollback.
