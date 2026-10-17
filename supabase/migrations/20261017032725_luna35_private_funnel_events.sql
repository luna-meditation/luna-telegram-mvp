-- Privacy-minimal Luna-only funnel. No message text, names, birth data or tokens.
begin;
create table if not exists public.luna35_funnel_events(
 telegram_id bigint not null references public.users(telegram_id) on delete cascade,
 event text not null check(event in('bot_welcome_sent','mini_app_launched','referral_link_opened','new_user_authenticated','onboarding_completed','first_tarot_completed','first_ai_response','first_astrology_profile','membership_viewed','purchase_initiated','purchase_completed')),
 event_key text not null check(event_key ~ '^[a-f0-9]{64}$'),
 source text not null check(source in('bot','app','verified')),
 created_at timestamptz not null default now(),primary key(telegram_id,event,event_key)
);
create index if not exists luna35_funnel_recent on public.luna35_funnel_events(created_at desc,event);
alter table public.luna35_funnel_events enable row level security;
alter table public.luna35_funnel_events force row level security;
revoke all on public.luna35_funnel_events from public,anon,authenticated;
grant select,insert,update,delete on public.luna35_funnel_events to service_role;
create or replace function public.luna35_funnel_stats(p_days integer default 30)
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('since',(now()-make_interval(days=>greatest(1,least(90,p_days)))),'groups',coalesce((select jsonb_agg(to_jsonb(s)) from(select event,source,count(*) events,count(distinct telegram_id) accounts from public.luna35_funnel_events where created_at>=now()-make_interval(days=>greatest(1,least(90,p_days))) group by event,source order by event,source)s),'[]'::jsonb),'note','Events recorded since Luna 3.5 only. Bot API acceptance is not a read receipt. Direct-link clicks are not independently observable. No private content is stored.')
$$;
revoke all on function public.luna35_funnel_stats(integer) from public,anon,authenticated;
grant execute on function public.luna35_funnel_stats(integer) to service_role;
notify pgrst,'reload schema';
commit;
-- Rollback: remove application callers and revoke service_role execution of
-- luna35_funnel_stats(integer). Retain private events; no old objects were altered.
