-- Read-only visibility for approved 4.3 products. No user/payment/balance writes.
-- Rollback: retain this compatible read improvement; close new checkout if needed.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';
create or replace function public.luna40_admin_overview(p_from timestamptz,p_to timestamptz)
 returns jsonb language plpgsql security invoker set search_path='' as $$
declare v jsonb;begin
 if p_from is null or p_to is null or p_to<=p_from or p_to-p_from>interval '366 days' then
  raise exception 'invalid_admin_period' using errcode='22023';end if;
 with days as(select point::date as day from pg_catalog.generate_series(p_from at time zone 'UTC',(p_to-interval '1 microsecond') at time zone 'UTC',interval '1 day') as source(point)),
 registrations as(select (created_at at time zone 'UTC')::date as day,count(*) n from public.users where created_at>=p_from and created_at<p_to group by 1),
 actions as(select (created_at at time zone 'UTC')::date as day,count(*) n,count(*) filter(where status='completed') success,count(*) filter(where status in ('failed_retryable','failed_non_retryable')) failed from public.ai_chat_requests where created_at>=p_from and created_at<p_to group by 1),
 paid_state as(select u.telegram_id,(u.lifetime_access or coalesce(p.period_end='infinity'::timestamptz,false)) lifetime,(u.active_until>now() or p.period_end>now()) fixed,(u.active_until is not null or p.period_end is not null) any_history from public.users u left join lateral(select max(e.period_end) period_end from public.luna30_entitlement_periods e where e.telegram_id=u.telegram_id and e.revoked_at is null and e.period_start<=now())p on true),
 revenue_rows as(select created_at,amount_stars stars from public.payments where status='paid' and currency='XTR' and created_at>=p_from and created_at<p_to union all select r.created_at,r.stars from public.luna30_commercial_receipts r where r.state='paid' and r.created_at>=p_from and r.created_at<p_to and not exists(select 1 from public.payments p where p.telegram_payment_charge_id=r.charge_id and p.status='paid' and p.currency='XTR')),
 revenues as(select (created_at at time zone 'UTC')::date as day,sum(stars) stars,count(*) n from revenue_rows group by 1),
 costs as(select (created_at at time zone 'UTC')::date as day,sum(actual_cost_microusd) microusd,count(*) filter(where actual_cost_microusd is null) unknown,count(*) calls from public.luna32_ai_attempts where created_at>=p_from and created_at<p_to group by 1),
 activity as(
 select telegram_id,created_at as event_at from public.ai_chat_requests where status='completed' and created_at>=p_to-interval '30 days' and created_at<p_to
 union all select telegram_id,started_at from public.playback_sessions where started_at>=p_to-interval '30 days' and started_at<p_to
 union all select telegram_id,completed_at from public.breath_sessions where completed_at>=p_to-interval '30 days' and completed_at<p_to
 union all select telegram_id,created_at from public.luna_tarot_readings where created_at>=p_to-interval '30 days' and created_at<p_to
 ),
 activity_days as(select (event_at at time zone 'UTC')::date as day,count(distinct telegram_id) n from activity group by 1),
 series as(select d.day,coalesce(r.n,0) registrations,coalesce(a.n,0) ai_requests,coalesce(a.success,0) ai_success,coalesce(a.failed,0) ai_failed,coalesce(v.stars,0) stars,c.microusd cost_microusd,coalesce(c.unknown,0) unknown_cost_calls,coalesce(c.calls,0) provider_calls,case when d.day>=(p_to-interval '30 days')::date then coalesce(ad.n,0) else null end tracked_active from days d left join registrations r using(day) left join actions a using(day) left join revenues v using(day) left join costs c using(day) left join activity_days ad using(day))
 select pg_catalog.jsonb_build_object(
  'timezone','UTC','from',p_from,'to',p_to,'generatedAt',now(),
  'users',pg_catalog.jsonb_build_object('total',(select count(*) from public.users),'registered',(select count(*) from public.users where created_at>=p_from and created_at<p_to),'lifetime',(select count(*) from paid_state where lifetime),'fixedTerm',(select count(*) from paid_state where not lifetime and coalesce(fixed,false)),'expired',(select count(*) from paid_state where not lifetime and any_history and not coalesce(fixed,false)),'active1d',(select count(distinct telegram_id) from activity where event_at>=p_to-interval '1 day'),'active7d',(select count(distinct telegram_id) from activity where event_at>=p_to-interval '7 days'),'active30d',(select count(distinct telegram_id) from activity)),
  'ai',pg_catalog.jsonb_build_object('requests',coalesce((select sum(n) from actions),0),'success',coalesce((select sum(success) from actions),0),'failed',coalesce((select sum(failed) from actions),0),'providerCalls',coalesce((select sum(calls) from costs),0),'costMicrousd',(select sum(microusd) from costs),'unknownCostCalls',coalesce((select sum(unknown) from costs),0)),
  'revenue',pg_catalog.jsonb_build_object('stars',coalesce((select sum(stars) from revenues),0),'purchases',coalesce((select sum(n) from revenues),0),'source','verified_legacy_and_commercial_receipts_deduplicated','settledUsd',null),
  'features',pg_catalog.jsonb_build_array(
   pg_catalog.jsonb_build_object('id','tarot','record','saved_readings','count',(select count(*) from public.luna_tarot_readings where created_at>=p_from and created_at<p_to)),
   pg_catalog.jsonb_build_object('id','meditations','record','completed_sessions','count',(select count(*) from public.playback_sessions where completed_at>=p_from and completed_at<p_to)),
   pg_catalog.jsonb_build_object('id','breathwork','record','completed_sessions','count',(select count(*) from public.breath_sessions where completed_at>=p_from and completed_at<p_to))),
  'series',coalesce((select pg_catalog.jsonb_agg(to_jsonb(series) order by day) from series),'[]'::jsonb),
  'coverage',pg_catalog.jsonb_build_object('activity','recorded_chat_playback_breathwork_saved_tarot','activeHistoryDays',30,'unmarkedHistoricalQaMayBeIncluded',true,'commercialReceiptsIncluded',true,'pageViewsAreNotCompletions',true),
  'budget',(select pg_catalog.jsonb_build_object('monthlyCapMicrousd',monthly_cap_microusd,'enabled',generation_enabled,'beta',public_beta,'betaExpiresAt',beta_expires_at) from public.luna32_runtime_settings where id)
 ) into v;
 return v;
end;$$;

create or replace function public.luna40_admin_users(p_search text default '',p_page integer default 1,p_size integer default 25,p_sort text default 'registered',p_plan text default 'all')
 returns jsonb language plpgsql security invoker set search_path='' as $$
declare v jsonb;begin
 if p_page is null or p_size is null or p_search is null or p_page<1 or p_page>100000 or p_size<1 or p_size>50 or char_length(p_search)>100 or p_sort is null or p_sort not in ('registered','seen','balance') or p_plan is null or p_plan not in ('all','free','active','lifetime','expired') then raise exception 'invalid_admin_filter' using errcode='22023';end if;
 with rows as(
 select u.id,u.telegram_id,u.username,u.first_name,u.last_name,u.avatar_url,u.created_at,u.last_seen_at,case when p.period_end='infinity'::timestamptz then null else greatest(u.active_until,p.period_end) end active_until,(u.lifetime_access or coalesce(p.period_end='infinity'::timestamptz,false)) lifetime_access,u.language_code,g.moon_seeds_available balance,
 case when u.lifetime_access or p.period_end='infinity'::timestamptz then 'lifetime' when greatest(u.active_until,p.period_end)>now() then 'active' when u.active_until is not null or p.period_end is not null then 'expired' else 'free' end plan
 from public.users u left join public.moon_gardens g using(telegram_id) left join lateral(select max(e.period_end) period_end from public.luna30_entitlement_periods e where e.telegram_id=u.telegram_id and e.revoked_at is null and e.period_start<=now())p on true
 where p_search='' or position(lower(p_search) in lower(coalesce(u.username,'')||' '||coalesce(u.first_name,'')||' '||coalesce(u.last_name,'')||' '||u.telegram_id::text||' '||u.id::text))>0
 ),filtered as(select * from rows where p_plan='all' or plan=p_plan),
 page as(select * from filtered order by case when p_sort='balance' then balance end desc nulls last,case when p_sort='seen' then last_seen_at end desc nulls last,created_at desc,telegram_id desc limit p_size offset (p_page-1)*p_size)
 select pg_catalog.jsonb_build_object('items',coalesce((select pg_catalog.jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb),'total',(select count(*) from filtered),'page',p_page,'pageSize',p_size) into v;return v;
end;$$;
revoke all on function public.luna40_admin_overview(timestamptz,timestamptz),public.luna40_admin_users(text,integer,integer,text,text) from public,anon,authenticated;
grant execute on function public.luna40_admin_overview(timestamptz,timestamptz),public.luna40_admin_users(text,integer,integer,text,text) to service_role;
notify pgrst,'reload schema';
commit;
