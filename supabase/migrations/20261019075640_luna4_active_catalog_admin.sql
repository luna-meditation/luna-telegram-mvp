-- Editing an ALREADY verified active catalog only; not initial activation.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';
create or replace function public.luna4_update_active_catalog(p_actor bigint,p_request uuid,p_expected integer,p_body jsonb,p_reason text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare cfg public.luna34_commercial_settings%rowtype;prior public.luna40_admin_audit%rowtype;input_value jsonb;result_value jsonb;
begin
 if coalesce(p_actor<=0 or p_request is null or p_expected<0 or length(btrim(p_reason)) not between 3 and 500 or not public.luna4_valid_economy_catalog(p_body),true) then raise exception 'Invalid active catalog' using errcode='22023';end if;
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna4_active_catalog:'||p_actor::text||':'||p_request::text,0));
 input_value:=jsonb_build_object('catalog',p_body,'expectedRevision',p_expected);
 select * into prior from public.luna40_admin_audit where actor=p_actor and request_id=p_request;
 if found then if prior.action<>'catalog.luna4.active.update' or prior.input<>input_value or prior.reason<>p_reason then raise exception 'Catalog identity conflict' using errcode='23505';end if;return prior.result;end if;
 select * into strict cfg from public.luna34_commercial_settings where id for update;
 if cfg.catalog->>'version'<>'luna-4.0-completion-v1' or not cfg.luna4_activation_verified or cfg.luna4_cutover_at is null or cfg.luna4_cutover_at>now() then raise exception 'Verified release activation required' using errcode='PT409';end if;
 if cfg.catalog_revision<>p_expected then raise exception 'Active catalog changed' using errcode='PT409';end if;
 update public.luna34_commercial_settings set catalog=p_body,catalog_revision=catalog_revision+1 where id;
 result_value:=jsonb_build_object('catalog',p_body,'revision',p_expected+1,'active',true,'editable',true,'persisted',true);
 insert into public.luna40_admin_audit(actor,request_id,action,reason,input,previous,result) values(p_actor,p_request,'catalog.luna4.active.update',p_reason,input_value,cfg.catalog,result_value);
 return result_value;
end $$;
revoke all on function public.luna4_update_active_catalog(bigint,uuid,integer,jsonb,text) from public,anon,authenticated;
grant execute on function public.luna4_update_active_catalog(bigint,uuid,integer,jsonb,text) to service_role;
notify pgrst,'reload schema';commit;
-- Rollback revokes this editor or its endpoint; never overwrites terms on an
-- existing invoice, paid membership, included reservation or Seed purchase.
