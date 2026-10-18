-- Dependencies: canonical user_memories confirmation columns (Luna 2.3),
-- luna_personal_profiles, owner-scoped ai_messages. No new data table.
-- Safe quarantine: disable FEATURE_COSMOS_V2 and revoke EXECUTE on this exact
-- RPC from service_role. Keep saved memories/history; never reverse user edits.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
create or replace function public.luna42_decide_memory_proposal(p_owner bigint,p_message uuid,p_proposal uuid,p_confirm boolean)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 m public.ai_messages%rowtype; old public.user_memories%rowtype;
 proposal jsonb; source uuid; target uuid; expected integer; topic text; cat text;
 current_boundary timestamptz; boundary timestamptz; result jsonb;
begin
 if p_owner is null or p_message is null or p_proposal is null or p_confirm is null then raise exception 'invalid decision' using errcode='23514'; end if;
 -- Serialize all proposals for this owner's canonical memory topics, including
 -- two different conversation messages proposing the same new topic.
 perform pg_advisory_xact_lock(hashtextextended('luna42-memory:'||p_owner::text,0));
 select * into m from public.ai_messages where id=p_message and telegram_id=p_owner and role='assistant' for update;
 if not found then raise exception 'proposal not found' using errcode='P0002'; end if;
 proposal=m.metadata->'memoryProposal';
 if proposal is null or proposal->>'version' is distinct from '1' or proposal->>'id' is distinct from p_proposal::text then raise exception 'proposal not found' using errcode='P0002'; end if;
 if proposal->>'state' in ('applied','cancelled') then
  if (proposal->>'state'='applied')<>p_confirm then raise exception 'decision already recorded' using errcode='23514'; end if;
  return proposal;
 end if;
 if proposal->>'state' is distinct from 'pending' or proposal->>'expiresAt' is null or (proposal->>'expiresAt')::timestamptz<clock_timestamp() then raise exception 'proposal expired' using errcode='23514'; end if;
 if not p_confirm then
  result=proposal||jsonb_build_object('state','cancelled','decidedAt',clock_timestamp());
  update public.ai_messages set metadata=jsonb_set(coalesce(metadata,'{}'::jsonb),'{memoryProposal}',result) where id=m.id and telegram_id=p_owner;
  return result;
 end if;
 source=(proposal->>'sourceMessageId')::uuid;
 if not exists(select 1 from public.ai_messages where id=source and telegram_id=p_owner and conversation_id=m.conversation_id and role='user') then raise exception 'source not found' using errcode='P0002'; end if;
 topic=proposal->>'key';cat=proposal->>'category';expected=(proposal->>'expectedRevision')::integer;target=(proposal->>'memoryId')::uuid;
 if topic is null or length(topic) not between 2 and 64 or topic~'[[:space:][:cntrl:]]' or topic in ('name','display_name','preferred_name','language','имя','обращение') or topic like 'birth_%' or cat is null or cat not in ('personal_facts','preferences','goals','interests','life_context','reflections') or expected is null or expected<0 or proposal->>'operation' is null or proposal->>'operation' not in ('save','delete') then raise exception 'invalid proposal' using errcode='23514'; end if;
 select updated_at into current_boundary from public.luna_personal_profiles where telegram_id=p_owner for update;
 boundary=(proposal->>'boundary')::timestamptz;
 if current_boundary is distinct from boundary then raise exception 'privacy context changed' using errcode='40001'; end if;
 if target is not null then
  select * into old from public.user_memories where id=target and telegram_id=p_owner and memory_key=topic and is_active for update;
  if not found or old.revision<>expected or old.memory_value is distinct from proposal->>'before' or old.is_sensitive then raise exception 'memory changed' using errcode='40001'; end if;
 elsif expected<>0 or proposal->>'before' is not null or exists(select 1 from public.user_memories where telegram_id=p_owner and memory_key=topic) then raise exception 'topic changed' using errcode='40001'; end if;
 if proposal->>'operation'='delete' then
  if target is null or proposal->>'after' is not null then raise exception 'invalid deletion' using errcode='23514'; end if;
  delete from public.user_memories where id=target and telegram_id=p_owner;
 else
  if proposal->>'after' is null or length(proposal->>'after') not between 2 and 500 then raise exception 'invalid memory' using errcode='23514'; end if;
  if target is null and (select count(*) from public.user_memories where telegram_id=p_owner and is_active)>=200 then raise exception 'memory limit' using errcode='23514'; end if;
  if target is null then
   insert into public.user_memories(telegram_id,category,memory_key,memory_value,confidence,confirmation_status,memory_kind,is_sensitive,source_type,source_message_id,source_conversation_id,confirmed_at)
   values(p_owner,cat,topic,proposal->>'after',1,'confirmed',case when cat='reflections' then 'symbolic' else 'fact' end,false,'user_message',source,m.conversation_id,clock_timestamp());
  else
   update public.user_memories set category=cat,memory_value=proposal->>'after',confidence=1,confirmation_status='confirmed',memory_kind=case when cat='reflections' then 'symbolic' else 'fact' end,is_sensitive=false,source_type='user_message',source_message_id=source,source_conversation_id=m.conversation_id,confirmed_at=clock_timestamp(),updated_at=clock_timestamp(),revision=revision+1 where id=target and telegram_id=p_owner;
  end if;
 end if;
 -- Invalidate in-flight AI and all pre-change transcript context atomically.
 insert into public.luna_personal_profiles(telegram_id,updated_at) values(p_owner,clock_timestamp()) on conflict(telegram_id) do update set updated_at=excluded.updated_at;
 result=proposal||jsonb_build_object('state','applied','decidedAt',clock_timestamp());
 update public.ai_messages set metadata=jsonb_set(coalesce(metadata,'{}'::jsonb),'{memoryProposal}',result) where id=m.id and telegram_id=p_owner;
 return result;
end;
$$;
revoke all on function public.luna42_decide_memory_proposal(bigint,uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.luna42_decide_memory_proposal(bigint,uuid,uuid,boolean) to service_role;
comment on function public.luna42_decide_memory_proposal(bigint,uuid,uuid,boolean) is 'Explicit owner confirmation only; atomic memory CAS, privacy cutoff and idempotent proposal decision. Never called by the model.';
notify pgrst,'reload schema';
commit;
