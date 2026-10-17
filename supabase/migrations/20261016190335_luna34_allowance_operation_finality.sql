-- Narrow additive correction. Already-applied migrations stay immutable.
-- No activation, financial backfill, balance update or new paid request.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';
create or replace function public.luna34_settle_allowance(p_owner bigint,p_request uuid,p_operation text,p_success boolean)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.luna30_usage_reservations%rowtype;
begin
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna34_allowance:'||p_owner::text,0));
 select * into r from public.luna30_usage_reservations where telegram_id=p_owner and request_id=p_request for update;
 if not found then return jsonb_build_object('status','not_found');end if;
 if r.request_hash<>encode(sha256(convert_to('luna34:'||p_owner::text||':'||p_operation,'UTF8')),'hex') then raise exception 'Operation identity mismatch';end if;
 if r.state<>'reserved' then return jsonb_build_object('status',r.state,'replay',true);end if;
 -- A stale/duplicate worker cannot refund a still-processing request.
 if not exists(select 1 from public.luna32_ai_operations o where o.telegram_id=p_owner and o.operation_key=p_operation and o.state=case when p_success then 'succeeded' else 'failed' end) then raise exception 'Final operation state required';end if;
 if p_success and not exists(select 1 from public.luna32_ai_attempts a where a.telegram_id=p_owner and a.operation_key=p_operation and a.provider_status='completed' and a.state='settled' and a.output_tokens>0 and a.actual_cost_microusd is not null) then raise exception 'Verified successful AI result required';end if;
 update public.luna30_usage_reservations set state=case when p_success then 'success' else 'failed' end,settled_at=now() where id=r.id;
 return jsonb_build_object('status',case when p_success then 'success' else 'failed' end,'replay',false);
end $$;
revoke all on function public.luna34_settle_allowance(bigint,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.luna34_settle_allowance(bigint,uuid,text,boolean) to service_role;
notify pgrst,'reload schema';commit;
-- Rollback: disable new quota env/database gates. Retain holds and cost records;
-- never release a processing/unknown hold or restore an old balance snapshot.
