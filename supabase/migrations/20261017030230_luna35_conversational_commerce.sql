-- Additive Luna-only persistence. Does not enable purchases, quotas or rewards.
-- Prerequisites: users, ai_conversations, ai_messages; Luna 3.4 catalog remains unchanged.
begin;
create table if not exists public.luna35_commerce_turns(
 telegram_id bigint not null references public.users(telegram_id) on delete cascade,
 request_id uuid not null, request_hash text not null check(request_hash ~ '^[a-f0-9]{64}$'),
 conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
 assistant_message_id uuid not null references public.ai_messages(id) on delete cascade,
 created_at timestamptz not null default now(), primary key(telegram_id,request_id)
);
create table if not exists public.luna35_pending_actions(
 id uuid primary key, telegram_id bigint not null references public.users(telegram_id) on delete cascade,
 conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
 action_type text not null check(action_type in('tarot','natal','compatibility')),
 parameters jsonb not null check(jsonb_typeof(parameters)='object' and octet_length(parameters::text)<=2000),
 language text not null check(language in('en','ru')),request_hash text not null check(request_hash ~ '^[a-f0-9]{64}$'),
 state text not null default 'pending' check(state in('pending','resuming','completed','expired')),
 lease uuid,lease_until timestamptz,result jsonb, created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '24 hours',
 completed_at timestamptz, check(expires_at>created_at)
);
create index if not exists luna35_pending_owner_recent on public.luna35_pending_actions(telegram_id,created_at desc);
create index if not exists luna35_commerce_conversation on public.luna35_commerce_turns(conversation_id);
create index if not exists luna35_commerce_message on public.luna35_commerce_turns(assistant_message_id);
create index if not exists luna35_pending_conversation on public.luna35_pending_actions(conversation_id);
alter table public.luna35_commerce_turns enable row level security;
alter table public.luna35_commerce_turns force row level security;
alter table public.luna35_pending_actions enable row level security;
alter table public.luna35_pending_actions force row level security;
revoke all on public.luna35_commerce_turns,public.luna35_pending_actions from public,anon,authenticated;
grant select,insert,update,delete on public.luna35_commerce_turns,public.luna35_pending_actions to service_role;

create or replace function public.luna35_save_commerce_turn(p_owner bigint,p_request uuid,p_hash text,p_conversation uuid,p_language text,p_text text,p_content text,p_card jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare t public.luna35_commerce_turns%rowtype;c uuid:=coalesce(p_conversation,gen_random_uuid());m public.ai_messages%rowtype;
begin
 if p_hash !~ '^[a-f0-9]{64}$' or p_request is null or p_language not in('en','ru') or length(p_text) not between 1 and 2000 or length(p_content) not between 1 and 4000 or octet_length(p_card::text)>16000 then raise exception 'Invalid commerce turn';end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna35-turn:'||p_owner::text||':'||p_request::text,0));
 select * into t from public.luna35_commerce_turns where telegram_id=p_owner and request_id=p_request;
 if found then
  if t.request_hash<>p_hash or(p_conversation is not null and t.conversation_id<>p_conversation) then raise exception 'Commerce request conflict';end if;
  select * into strict m from public.ai_messages where id=t.assistant_message_id and telegram_id=p_owner;
  return jsonb_build_object('conversationId',t.conversation_id,'message',to_jsonb(m),'duplicate',true);
 end if;
 if p_conversation is null then insert into public.ai_conversations(id,telegram_id,language,title) values(c,p_owner,p_language,case when p_language='ru' then 'Ваш доступ в Luna' else 'Your Luna access' end);end if;
 if not exists(select 1 from public.ai_conversations where id=c and telegram_id=p_owner and status='active') then raise exception 'Conversation not owned';end if;
 insert into public.ai_messages(conversation_id,telegram_id,request_id,role,content) values(c,p_owner,'commerce:'||p_request::text,'user',p_text);
 insert into public.ai_messages(conversation_id,telegram_id,request_id,role,content,metadata) values(c,p_owner,'commerce:'||p_request::text,'assistant',p_content,jsonb_build_object('commerce',p_card)) returning * into m;
 insert into public.luna35_commerce_turns(telegram_id,request_id,request_hash,conversation_id,assistant_message_id) values(p_owner,p_request,p_hash,c,m.id);
 update public.ai_conversations set last_message_at=now(),updated_at=now() where id=c and telegram_id=p_owner;
 return jsonb_build_object('conversationId',c,'message',to_jsonb(m),'duplicate',false);
end $$;

create or replace function public.luna35_save_pending_action(p_owner bigint,p_id uuid,p_conversation uuid,p_type text,p_parameters jsonb,p_language text,p_hash text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.luna35_pending_actions%rowtype;
begin
 if not exists(select 1 from public.ai_conversations where id=p_conversation and telegram_id=p_owner and status='active') then raise exception 'Conversation not owned';end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna35-action:'||p_id::text,0));
 select * into a from public.luna35_pending_actions where id=p_id;
 if found then if a.telegram_id<>p_owner or a.request_hash<>p_hash or a.conversation_id<>p_conversation then raise exception 'Action conflict';end if;
 else insert into public.luna35_pending_actions(id,telegram_id,conversation_id,action_type,parameters,language,request_hash) values(p_id,p_owner,p_conversation,p_type,p_parameters,p_language,p_hash) returning * into a;end if;
 return to_jsonb(a);
end $$;
create or replace function public.luna35_claim_pending_action(p_owner bigint,p_id uuid,p_lease uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.luna35_pending_actions%rowtype;
begin
 select * into a from public.luna35_pending_actions where telegram_id=p_owner and id=p_id for update;
 if not found then return jsonb_build_object('status','not_found');end if;
 if not exists(select 1 from public.ai_conversations where id=a.conversation_id and telegram_id=p_owner and status='active') then return jsonb_build_object('status','not_found');end if;
 if a.state='completed' then return jsonb_build_object('status','completed','action',to_jsonb(a));end if;
 if a.expires_at<=now() then update public.luna35_pending_actions set state='expired',lease=null,lease_until=null where id=a.id;return jsonb_build_object('status','expired');end if;
 if a.state='resuming' and a.lease_until>now() then return jsonb_build_object('status','busy');end if;
 if p_lease is null then raise exception 'Lease required';end if;
 update public.luna35_pending_actions set state='resuming',lease=p_lease,lease_until=now()+interval '90 seconds' where id=a.id returning * into a;
 return jsonb_build_object('status','claimed','action',to_jsonb(a));
end $$;
create or replace function public.luna35_finish_pending_action(p_owner bigint,p_id uuid,p_lease uuid,p_result jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.luna35_pending_actions where telegram_id=p_owner and id=p_id and state='resuming' and lease=p_lease) then return false;end if;
 if p_result is not null and(octet_length(p_result::text)>500 or jsonb_typeof(p_result)<>'object') then raise exception 'Invalid result reference';end if;
 if p_result is not null and not exists(select 1 from public.ai_messages m join public.luna35_pending_actions a on a.conversation_id=m.conversation_id where a.id=p_id and a.telegram_id=p_owner and m.telegram_id=p_owner and m.id=(p_result->>'messageId')::uuid and m.conversation_id=(p_result->>'conversationId')::uuid) then raise exception 'Owned saved result required';end if;
 update public.luna35_pending_actions set state=case when p_result is null then 'pending' else 'completed' end,result=p_result,completed_at=case when p_result is null then null else now() end,lease=null,lease_until=null
 where telegram_id=p_owner and id=p_id and state='resuming' and lease=p_lease;
 return found;
end $$;
revoke all on function public.luna35_save_commerce_turn(bigint,uuid,text,uuid,text,text,text,jsonb),public.luna35_save_pending_action(bigint,uuid,uuid,text,jsonb,text,text),public.luna35_claim_pending_action(bigint,uuid,uuid),public.luna35_finish_pending_action(bigint,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.luna35_save_commerce_turn(bigint,uuid,text,uuid,text,text,text,jsonb),public.luna35_save_pending_action(bigint,uuid,uuid,text,jsonb,text,text),public.luna35_claim_pending_action(bigint,uuid,uuid),public.luna35_finish_pending_action(bigint,uuid,uuid,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
-- Safe rollback: revert application callers; revoke service_role EXECUTE on the two
-- four new functions. Retain these two private tables to preserve saved actions/history.
-- No old table, price, entitlement, wallet balance or financial gate is modified.
