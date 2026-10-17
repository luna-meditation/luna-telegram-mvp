-- Private Luna telemetry; no prompts, questions, birth data or money.
-- Rollback: previous code ignores these additive objects; retain records.
begin;
create table if not exists public.luna40_tool_executions (
 telegram_id bigint not null references public.users(telegram_id) on delete cascade,
 operation_id uuid not null,
 message_id uuid not null references public.ai_messages(id) on delete cascade,
 tool_name text not null check(tool_name ~ '^[a-z_]{3,60}$'),
 status text not null check(status in ('completed','requires_selection','failed')),
 ui_state text not null check(ui_state in ('not_requested','selection_required','navigation_requested')),
 latency_ms integer not null check(latency_ms between 0 and 600000),
 error_code text check(error_code ~ '^[a-z_]{3,80}$'),
 created_at timestamptz not null default now(),
 primary key(telegram_id,operation_id)
);
create index if not exists luna40_tool_executions_created on public.luna40_tool_executions(created_at,tool_name);
create table if not exists public.luna40_ui_acknowledgements (
 telegram_id bigint not null references public.users(telegram_id) on delete cascade,
 message_id uuid not null references public.ai_messages(id) on delete cascade,
 event text not null check(event in ('meditation_card_rendered','player_opened','playback_started')),
 reference_id uuid not null,
 observed_at timestamptz not null default now(),
 primary key(telegram_id,message_id,event)
);
create index if not exists luna40_ui_acknowledgements_observed on public.luna40_ui_acknowledgements(observed_at,event);
alter table public.luna40_tool_executions enable row level security;
alter table public.luna40_tool_executions force row level security;
alter table public.luna40_ui_acknowledgements enable row level security;
alter table public.luna40_ui_acknowledgements force row level security;
revoke all on public.luna40_tool_executions,public.luna40_ui_acknowledgements from public,anon,authenticated;
grant select,insert on public.luna40_tool_executions,public.luna40_ui_acknowledgements to service_role;
create or replace function public.luna40_acknowledge_ui(p_owner bigint,p_message uuid,p_event text,p_reference uuid)
 returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if p_event is null or p_event not in ('meditation_card_rendered','player_opened','playback_started') then
  raise exception 'invalid_action_ack' using errcode='22023';
 end if;
 if not exists(select 1 from public.ai_messages where id=p_message and telegram_id=p_owner
   and role='assistant' and metadata#>>'{meditationAction,meditationId}'=p_reference::text) then return false;end if;
 insert into public.luna40_ui_acknowledgements(telegram_id,message_id,event,reference_id)
  values(p_owner,p_message,p_event,p_reference) on conflict do nothing;
 return true;
end;$$;
revoke all on function public.luna40_acknowledge_ui(bigint,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.luna40_acknowledge_ui(bigint,uuid,text,uuid) to service_role;
notify pgrst,'reload schema';
commit;
