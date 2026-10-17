-- Additive Luna-only setting. No existing users/payment/wallet objects changed.
-- Rollback: deploy previous backend/frontend, retain this table for user choices.
-- If necessary revoke EXECUTE on the new function from service_role; do not drop data.
begin;
create table if not exists public.luna40_language_preferences (
  telegram_id bigint primary key references public.users(telegram_id) on delete cascade,
  mode text not null check (mode in ('auto','en','ru')),
  revision bigint not null default 1 check (revision between 1 and 9007199254740991),
  request_id uuid not null,
  updated_at timestamptz not null default now()
);
alter table public.luna40_language_preferences enable row level security;
alter table public.luna40_language_preferences force row level security;
revoke all on public.luna40_language_preferences from public,anon,authenticated;
grant select,insert,update on public.luna40_language_preferences to service_role;

create or replace function public.luna40_set_language_preference(
  p_owner bigint,p_mode text,p_expected_revision bigint,p_request uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v public.luna40_language_preferences;begin
  if p_owner is null or p_owner<=0 or p_mode is null or p_mode not in ('auto','en','ru')
    or p_expected_revision is null or p_expected_revision<0 or p_request is null then
    raise exception 'invalid_language_preference' using errcode='22023';
  end if;
  -- Serializes initial inserts as well as updates. This namespace is Luna-only.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('luna40:language:'||p_owner::text,0));
  select * into v from public.luna40_language_preferences where telegram_id=p_owner for update;
  if found and v.request_id=p_request then
    if v.mode<>p_mode then raise exception 'language_request_conflict' using errcode='22023';end if;
    return pg_catalog.jsonb_build_object('mode',v.mode,'revision',v.revision,'updatedAt',v.updated_at,'conflict',false);
  end if;
  if coalesce(v.revision,0)<>p_expected_revision then
    return pg_catalog.jsonb_build_object('mode',coalesce(v.mode,'auto'),'revision',coalesce(v.revision,0),'updatedAt',v.updated_at,'conflict',true);
  end if;
  insert into public.luna40_language_preferences(telegram_id,mode,revision,request_id)
    values(p_owner,p_mode,1,p_request)
    on conflict(telegram_id) do update set mode=excluded.mode,
      revision=luna40_language_preferences.revision+1,request_id=excluded.request_id,updated_at=now()
    returning * into v;
  return pg_catalog.jsonb_build_object('mode',v.mode,'revision',v.revision,'updatedAt',v.updated_at,'conflict',false);
end;$$;
revoke all on function public.luna40_set_language_preference(bigint,text,bigint,uuid) from public,anon,authenticated;
grant execute on function public.luna40_set_language_preference(bigint,text,bigint,uuid) to service_role;
notify pgrst,'reload schema';
commit;
