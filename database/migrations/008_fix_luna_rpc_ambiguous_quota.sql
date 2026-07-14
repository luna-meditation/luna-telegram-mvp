-- Fixes the PL/pgSQL output-variable/table-column ambiguity in the Luna quota RPC.
-- Additive, idempotent, and safe for existing user data.

create or replace function public.reserve_luna_chat_request(
  p_telegram_id bigint,
  p_client_request_id text,
  p_daily_limit integer,
  p_conversation_id uuid default null
)
returns table(status text, quota_charged boolean, remaining integer, attempt_count integer, acquired boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.ai_chat_requests%rowtype;
  v_used_count integer;
  v_had_existing boolean := false;
begin
  if p_telegram_id is null then
    raise exception using errcode = '22004', message = 'Telegram user id is required.';
  end if;
  if p_client_request_id is null or btrim(p_client_request_id) = '' then
    raise exception using errcode = '22004', message = 'Client request id is required.';
  end if;
  if p_daily_limit is null or p_daily_limit < 0 then
    raise exception using errcode = '22023', message = 'Daily limit must be a non-negative integer.';
  end if;
  if not exists (select 1 from public.users as user_row where user_row.telegram_id = p_telegram_id) then
    raise exception using errcode = '42501', message = 'Telegram user is not recognized.';
  end if;
  if p_conversation_id is not null and not exists (
    select 1 from public.ai_conversations as conversation_row
    where conversation_row.id = p_conversation_id
      and conversation_row.telegram_id = p_telegram_id
  ) then
    raise exception using errcode = '42501', message = 'Conversation ownership validation failed.';
  end if;

  perform pg_advisory_xact_lock(p_telegram_id);
  select request_row.* into v_request
  from public.ai_chat_requests as request_row
  where request_row.telegram_id = p_telegram_id
    and request_row.client_request_id = p_client_request_id
  for update;
  v_had_existing := found;

  if v_had_existing and (v_request.status = 'completed' or (v_request.status = 'processing' and v_request.updated_at > now() - interval '3 minutes')) then
    return query select v_request.status, v_request.quota_charged,
      greatest(0, p_daily_limit - (select count(*)::integer from public.ai_chat_requests as usage_row
        where usage_row.telegram_id = p_telegram_id and usage_row.quota_charged
          and usage_row.created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc')),
      v_request.attempt_count, false;
    return;
  end if;

  select count(*)::integer into v_used_count
  from public.ai_chat_requests as usage_row
  where usage_row.telegram_id = p_telegram_id and usage_row.quota_charged
    and usage_row.created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';

  if v_used_count >= p_daily_limit and (not v_had_existing or not v_request.quota_charged) then
    if v_had_existing then
      update public.ai_chat_requests as request_row
      set conversation_id = coalesce(p_conversation_id, request_row.conversation_id), status = 'quota_exhausted', error_code = 'quota_exhausted', updated_at = now()
      where request_row.id = v_request.id
      returning request_row.* into v_request;
    else
      insert into public.ai_chat_requests (telegram_id, client_request_id, conversation_id, status, error_code)
      values (p_telegram_id, p_client_request_id, p_conversation_id, 'quota_exhausted', 'quota_exhausted')
      returning * into v_request;
    end if;
    return query select 'quota_exhausted'::text, false, 0, coalesce(v_request.attempt_count, 0), false;
    return;
  end if;

  if v_had_existing then
    update public.ai_chat_requests as request_row
    set conversation_id = coalesce(p_conversation_id, request_row.conversation_id), status = 'processing', quota_charged = true,
        attempt_count = request_row.attempt_count + 1, error_code = null, updated_at = now()
    where request_row.id = v_request.id
    returning request_row.* into v_request;
  else
    insert into public.ai_chat_requests (telegram_id, client_request_id, conversation_id, status, quota_charged, attempt_count, error_code, updated_at)
    values (p_telegram_id, p_client_request_id, p_conversation_id, 'processing', true, 1, null, now())
    returning * into v_request;
  end if;

  select count(*)::integer into v_used_count
  from public.ai_chat_requests as usage_row
  where usage_row.telegram_id = p_telegram_id and usage_row.quota_charged
    and usage_row.created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  return query select v_request.status, v_request.quota_charged, greatest(0, p_daily_limit - v_used_count), v_request.attempt_count, true;
end;
$$;

revoke all on function public.reserve_luna_chat_request(bigint, text, integer, uuid) from public;
grant execute on function public.reserve_luna_chat_request(bigint, text, integer, uuid) to service_role;

notify pgrst, 'reload schema';
