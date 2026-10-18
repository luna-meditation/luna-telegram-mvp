-- Luna editorial adapters only. Existing financial RPCs, user data and calculation
-- catalogs are unchanged. Drafts never shadow the last published snapshot.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';
create or replace view public.luna42_published_editorial with (security_invoker=true) as
 select kind,content_key,version,body from (
  select distinct on(kind,content_key) kind,content_key,version,state,body
  from public.luna40_content_versions where kind<>'meditation' and state in('published','archived')
  order by kind,content_key,version desc
 ) h where state='published';
revoke all on public.luna42_published_editorial from public,anon,authenticated;
grant select on public.luna42_published_editorial to service_role;
create or replace function public.luna42_save_editorial(p_actor bigint,p_request uuid,p_reason text,p_kind text,p_key text,p_expected integer,p_state text,p_body jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare prior public.luna40_admin_audit;latest integer;result_value jsonb;input_value jsonb;before_value jsonb;allowed text[];
begin
 if p_actor is null or p_actor<=0 or p_request is null or p_reason is null or length(btrim(p_reason)) not between 3 and 500 or p_kind is null or p_kind not in('breathwork','tarot','astrology','garden','achievement','share','bot') or p_key is null or p_key!~'^[a-zA-Z0-9_-]{1,100}$' or p_expected is null or p_expected<0 or p_state is null or p_state not in('draft','published','archived') or p_body is null or jsonb_typeof(p_body)<>'object' or octet_length(p_body::text)>40000 then raise exception 'invalid_editorial_operation' using errcode='22023';end if;
 allowed:=array['title','description','image'];
 if p_kind='breathwork' then allowed:=allowed||array['guide','phases','ambientAudio','voiceCues'];elsif p_kind='tarot' then allowed:=allowed||array['upright','reversed'];end if;
 if exists(select 1 from jsonb_object_keys(p_body) k where not k=any(allowed)) or not(p_body#>>'{title,en}' is not null and p_body#>>'{title,ru}' is not null and p_body#>>'{description,en}' is not null and p_body#>>'{description,ru}' is not null) then raise exception 'invalid_editorial_fields' using errcode='22023';end if;
 input_value:=jsonb_build_object('kind',p_kind,'key',p_key,'expectedVersion',p_expected,'state',p_state,'body',p_body);
 perform pg_advisory_xact_lock(hashtextextended('luna40_admin:'||p_actor||':'||p_request,0));
 select * into prior from public.luna40_admin_audit where actor=p_actor and request_id=p_request;
 if found then
  if prior.action<>'content.editorial' or prior.input<>input_value or prior.reason<>p_reason then raise exception 'idempotency_conflict' using errcode='23505';end if;
  return prior.result;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('luna40_content:'||p_kind||':'||p_key,0));
 select coalesce(max(version),0) into latest from public.luna40_content_versions where kind=p_kind and content_key=p_key;
 if latest<>p_expected then raise exception 'content_changed' using errcode='40001';end if;
 select to_jsonb(h) into before_value from public.luna42_published_editorial h where kind=p_kind and content_key=p_key;
 insert into public.luna40_content_versions(kind,content_key,version,state,body,actor) values(p_kind,p_key,latest+1,p_state,p_body,p_actor);
 result_value:=jsonb_build_object('key',p_key,'version',latest+1,'state',p_state);
 insert into public.luna40_admin_audit(actor,request_id,action,reason,input,previous,result) values(p_actor,p_request,'content.editorial',p_reason,input_value,before_value,result_value);
 return result_value;
end $$;
revoke all on function public.luna42_save_editorial(bigint,uuid,text,text,text,integer,text,jsonb) from public,anon,authenticated;
grant execute on function public.luna42_save_editorial(bigint,uuid,text,text,text,integer,text,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
-- Quarantine/rollback: revert application to bundled editorial content by disabling
-- the loader, then revoke EXECUTE on luna42_save_editorial from service_role.
-- Do not delete append-only versions/audits or restore user data. Reapply to restore
-- publication. Archive a bad item with its current revision to return to bundled
-- defaults; financial/calculation objects are neither changed nor rolled back.
