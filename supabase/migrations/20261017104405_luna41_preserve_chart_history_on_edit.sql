-- Only the Luna-owned edit trigger changes. Existing saved snapshots/reports
-- remain private and readable; new calculations use the new profile revision.
begin;
create or replace function public.luna30_invalidate_birth_calculations()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.telegram_id<>old.telegram_id or new.subject_kind<>old.subject_kind then
  raise exception 'Owner and subject kind cannot change';
 end if;
 if row(new.birth_date,new.birth_time,new.location) is distinct from row(old.birth_date,old.birth_time,old.location) then
  new.revision:=old.revision+1;
 end if;
 new.updated_at:=now();
 return new;
end $$;
revoke all on function public.luna30_invalidate_birth_calculations() from public,anon,authenticated;
grant execute on function public.luna30_invalidate_birth_calculations() to service_role;
commit;

-- Safe application rollback: retain this history-preserving trigger. Older
-- backends already include profile revision in cache keys, so remain compatible.
-- Do not restore the old DELETE-on-edit function: its next execution would
-- erase saved charts and cascade into reports. If a trigger issue is found,
-- temporarily disable profile editing in the app, preserve all saved rows and
-- fix forward. Explicit privacy deletion keeps its existing behavior.
