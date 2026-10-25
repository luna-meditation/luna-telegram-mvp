-- Owner-authorized least-privilege remediation, reviewed against fresh catalog metadata.
-- Exactly 16 legacy tables. Keep existing public-content SELECT on three catalogs.
-- Preserve service CRUD, RLS, policies, rows, functions, triggers and financial rules.
-- Fail closed on changed policy shape, inherited rights or unexpected column ACLs.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '15s';
do $review$
declare
 table_name text;
 target regclass;
 browser_role text;
 right_name text;
 content_table boolean;
 expected_tables constant text[] := array[
  'achievements','ai_chat_requests','ai_usage','breath_sessions','categories',
  'daily_checkins','favorites','history','meditations','moon_gardens','payments',
  'practice_days','practices','progress','streaks','users'];
begin
 foreach table_name in array expected_tables loop
  target := to_regclass(format('public.%I',table_name));
  if target is null then raise exception 'Missing expected table: %',table_name; end if;
  if not (select relrowsecurity from pg_class where oid=target) then
   raise exception 'RLS must already be enabled: %',table_name;
  end if;
  content_table := table_name=any(array['categories','meditations','practices']);
  if content_table then
   if (select count(*) from pg_policy where polrelid=target)<>1
    or not exists(select 1 from pg_policy where polrelid=target and polcmd='r'
      and polpermissive and polroles=array[0::oid] and pg_get_expr(polqual,polrelid)='true') then
    raise exception 'Public content policy changed; review %',table_name;
   end if;
  elsif exists(select 1 from pg_policy where polrelid=target) then
   raise exception 'Server-only policy changed; review %',table_name;
  end if;
  -- A table-level REVOKE ALL also removes directly granted column rights.
  -- Abort before touching such a grant: it was not part of this review.
  if exists(select 1 from pg_attribute a
   cross join lateral aclexplode(a.attacl) x
   where a.attrelid=target and a.attnum>0 and not a.attisdropped
   and x.grantee in (0::oid,'anon'::regrole::oid,'authenticated'::regrole::oid)) then
   raise exception 'Unexpected browser column ACL; review %',table_name;
  end if;
  foreach right_name in array array['SELECT','INSERT','UPDATE','DELETE'] loop
   if not has_table_privilege('service_role',target,right_name) then
    raise exception 'Missing existing service privilege % on %',right_name,table_name;
   end if;
  end loop;
  execute format('revoke all privileges on table %s from public,anon,authenticated',target);
  if content_table then
   execute format('grant select on table %s to anon,authenticated',target);
  end if;
  foreach browser_role in array array['anon','authenticated'] loop
   foreach right_name in array array['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] loop
    if has_table_privilege(browser_role,target,right_name) then
     raise exception 'Inherited % privilege remains for % on %',right_name,browser_role,table_name;
    end if;
   end loop;
   if has_table_privilege(browser_role,target,'SELECT') is distinct from content_table then
    raise exception 'Unexpected effective SELECT privilege for % on %',browser_role,table_name;
   end if;
  end loop;
  -- Unexpected column ACLs must not silently preserve private access.
  foreach browser_role in array array['anon','authenticated'] loop
   foreach right_name in array array['INSERT','UPDATE','REFERENCES'] loop
    if has_any_column_privilege(browser_role,target,right_name) then
     raise exception 'Unexpected column % privilege remains for % on %',right_name,browser_role,table_name;
    end if;
   end loop;
   if not content_table and has_any_column_privilege(browser_role,target,'SELECT') then
    raise exception 'Unexpected column SELECT privilege remains for % on %',browser_role,table_name;
   end if;
  end loop;
  foreach right_name in array array['SELECT','INSERT','UPDATE','DELETE'] loop
   if not has_table_privilege('service_role',target,right_name) then
    raise exception 'Service privilege changed: % on %',right_name,table_name;
   end if;
  end loop;
 end loop;
end $review$;
commit;
