-- Additive correction: introductory replies are STANDARD CHAT only, including
-- during existing Public Beta. Historical unspecified Admin gifts retain scope.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';
create or replace function public.luna40_reserve_ai_attempt(p_owner bigint,p_operation text,p_lease uuid,p_call integer,p_attempt uuid,p_model text,p_ceiling bigint,p_limit integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare used integer;selected_grant uuid;held public.luna40_quota_uses%rowtype;result_value jsonb;
begin
 perform pg_advisory_xact_lock(3272001);
 if p_limit is null or p_limit not between 1 and 500 then raise exception 'Invalid base limit' using errcode='22023';end if;
 used:=public.luna32_ai_used(p_owner,p_operation);
 if used<p_limit then return public.luna32_reserve_ai_attempt(p_owner,p_operation,p_lease,p_call,p_attempt,p_model,p_ceiling,p_limit);end if;
 if used>=500 then return jsonb_build_object('status','daily_limit');end if;
 select * into held from public.luna40_quota_uses where telegram_id=p_owner and operation_key=p_operation;
 if found and held.state='held' and held.lease=p_lease and exists(select 1 from public.luna40_quota_grants g where g.id=held.grant_id and g.telegram_id=p_owner and ((g.purchase_id is null and g.source_key is null) or p_operation like 'chat:%')) then selected_grant:=held.grant_id;
 else
  select g.id into selected_grant from public.luna40_quota_grants g where g.telegram_id=p_owner and g.revoked_at is null and g.expires_at>now() and ((g.purchase_id is null and g.source_key is null) or p_operation like 'chat:%') and g.quantity>(select count(*) from public.luna40_quota_uses u where u.grant_id=g.id and u.state in('held','consumed')) order by g.expires_at,g.id limit 1 for update;
 end if;
 if selected_grant is null then return jsonb_build_object('status','daily_limit');end if;
 result_value:=public.luna32_reserve_ai_attempt(p_owner,p_operation,p_lease,p_call,p_attempt,p_model,p_ceiling,used+1);
 if result_value->>'status'='reserved' then
  insert into public.luna40_quota_uses(telegram_id,operation_key,grant_id,lease,state) values(p_owner,p_operation,selected_grant,p_lease,'held') on conflict(telegram_id,operation_key) do update set grant_id=excluded.grant_id,lease=excluded.lease,state='held';
 end if;return result_value;
end $$;
revoke all on function public.luna40_reserve_ai_attempt(bigint,text,uuid,integer,uuid,text,bigint,integer) from public,anon,authenticated;
grant execute on function public.luna40_reserve_ai_attempt(bigint,text,uuid,integer,uuid,text,bigint,integer) to service_role;
notify pgrst,'reload schema';commit;
-- Rollback: pause new welcome grants/rewards, retain this narrow scope fence.
-- Do not turn introductory messages into Tarot/paid-report entitlements.
