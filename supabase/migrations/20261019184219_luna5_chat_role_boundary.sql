-- Luna uses verified Telegram authorization in its backend and service_role DB
-- access. These two private chat tables have RLS but legacy ALL grants (including
-- TRUNCATE) for browser roles. RLS does not protect TRUNCATE. No rows or
-- policies are changed, and no other application's objects are touched.
do $boundary$
declare target text;
begin
  foreach target in array array['ai_conversations','ai_messages'] loop
    if not exists(select 1 from pg_class where oid=('public.'||target)::regclass and relrowsecurity) then
      raise exception 'Luna chat RLS must already be enabled';
    end if;
    if exists(select 1 from unnest(array['SELECT','INSERT','UPDATE','DELETE']) privilege where not has_table_privilege('service_role','public.'||target,privilege)) then
      raise exception 'Luna server chat privileges must already exist';
    end if;
  end loop;
end $boundary$;

revoke all privileges on table public.ai_conversations, public.ai_messages from public, anon, authenticated;

-- Service-role privileges, table ownership, RLS, constraints and stored history
-- remain exactly as before. Never disable RLS to accommodate a client role.
