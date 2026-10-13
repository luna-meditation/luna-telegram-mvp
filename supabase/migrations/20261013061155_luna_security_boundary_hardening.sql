-- Luna-owned objects only. This migration intentionally does not touch any
-- other tables, functions, grants, policies, or data in the shared project.
-- Prepared for review in Phase 1; do not apply without production approval.

do $$
begin
  if to_regclass('public.playback_sessions') is null then
    raise exception 'Required Luna relation public.playback_sessions does not exist';
  end if;
  if to_regprocedure('public.increment_meditation_play_count(uuid)') is null then
    raise exception 'Required Luna function public.increment_meditation_play_count(uuid) does not exist';
  end if;
  if to_regprocedure('public.reserve_luna_chat_request(bigint,text,integer,uuid)') is null then
    raise exception 'Required Luna function public.reserve_luna_chat_request(bigint,text,integer,uuid) does not exist';
  end if;
end
$$;

alter table public.playback_sessions enable row level security;

revoke all privileges on table public.playback_sessions from public, anon, authenticated, service_role;
grant select, insert, update on table public.playback_sessions to service_role;

drop policy if exists "Playback sessions are server managed" on public.playback_sessions;
create policy "Playback sessions are server managed"
  on public.playback_sessions
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

alter function public.increment_meditation_play_count(uuid)
  set search_path = '';
revoke all privileges on function public.increment_meditation_play_count(uuid) from public, anon, authenticated;
grant execute on function public.increment_meditation_play_count(uuid) to service_role;

alter function public.reserve_luna_chat_request(bigint, text, integer, uuid)
  set search_path = '';
revoke all privileges on function public.reserve_luna_chat_request(bigint, text, integer, uuid) from public, anon, authenticated;
grant execute on function public.reserve_luna_chat_request(bigint, text, integer, uuid) to service_role;

notify pgrst, 'reload schema';
