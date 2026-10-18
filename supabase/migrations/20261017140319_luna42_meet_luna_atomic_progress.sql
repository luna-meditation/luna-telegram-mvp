-- Dependency: Luna 4.1 Cosmos state, canonical personal profile and confirmed memory.
-- Answers remain in canonical stores. Metadata contains step IDs and a one-way
-- request fingerprint only. No birth details, money or entitlements are touched.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
alter table public.luna41_cosmos_onboarding add column if not exists meet_state jsonb not null default '{}'::jsonb;
create or replace function public.luna42_save_meet_step(p_owner bigint,p_request uuid,p_expected integer,p_step text,p_skip boolean,p_hash text,p_profile jsonb,p_memory jsonb)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare s public.luna41_cosmos_onboarding; m jsonb; v_done jsonb; v_skips jsonb; v_key text; v_category text; v_value text;
begin
 if p_owner is null or p_owner<=0 or p_request is null or p_expected is null or p_expected<0 or p_skip is null or p_step is null or p_hash is null or p_profile is null or p_memory is null or p_step<>all(array['name','interests','priority','relationships','birth','style','consent']) or p_hash!~'^[0-9a-f]{64}$' or jsonb_typeof(p_profile)<>'object' or jsonb_typeof(p_memory)<>'object' then raise exception 'invalid_meet_input' using errcode='22023'; end if;
 -- Serialize one owner's metadata and canonical writes, not the entire table.
 perform 1 from public.users where telegram_id=p_owner for update;
 if not found then raise exception 'meet_owner_unavailable' using errcode='P0002'; end if;
 select * into s from public.luna41_cosmos_onboarding where telegram_id=p_owner for update;
 if found and s.last_request_id=p_request then
  if s.meet_state->>'requestHash' is distinct from p_hash then raise exception 'meet_request_conflict' using errcode='23514'; end if;
  return jsonb_build_object('meet',s.meet_state,'revision',s.revision,'updatedAt',s.updated_at);
 end if;
 if coalesce(s.revision,0)<>p_expected then raise exception 'meet_changed' using errcode='40001'; end if;
 if p_profile - array['display_name','interests','ai_context_consent'] <> '{}'::jsonb or p_memory-array['key','category','value','sensitive']<>'{}'::jsonb then raise exception 'invalid_meet_patch' using errcode='22023'; end if;
 if p_skip and (p_profile<>'{}'::jsonb or p_memory<>'{}'::jsonb) then raise exception 'skip_has_no_answer' using errcode='22023'; end if;
 if p_profile ? 'ai_context_consent' and (p_step<>'consent' or jsonb_typeof(p_profile->'ai_context_consent')<>'boolean') then raise exception 'invalid_meet_consent' using errcode='22023'; end if;
 if not p_skip then
  insert into public.luna_personal_profiles(telegram_id) values(p_owner) on conflict(telegram_id) do nothing;
  if p_profile ? 'display_name' then
   if p_step<>'name' or jsonb_typeof(p_profile->'display_name')<>'string' or char_length(p_profile->>'display_name') not between 1 and 60 then raise exception 'invalid_meet_name' using errcode='22023'; end if;
   update public.luna_personal_profiles set display_name=p_profile->>'display_name' where telegram_id=p_owner;
  end if;
  if p_profile ? 'interests' then
   if p_step<>'interests' or jsonb_typeof(p_profile->'interests')<>'array' or jsonb_array_length(p_profile->'interests')>4 then raise exception 'invalid_meet_interests' using errcode='22023'; end if;
   update public.luna_personal_profiles set interests=array(select jsonb_array_elements_text(p_profile->'interests')) where telegram_id=p_owner;
  end if;
  if p_profile ? 'ai_context_consent' then
   update public.luna_personal_profiles set ai_context_consent=(p_profile->>'ai_context_consent')::boolean where telegram_id=p_owner;
   update public.users set ai_memory_enabled=(p_profile->>'ai_context_consent')::boolean where telegram_id=p_owner;
  end if;
  if p_memory<>'{}'::jsonb then
   v_key=p_memory->>'key';v_category=p_memory->>'category';v_value=p_memory->>'value';
   if v_key is null or v_key<>all(array['meet_interests','meet_priority','cosmos_relationships','communication_style']) or v_category is null or v_category<>all(array['interests','goals','life_context','preferences']) or v_value is null or char_length(v_value) not between 1 and 500 or jsonb_typeof(p_memory->'sensitive')<>'boolean' then raise exception 'invalid_meet_memory' using errcode='22023'; end if;
   insert into public.user_memories(telegram_id,category,memory_key,memory_value,confirmation_status,memory_kind,is_sensitive,source_type,confirmed_at,confidence,is_active,revision)
   values(p_owner,v_category,v_key,v_value,'confirmed','fact',(p_memory->>'sensitive')::boolean,'user_entered',now(),1,true,1)
   on conflict(telegram_id,category,memory_key) do update set memory_value=excluded.memory_value,confirmation_status='confirmed',memory_kind='fact',is_sensitive=excluded.is_sensitive,source_type='user_entered',source_conversation_id=null,source_message_id=null,confirmed_at=now(),confidence=1,is_active=true,revision=public.user_memories.revision+1,updated_at=now();
  end if;
  -- Invalidates an in-flight answer that used a superseded consent/context.
  update public.luna_personal_profiles set updated_at=clock_timestamp() where telegram_id=p_owner;
 end if;
 m=coalesce(s.meet_state,'{}'::jsonb);
 v_done=coalesce(m->'completed','[]'::jsonb)-p_step;v_skips=coalesce(m->'skipped','[]'::jsonb)-p_step;
 if p_skip then v_skips=v_skips||jsonb_build_array(p_step);else v_done=v_done||jsonb_build_array(p_step);end if;
 m=(m-array['completed','skipped','requestHash','finishedAt'])||jsonb_build_object('version',1,'completed',v_done,'skipped',v_skips,'requestHash',p_hash);
 if p_step='consent' and not p_skip then m=m||jsonb_build_object('consentVersion','luna42-meet-v1','consentedAt',now());end if;
 if jsonb_array_length(v_done)+jsonb_array_length(v_skips)=7 then m=m||jsonb_build_object('finishedAt',now());end if;
 insert into public.luna41_cosmos_onboarding(telegram_id,skipped,revision,last_request_id,updated_at,meet_state)
 values(p_owner,coalesce(s.skipped,'{}'),p_expected+1,p_request,now(),m)
 on conflict(telegram_id) do update set revision=excluded.revision,last_request_id=excluded.last_request_id,updated_at=excluded.updated_at,meet_state=excluded.meet_state;
 return jsonb_build_object('meet',m,'revision',p_expected+1,'updatedAt',now());
end $$;
revoke all on function public.luna42_save_meet_step(bigint,uuid,integer,text,boolean,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.luna42_save_meet_step(bigint,uuid,integer,text,boolean,text,jsonb,jsonb) to service_role;
comment on function public.luna42_save_meet_step(bigint,uuid,integer,text,boolean,text,jsonb,jsonb) is 'Telegram backend only. Atomic canonical answers and Meet Luna progress; no SECURITY DEFINER or financial changes.';
notify pgrst,'reload schema';
commit;
-- Safe rollback: disable Meet Luna entry points, preserve canonical user answers
-- and additive metadata. Revoke EXECUTE from service_role to quarantine this RPC;
-- reapply this migration to restore it. Never drop saved memories or profile fields.
