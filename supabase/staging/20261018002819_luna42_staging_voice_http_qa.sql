-- TEST INFRASTRUCTURE ONLY: funvzpmpbgazsisehiru. Never in production migrations.
-- Two fixed QA recordings use the remaining previously approved $0.03 STT
-- allowance ($0.000402 already used). The global application guard stays closed.
begin;
set local lock_timeout='5s';
create or replace function public.luna42_reserve_voice_qa(p_owner bigint,p_request uuid,p_hash text,p_language text,p_duration integer,p_grant uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare ledger public.luna30_qa_report_runs;prior public.luna42_voice_requests;v jsonb;
begin
 if p_owner is distinct from 158467796::bigint or p_request is null or p_grant is null or p_hash is null or p_hash!~'^[a-f0-9]{64}$' or p_language is null or p_language not in('en','ru') or p_duration is null or p_duration not between 250 and 45000 then return jsonb_build_object('status','denied');end if;
 select * into ledger from public.luna30_qa_report_runs where run_name='luna42-voice-http-20261018-v2' for update;
 v:=ledger.result;
 if v is null or v->>'grantId'<>p_grant::text or (v->>'qaOwner')::bigint<>p_owner then return jsonb_build_object('status','denied');end if;
 select * into prior from public.luna42_voice_requests where telegram_id=p_owner and request_id=p_request;
 if found then
  if prior.audio_hash<>p_hash or prior.language<>p_language or prior.duration_ms<>p_duration then return jsonb_build_object('status','conflict');end if;
  if prior.state='ready' and prior.expires_at>now() then return jsonb_build_object('status','cached','text',prior.transcript,'costMicrousd',prior.actual_cost_microusd);end if;
  return jsonb_build_object('status','in_progress');
 end if;
 if (v->>'expiresAt')::timestamptz<=now() or ledger.state not in('armed','running') or (v->>'providerCalls')::integer>=2 or (v->>'spentMicrousd')::bigint+(v->>'heldMicrousd')::bigint+20000>29598 then return jsonb_build_object('status','qa_budget');end if;
 insert into public.luna42_voice_requests(telegram_id,request_id,audio_hash,language,duration_ms,state)values(p_owner,p_request,p_hash,p_language,p_duration,'reserved');
 v:=jsonb_set(v,'{providerCalls}',to_jsonb((v->>'providerCalls')::int+1));v:=jsonb_set(v,'{heldMicrousd}',to_jsonb((v->>'heldMicrousd')::bigint+20000));
 v:=jsonb_set(v,'{requestIds}',coalesce(v->'requestIds','[]'::jsonb)||to_jsonb(p_request::text));
 update public.luna30_qa_report_runs set result=v where run_name=ledger.run_name;
 return jsonb_build_object('status','reserved');
end $$;
create or replace function public.luna42_settle_voice_qa(p_owner bigint,p_request uuid,p_text text,p_cost bigint,p_input integer,p_output integer,p_latency integer,p_grant uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
declare ledger public.luna30_qa_report_runs;prior public.luna42_voice_requests;v jsonb;
begin
 if p_owner is distinct from 158467796::bigint or p_grant is null or p_request is null or p_cost<0 or p_input<0 or p_output<0 or p_latency<0 or p_text is not null and char_length(p_text)>2000 or p_cost is not null and(p_input is null or p_output is null) then return false;end if;
 select * into ledger from public.luna30_qa_report_runs where run_name='luna42-voice-http-20261018-v2' for update;v:=ledger.result;
 if v is null or v->>'grantId'<>p_grant::text or (v->>'qaOwner')::bigint<>p_owner or not(v->'requestIds'?p_request::text) then return false;end if;
 select * into prior from public.luna42_voice_requests where telegram_id=p_owner and request_id=p_request and state='reserved' for update;if not found then return false;end if;
 update public.luna42_voice_requests set state=case when p_cost is null then 'unknown' when p_text is null or p_text='' then 'failed' else 'ready' end,transcript=p_text,actual_cost_microusd=p_cost,input_tokens=p_input,output_tokens=p_output,latency_ms=p_latency where telegram_id=p_owner and request_id=p_request;
 if p_cost is not null then v:=jsonb_set(v,'{heldMicrousd}',to_jsonb((v->>'heldMicrousd')::bigint-20000));v:=jsonb_set(v,'{spentMicrousd}',to_jsonb((v->>'spentMicrousd')::bigint+p_cost));end if;
 update public.luna30_qa_report_runs set result=v where run_name=ledger.run_name;return true;
end $$;
revoke all on function public.luna42_reserve_voice_qa(bigint,uuid,text,text,integer,uuid),public.luna42_settle_voice_qa(bigint,uuid,text,bigint,integer,integer,integer,uuid) from public,anon,authenticated;
grant execute on function public.luna42_reserve_voice_qa(bigint,uuid,text,text,integer,uuid),public.luna42_settle_voice_qa(bigint,uuid,text,bigint,integer,integer,integer,uuid) to service_role;
notify pgrst,'reload schema';
commit;
-- Quarantine: disable this run by state='closed' and unset the staging QA grant.
-- Preserve settled/unknown costs. No production/global configuration is changed.
