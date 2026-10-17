-- Explicit private bookmarks only. Refer to existing owned artifacts; do not
-- copy interpretations or trigger calculations/AI. User removal deletes only
-- the bookmark, not history. Dependencies are existing Luna 2.x/3.x tables.
-- Quarantine: hide the UI and revoke the two new RPCs; retain bookmarks.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';
create table if not exists public.luna42_discoveries(
 id uuid primary key default gen_random_uuid(),telegram_id bigint not null references public.users(telegram_id) on delete cascade,
 kind text not null check(kind in ('tarot','astrology','reflection')),reference_id uuid not null,
 title text not null check(length(btrim(title)) between 2 and 100),revision integer not null default 1 check(revision>0),
 last_request_id uuid not null,last_request_hash text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(telegram_id,kind,reference_id)
);
create index if not exists luna42_discoveries_owner_updated on public.luna42_discoveries(telegram_id,updated_at desc);
alter table public.luna42_discoveries enable row level security;
alter table public.luna42_discoveries force row level security;
revoke all on public.luna42_discoveries from public,anon,authenticated;
grant select,insert,update,delete on public.luna42_discoveries to service_role;
create or replace function public.luna42_save_discovery(p_owner bigint,p_request uuid,p_kind text,p_reference uuid,p_title text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare saved public.luna42_discoveries%rowtype;
begin
 if p_owner is null or p_request is null or p_reference is null or p_kind is null or p_kind not in ('tarot','astrology','reflection') or p_title is null or length(btrim(p_title)) not between 2 and 100 then raise exception 'invalid bookmark' using errcode='23514';end if;
 perform pg_advisory_xact_lock(hashtextextended('luna42-discoveries:'||p_owner::text,0));
 if p_kind='tarot' then
  if not exists(select 1 from public.luna_tarot_readings where telegram_id=p_owner and id=p_reference) then raise exception 'source not found' using errcode='P0002';end if;
 elsif p_kind='astrology' then
  if not exists(select 1 from public.ai_messages where telegram_id=p_owner and id=p_reference and role='assistant' and metadata->'astrologyWorkflow'->>'state'='ready') then raise exception 'source not found' using errcode='P0002';end if;
 else
  if not exists(select 1 from public.user_memories where telegram_id=p_owner and id=p_reference and category='reflections' and memory_kind='symbolic' and is_active) then raise exception 'source not found' using errcode='P0002';end if;
 end if;
 select * into saved from public.luna42_discoveries where telegram_id=p_owner and kind=p_kind and reference_id=p_reference;
 if found then return to_jsonb(saved)-'telegram_id'-'last_request_id'-'last_request_hash';end if;
 if (select count(*) from public.luna42_discoveries where telegram_id=p_owner)>=200 then raise exception 'bookmark limit' using errcode='23514';end if;
 insert into public.luna42_discoveries(telegram_id,kind,reference_id,title,last_request_id) values(p_owner,p_kind,p_reference,btrim(p_title),p_request) returning * into saved;
 return to_jsonb(saved)-'telegram_id'-'last_request_id'-'last_request_hash';
end;$$;
create or replace function public.luna42_rename_discovery(p_owner bigint,p_id uuid,p_request uuid,p_title text,p_expected integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare saved public.luna42_discoveries%rowtype;
begin
 if p_request is null or p_title is null or length(btrim(p_title)) not between 2 and 100 or p_expected is null or p_expected<1 then raise exception 'invalid title' using errcode='23514';end if;
 select * into saved from public.luna42_discoveries where id=p_id and telegram_id=p_owner for update;
 if not found then raise exception 'bookmark not found' using errcode='P0002';end if;
 if saved.last_request_id=p_request then
  if saved.last_request_hash is distinct from p_title||':'||p_expected::text then raise exception 'request conflict' using errcode='23514';end if;
  return to_jsonb(saved)-'telegram_id'-'last_request_id'-'last_request_hash';
 end if;
 if saved.revision<>p_expected then raise exception 'bookmark changed' using errcode='40001';end if;
 update public.luna42_discoveries set title=btrim(p_title),revision=revision+1,last_request_id=p_request,last_request_hash=p_title||':'||p_expected::text,updated_at=clock_timestamp() where id=p_id and telegram_id=p_owner returning * into saved;
 return to_jsonb(saved)-'telegram_id'-'last_request_id'-'last_request_hash';
end;$$;
revoke all on function public.luna42_save_discovery(bigint,uuid,text,uuid,text),public.luna42_rename_discovery(bigint,uuid,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.luna42_save_discovery(bigint,uuid,text,uuid,text),public.luna42_rename_discovery(bigint,uuid,uuid,text,integer) to service_role;
notify pgrst,'reload schema';commit;
