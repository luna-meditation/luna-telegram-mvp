-- No answers, names, birth details, message text or arbitrary event properties.
-- Telegram IDs are private relational keys; Admin receives aggregates only.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
create table if not exists public.luna42_experience_events (
 id uuid primary key default gen_random_uuid(),
 telegram_id bigint not null references public.users(telegram_id) on delete cascade,
 event text not null check(event in ('onboarding_opened','step_opened','onboarding_left','step_completed','step_skipped','onboarding_completed','cosmos_opened','domain_opened','domain_updated','manual_edit','conversational_edit','memory_saved','memory_deleted','ai_navigation')),
 step text not null default '' check(step in ('','name','interests','priority','relationships','birth','style','consent','career','money','growth','wellbeing','social','lifestyle','dreams')),
 event_key uuid not null,
 source text not null check(source in ('client_observed','server_verified')),
 created_at timestamptz not null default now(),
 unique(telegram_id,event,step,event_key)
);
create index if not exists luna42_experience_time on public.luna42_experience_events(created_at,event);
create index if not exists luna42_experience_owner on public.luna42_experience_events(telegram_id,created_at);
alter table public.luna42_experience_events enable row level security;
alter table public.luna42_experience_events force row level security;
revoke all on public.luna42_experience_events from public,anon,authenticated;
grant select,insert,delete on public.luna42_experience_events to service_role;

create or replace function public.luna42_record_experience(p_owner bigint,p_event text,p_step text,p_key uuid,p_source text)
returns boolean language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 if p_owner is null or p_owner<=0 or p_key is null or p_step is null or p_source is null then raise exception 'invalid_experience_event' using errcode='22023';end if;
 if p_source='client_observed' and p_event<>all(array['onboarding_opened','step_opened','onboarding_left','cosmos_opened','domain_opened']) then raise exception 'unverified_experience_event' using errcode='22023';end if;
 -- Bound one authenticated owner's telemetry; this never reserves money/quota.
 perform 1 from public.users where telegram_id=p_owner for update;
 if not found then return false;end if;
 if exists(select 1 from public.luna42_experience_events where telegram_id=p_owner and event=p_event and step=p_step and event_key=p_key) then return true;end if;
 if (select count(*) from public.luna42_experience_events where telegram_id=p_owner and created_at>now()-interval '1 hour')>=120 then return false;end if;
 insert into public.luna42_experience_events(telegram_id,event,step,event_key,source) values(p_owner,p_event,p_step,p_key,p_source);
 return true;
end $$;

create or replace function public.luna42_experience_report(p_from timestamptz,p_to timestamptz)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare result jsonb;
begin
 if p_from is null or p_to is null or p_to<=p_from or p_to-p_from>interval '366 days' then raise exception 'invalid_report_period' using errcode='22023';end if;
 with starts as (
  select telegram_id,min(created_at) started,count(distinct event_key) opens from public.luna42_experience_events where event='onboarding_opened' group by telegram_id
 ), cohort as (
  select s.*, (select min(e.created_at) from public.luna42_experience_events e where e.telegram_id=s.telegram_id and e.event='onboarding_completed' and e.created_at>=s.started and e.created_at<least(p_to,now())) finished from starts s where s.started>=p_from and s.started<p_to
 ), summary as (
  select count(*) n,count(finished) completed,avg(extract(epoch from finished-started)) duration from cohort
 ), step_rows as (
  select x.step,count(distinct e.telegram_id) filter(where e.event='step_opened') opened,count(distinct e.telegram_id) filter(where e.event='step_skipped') skipped,
   count(distinct e.telegram_id) filter(where e.event='step_opened' and e.created_at<least(p_to,now())-interval '24 hours' and not exists(select 1 from public.luna42_experience_events d where d.telegram_id=e.telegram_id and d.step=e.step and d.event in ('step_completed','step_skipped') and d.created_at<least(p_to,now()))) inactive
  from unnest(array['name','interests','priority','relationships','birth','style','consent']) x(step) left join public.luna42_experience_events e on e.step=x.step and e.created_at>=p_from and e.created_at<p_to group by x.step
 )
 select jsonb_build_object('collectedSince',(select min(created_at) from public.luna42_experience_events),'from',p_from,'to',p_to,'generatedAt',now(),
  'cohortStarts',case when exists(select 1 from public.luna42_experience_events) then n end,
  'completed',case when n>0 then completed end,'completionRate',case when n>0 then completed::numeric/n end,'averageCompletionSeconds',duration,
  'resumedUsers',(select count(distinct e.telegram_id) from public.luna42_experience_events e join starts s using(telegram_id) where e.event='onboarding_opened' and e.created_at>s.started+interval '1 minute' and e.created_at>=p_from and e.created_at<p_to and not exists(select 1 from public.luna42_experience_events d where d.telegram_id=e.telegram_id and d.event='onboarding_completed' and d.created_at<e.created_at)),
  'birthProfileRate',case when n>0 then (select count(*)::numeric from cohort c where exists(select 1 from public.luna30_birth_profiles b where b.telegram_id=c.telegram_id and b.subject_kind='self'))/n end,
  'cosmosDomainRate',case when n>0 then (select count(*)::numeric from cohort c where exists(select 1 from public.user_memories m where m.telegram_id=c.telegram_id and m.is_active and m.confirmation_status='confirmed' and m.memory_key=any(array['cosmos_relationships','cosmos_career','cosmos_money','cosmos_growth','cosmos_wellbeing','cosmos_social','cosmos_lifestyle','cosmos_dreams']) and length(m.memory_value)>0))/n end,
  'returnedAfter24h',(select count(*) from cohort c where c.finished<=least(p_to,now())-interval '24 hours' and exists(select 1 from public.luna42_experience_events e where e.telegram_id=c.telegram_id and e.event='cosmos_opened' and e.created_at>=c.finished+interval '24 hours' and e.created_at<p_to)),
  'returnEligible',(select count(*) from cohort c where c.finished<=least(p_to,now())-interval '24 hours'),
  'aiAfterOnboarding',(select count(*) from cohort c where c.finished is not null and exists(select 1 from public.ai_messages a where a.telegram_id=c.telegram_id and a.role='user' and a.created_at>c.finished and a.created_at<p_to)),
  'steps',(select jsonb_agg(jsonb_build_object('step',step,'observedUsers',opened,'skippedUsers',skipped,'inactive24h',inactive,'dropOffRate',case when opened>0 then inactive::numeric/opened end)) from step_rows),
  'events',(select coalesce(jsonb_agg(v),'[]'::jsonb) from (select event,source,count(*) count from public.luna42_experience_events where created_at>=p_from and created_at<p_to group by event,source order by event,source)v),
  'definitions',jsonb_build_object('dropOff','Observed step with no saved/skip event for at least 24h; not inferred user intent.','return','Recorded My Cosmos return at least 24h after completion.','profiles','Current canonical data for the start cohort; not a historical snapshot.','history','No historical backfill; null denotes no recorded cohort.')) into result from summary;
 return result;
end $$;
revoke all on function public.luna42_record_experience(bigint,text,text,uuid,text),public.luna42_experience_report(timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.luna42_record_experience(bigint,text,text,uuid,text),public.luna42_experience_report(timestamptz,timestamptz) to service_role;
comment on table public.luna42_experience_events is 'Private, bounded Luna events without answers or arbitrary properties. Account removal cascades; admin aggregates only. No historical backfill.';
notify pgrst,'reload schema';
commit;
-- Safe quarantine rollback: stop analytics calls and revoke these two RPC grants.
-- Preserve records; do not reverse canonical profile, memory or financial data.
