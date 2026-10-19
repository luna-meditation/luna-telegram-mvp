-- A retry is not permission to reintroduce a deleted source or reuse an
-- operation ID for a different section/language. No historical chat is erased.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';
create unique index if not exists luna4_portrait_operation_once on public.ai_messages(telegram_id,(metadata#>>'{portraitDiscussion,operationId}'))
where metadata#>>'{portraitDiscussion,operationId}' is not null;
create or replace function public.luna4_open_portrait_discussion(p_owner bigint,p_message uuid,p_conversation uuid,p_operation uuid,p_epoch bigint,p_section text,p_language text,p_content text,p_sources jsonb) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare epoch bigint;existing public.ai_messages;
begin
 if p_message is null or p_conversation is null or p_operation is null or p_epoch is null or p_section is null or p_language is null or
 p_section not in('overview','essence','strengths','motivations','relationships','direction','growth','discoveries','astrology') or
 p_language not in('en','ru') or p_content is null or length(p_content) not between 10 and 1600 or
 p_sources is null or jsonb_typeof(p_sources)<>'array' or jsonb_array_length(p_sources)>3 then raise exception 'invalid_portrait_discussion' using errcode='22023';end if;
 perform public.luna4_portrait_epoch(p_owner);
 select source_epoch into strict epoch from public.luna4_portrait_state where telegram_id=p_owner for update;
 if epoch<>p_epoch then return jsonb_build_object('status','source_changed');end if;
 select * into existing from public.ai_messages where telegram_id=p_owner and metadata#>>'{portraitDiscussion,operationId}'=p_operation::text;
 if found then
  if existing.id<>p_message or existing.conversation_id<>p_conversation or existing.metadata#>>'{portraitDiscussion,section}' is distinct from p_section then raise exception 'operation_conflict' using errcode='23505';end if;
  if existing.metadata#>>'{portraitDiscussion,sourceEpoch}' is distinct from epoch::text then return jsonb_build_object('status','source_changed');end if;
  return jsonb_build_object('status','opened','conversationId',existing.conversation_id,'message',to_jsonb(existing),'cached',true);
 end if;
 insert into public.ai_conversations(id,telegram_id,title,language) values(p_conversation,p_owner,case when p_language='ru' then 'Мой космос — исследование' else 'Exploring my universe' end,p_language);
 insert into public.ai_messages(id,telegram_id,conversation_id,role,content,metadata)
 values(p_message,p_owner,p_conversation,'assistant',p_content,jsonb_build_object('contextReset',true,'portraitDiscussion',jsonb_build_object('version',1,'section',p_section,'sourceEpoch',epoch,'operationId',p_operation,'sources',p_sources))) returning * into existing;
 return jsonb_build_object('status','opened','conversationId',p_conversation,'message',to_jsonb(existing),'cached',false);
end $$;
revoke all on function public.luna4_open_portrait_discussion(bigint,uuid,uuid,uuid,bigint,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.luna4_open_portrait_discussion(bigint,uuid,uuid,uuid,bigint,text,text,text,jsonb) to service_role;
notify pgrst,'reload schema';commit;
-- Safe rollback: close the portrait Explore endpoint if required; do NOT
-- restore the stale replay implementation or remove source invalidation.
