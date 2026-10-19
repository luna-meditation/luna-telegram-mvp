-- Additive personal projection, not a second source of user memory.
-- No financial/catalog/payment objects are changed. Existing source data stay intact.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

create table if not exists public.luna4_portrait_state (
 telegram_id bigint primary key references public.users(telegram_id) on delete cascade,
 source_epoch bigint not null default 1 check(source_epoch>0),
 next_revision bigint not null default 1 check(next_revision>0),
 updated_at timestamptz not null default now()
);
create table if not exists public.luna4_portrait_snapshots (
 telegram_id bigint not null references public.users(telegram_id) on delete cascade,
 revision bigint not null check(revision>0),
 source_epoch bigint not null check(source_epoch>0),
 source_digest text not null check(source_digest ~ '^[a-f0-9]{64}$'),
 as_of date not null,
 document jsonb not null check(jsonb_typeof(document)='object' and octet_length(document::text)<=131072),
 created_at timestamptz not null default now(),
 primary key(telegram_id,revision),
 unique(telegram_id,source_epoch,source_digest,as_of)
);
alter table public.luna4_portrait_state enable row level security;
alter table public.luna4_portrait_state force row level security;
alter table public.luna4_portrait_snapshots enable row level security;
alter table public.luna4_portrait_snapshots force row level security;
revoke all on public.luna4_portrait_state,public.luna4_portrait_snapshots from public,anon,authenticated;
grant select,insert,update,delete on public.luna4_portrait_state,public.luna4_portrait_snapshots to service_role;

create or replace function public.luna4_portrait_epoch(p_owner bigint) returns bigint
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare epoch bigint;
begin
 if p_owner is null or p_owner<=0 then raise exception 'owner_required' using errcode='22023'; end if;
 insert into public.luna4_portrait_state(telegram_id) values(p_owner) on conflict do nothing;
 select source_epoch into strict epoch from public.luna4_portrait_state where telegram_id=p_owner;
 return epoch;
end $$;

create or replace function public.luna4_save_portrait_snapshot(p_owner bigint,p_epoch bigint,p_digest text,p_day date,p_document jsonb) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare state public.luna4_portrait_state; saved public.luna4_portrait_snapshots;
begin
 if p_digest is null or p_digest !~ '^[a-f0-9]{64}$' or p_day is null or p_document is null or
 jsonb_typeof(p_document)<>'object' or p_document->>'version' is distinct from '1' or octet_length(p_document::text)>131072
 then raise exception 'invalid_portrait' using errcode='22023'; end if;
 perform public.luna4_portrait_epoch(p_owner);
 select * into strict state from public.luna4_portrait_state where telegram_id=p_owner for update;
 if state.source_epoch<>p_epoch then return jsonb_build_object('status','source_changed'); end if;
 select * into saved from public.luna4_portrait_snapshots where telegram_id=p_owner and source_epoch=p_epoch and source_digest=p_digest and as_of=p_day;
 if found then return jsonb_build_object('status','saved','cached',true,'revision',saved.revision,'createdAt',saved.created_at); end if;
 insert into public.luna4_portrait_snapshots(telegram_id,revision,source_epoch,source_digest,as_of,document)
 values(p_owner,state.next_revision,p_epoch,p_digest,p_day,p_document) returning * into saved;
 update public.luna4_portrait_state set next_revision=next_revision+1,updated_at=now() where telegram_id=p_owner;
 -- Bounded projections; the original memory/profile remains the source of truth.
 delete from public.luna4_portrait_snapshots where telegram_id=p_owner and revision<=saved.revision-30;
 return jsonb_build_object('status','saved','cached',false,'revision',saved.revision,'createdAt',saved.created_at);
end $$;

create or replace function public.luna4_invalidate_portrait() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare owner bigint;
begin
 -- Stable ordering also handles an administrative owner correction safely.
 for owner in select distinct value from unnest(array[
  case when TG_OP<>'DELETE' then (to_jsonb(NEW)->>'telegram_id')::bigint end,
  case when TG_OP<>'INSERT' then (to_jsonb(OLD)->>'telegram_id')::bigint end]) value where value is not null order by value
 loop
  -- No state yet means no retained projection to invalidate. Never create
  -- replacement user rows during cascade deletion.
  update public.luna4_portrait_state set source_epoch=source_epoch+1,updated_at=now() where telegram_id=owner;
  delete from public.luna4_portrait_snapshots where telegram_id=owner;
 end loop;
 return null;
end $$;

do $$ declare name text; begin
 foreach name in array array['user_memories','luna_personal_profiles','luna30_birth_profiles','luna30_chart_cache'] loop
  if to_regclass('public.'||name) is null then raise exception 'missing_dependency: %',name; end if;
  execute format('drop trigger if exists luna4_portrait_invalidation on public.%I',name);
  execute format('create trigger luna4_portrait_invalidation after insert or update or delete on public.%I for each row execute function public.luna4_invalidate_portrait()',name);
 end loop;
end $$;
-- Only the consent flag affects this projection; last_seen/profile activity
-- must not churn the portrait or write on every login.
drop trigger if exists luna4_portrait_consent_invalidation on public.users;
create trigger luna4_portrait_consent_invalidation after update of ai_memory_enabled on public.users
for each row when(old.ai_memory_enabled is distinct from new.ai_memory_enabled)
execute function public.luna4_invalidate_portrait();

create or replace function public.luna4_open_portrait_discussion(p_owner bigint,p_message uuid,p_conversation uuid,p_operation uuid,p_epoch bigint,p_section text,p_language text,p_content text,p_sources jsonb) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare epoch bigint; existing public.ai_messages;
begin
 if p_message is null or p_conversation is null or p_operation is null or p_epoch is null or p_section is null or p_language is null or
 p_section not in ('overview','essence','strengths','motivations','relationships','direction','growth','discoveries','astrology') or
 p_language not in ('en','ru') or p_content is null or length(p_content) not between 10 and 1600 or
 p_sources is null or jsonb_typeof(p_sources)<>'array' or jsonb_array_length(p_sources)>3 then
  raise exception 'invalid_portrait_discussion' using errcode='22023';
 end if;
 perform public.luna4_portrait_epoch(p_owner);
 select source_epoch into strict epoch from public.luna4_portrait_state where telegram_id=p_owner for update;
 select * into existing from public.ai_messages where id=p_message and telegram_id=p_owner;
 if found then
  if existing.metadata#>>'{portraitDiscussion,operationId}' is distinct from p_operation::text then raise exception 'operation_conflict' using errcode='22023'; end if;
  return jsonb_build_object('status','opened','conversationId',existing.conversation_id,'message',to_jsonb(existing),'cached',true);
 end if;
 if epoch<>p_epoch then return jsonb_build_object('status','source_changed'); end if;
 insert into public.ai_conversations(id,telegram_id,title,language)
 values(p_conversation,p_owner,case when p_language='ru' then 'Мой космос — исследование' else 'Exploring my universe' end,p_language);
 insert into public.ai_messages(id,telegram_id,conversation_id,role,content,metadata)
 values(p_message,p_owner,p_conversation,'assistant',p_content,jsonb_build_object('contextReset',true,'portraitDiscussion',jsonb_build_object('version',1,'section',p_section,'sourceEpoch',epoch,'operationId',p_operation,'sources',p_sources))) returning * into existing;
 return jsonb_build_object('status','opened','conversationId',p_conversation,'message',to_jsonb(existing),'cached',false);
end $$;

revoke all on function public.luna4_portrait_epoch(bigint),public.luna4_save_portrait_snapshot(bigint,bigint,text,date,jsonb),public.luna4_invalidate_portrait(),public.luna4_open_portrait_discussion(bigint,uuid,uuid,uuid,bigint,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.luna4_portrait_epoch(bigint),public.luna4_save_portrait_snapshot(bigint,bigint,text,date,jsonb),public.luna4_invalidate_portrait(),public.luna4_open_portrait_discussion(bigint,uuid,uuid,uuid,bigint,text,text,text,jsonb) to service_role;
comment on table public.luna4_portrait_snapshots is 'Private bounded deterministic projection. All retained snapshots are purged when a source is corrected/deleted or consent changes. No model invocation or wallet mutation.';
notify pgrst,'reload schema';
commit;
