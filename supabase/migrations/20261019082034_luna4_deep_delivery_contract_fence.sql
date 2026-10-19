-- Future Seed purchases only; historical deliveries remain grandfathered.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';
alter table public.luna43_seed_purchases add column if not exists contract_version text;
create or replace function public.luna4_stamp_seed_contract()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' then new.contract_version:=old.contract_version;return new;end if;
 if exists(select 1 from public.luna34_commercial_settings where id and catalog->>'version'='luna-4.0-completion-v1' and luna4_activation_verified and luna4_cutover_at<=now()) then new.contract_version:='luna-4.0-completion-v1';else new.contract_version:=null;end if;
 return new;
end $$;
revoke all on function public.luna4_stamp_seed_contract() from public,anon,authenticated;grant execute on function public.luna4_stamp_seed_contract() to service_role;
drop trigger if exists luna4_seed_contract on public.luna43_seed_purchases;
create trigger luna4_seed_contract before insert or update on public.luna43_seed_purchases for each row execute function public.luna4_stamp_seed_contract();
create or replace function public.luna43_claim_deep_analysis(p_owner bigint,p_purchase uuid,p_lease uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.luna43_seed_purchases%rowtype;
begin
 if p_lease is null then raise exception 'Missing lease' using errcode='22023';end if;
 select * into p from public.luna43_seed_purchases where id=p_purchase and telegram_id=p_owner and product='deep_analysis' for update;
 if not found then return jsonb_build_object('status','not_found');end if;
 if p.seeds=0 or p.contract_version='luna-4.0-completion-v1' then return public.luna4_claim_personal_analysis(p_owner,p_purchase,p_lease);end if;
 if p.state<>'entitled' then return jsonb_build_object('status',p.state,'purchase',to_jsonb(p)-'telegram_id'-'request_hash');end if;
 update public.luna43_seed_purchases set state='processing',lease=p_lease,updated_at=now() where id=p.id returning * into p;
 return jsonb_build_object('status','claimed','purchase',to_jsonb(p)-'telegram_id'-'request_hash');
end $$;
create or replace function public.luna43_finish_deep_analysis(p_owner bigint,p_purchase uuid,p_lease uuid,p_result jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
declare p public.luna43_seed_purchases%rowtype;balance integer;
begin
 perform pg_advisory_xact_lock(pg_catalog.hashtextextended('luna21_wallet:'||p_owner::text,0));
 select * into p from public.luna43_seed_purchases where id=p_purchase and telegram_id=p_owner and product='deep_analysis' for update;
 if not found or p.state<>'processing' or p.lease is distinct from p_lease then return false;end if;
 if p.seeds=0 or p.contract_version='luna-4.0-completion-v1' then return public.luna4_finish_personal_analysis(p_owner,p_purchase,p_lease,p_result);end if;
 if p_result is null then
  select moon_seeds_available into strict balance from public.moon_gardens where telegram_id=p_owner for update;
  insert into public.luna_seed_ledger(telegram_id,event_key,kind,delta,balance_after) values(p_owner,'luna43:deep_refund:'||p.id::text,'refund',p.seeds,balance+p.seeds);
  update public.moon_gardens set moon_seeds_available=balance+p.seeds,updated_at=now() where telegram_id=p_owner;
  update public.luna43_seed_purchases set state='failed_refunded',updated_at=now() where id=p.id;
 else
  if jsonb_typeof(p_result)<>'object' or octet_length(p_result::text)>30000 then raise exception 'Invalid result' using errcode='22023';end if;
  update public.luna43_seed_purchases set state='ready',result=p_result,updated_at=now() where id=p.id;
 end if;return true;
end $$;
-- Reassert only the same existing service boundary, never expand public access.
revoke all on function public.luna43_claim_deep_analysis(bigint,uuid,uuid),public.luna43_finish_deep_analysis(bigint,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.luna43_claim_deep_analysis(bigint,uuid,uuid),public.luna43_finish_deep_analysis(bigint,uuid,uuid,jsonb) to service_role;
notify pgrst,'reload schema';commit;
-- Rollback pauses new sales; never remove the immutable version tag or weaken
-- finality for a purchase already confirmed under these new terms.
