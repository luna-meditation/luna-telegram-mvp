-- Client observations are telemetry, never proof of authorization, rewards or payment.
-- Requires 20261017052134_luna40_action_observability.sql. No user rows change.
-- Rollback: disable the new client acknowledgement first; retain telemetry and
-- this compatible constraint. Old clients/RPC continue to work unchanged.
begin;
alter table public.luna40_ui_acknowledgements drop constraint if exists luna40_ui_acknowledgements_event_check;
alter table public.luna40_ui_acknowledgements add constraint luna40_ui_acknowledgements_event_check
 check(event in ('meditation_card_rendered','player_opened','playback_started','screen_opened'));
create or replace function public.luna41_acknowledge_navigation(p_owner bigint,p_message uuid,p_operation uuid,p_destination text)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if p_destination is null or length(p_destination)>30 or p_destination!~'^[a-z_]+$' then
  raise exception 'invalid_destination_ack' using errcode='22023';
 end if;
 if not exists(select 1 from public.ai_messages m
   join public.luna40_tool_executions t on t.message_id=m.id and t.telegram_id=m.telegram_id
   where m.id=p_message and m.telegram_id=p_owner and m.role='assistant'
   and m.metadata#>>'{navigation,destination}'=p_destination
   and m.metadata#>>'{navigation,operationId}'=p_operation::text
   and t.operation_id=p_operation and t.tool_name='navigate_app'
   and t.status='completed' and t.ui_state='navigation_requested') then return false;end if;
 insert into public.luna40_ui_acknowledgements(telegram_id,message_id,event,reference_id)
 values(p_owner,p_message,'screen_opened',p_operation) on conflict do nothing;
 return true;
end;$$;
revoke all on function public.luna41_acknowledge_navigation(bigint,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.luna41_acknowledge_navigation(bigint,uuid,uuid,text) to service_role;
notify pgrst,'reload schema';
commit;
