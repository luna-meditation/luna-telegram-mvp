-- Intelligence 2.0: one lookup + one action + one answer, still ONE user quota.
-- No prices, balances, quotas, model, monthly cap, RLS or grants are changed.
-- Preflight must match the reviewed function; never overwrite schema drift.
begin;
set local lock_timeout='3s';
set local statement_timeout='15s';
do $migration$
declare definition text; normalized text; constraint_definition text;
 old_guard constant text := 'p_call not between 1 and 2 or';
 new_guard constant text := '(p_call not between 1 and 3 or (p_call=3 and p_operation not like ''chat:%'')) or';
begin
 definition:=pg_get_functiondef('public.luna32_reserve_ai_attempt(bigint,text,uuid,integer,uuid,text,bigint,integer)'::regprocedure);
 normalized:=replace(definition,new_guard,old_guard);
 if md5(normalized)<>'c2cb634567bb7e8d6bc4dafcefff9de2' then raise exception 'Unreviewed AI reservation definition; stop and review dependencies';end if;
 select pg_get_constraintdef(oid) into strict constraint_definition from pg_constraint where conrelid='public.luna32_ai_attempts'::regclass and conname='luna32_ai_attempts_call_index_check';
 if constraint_definition not in ('CHECK (((call_index >= 1) AND (call_index <= 2)))','CHECK (((call_index >= 1) AND (call_index <= 3)))') then raise exception 'Unreviewed AI call constraint';end if;
 if position(old_guard in definition)>0 then execute replace(definition,old_guard,new_guard);end if;
 if constraint_definition='CHECK (((call_index >= 1) AND (call_index <= 2)))' then
  alter table public.luna32_ai_attempts drop constraint luna32_ai_attempts_call_index_check;
  alter table public.luna32_ai_attempts add constraint luna32_ai_attempts_call_index_check check(call_index between 1 and 3) not valid;
  alter table public.luna32_ai_attempts validate constraint luna32_ai_attempts_call_index_check;
 end if;
end $migration$;
commit;
