-- PREPARED ONLY. Apply to an isolated database before an explicitly approved rollout.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
create table if not exists public.luna_garden_purchases (
 id uuid primary key default gen_random_uuid(),
 telegram_id bigint not null references public.users(telegram_id) on delete cascade,
 element_id text not null,
 cost integer not null check(cost=10),
 balance_after integer not null check(balance_after>=0),
 created_at timestamptz not null default now(),
 unique(telegram_id,element_id)
);
alter table public.luna_garden_purchases enable row level security;
alter table public.luna_garden_purchases force row level security;
revoke all on public.luna_garden_purchases from public,anon,authenticated,service_role;
grant select,insert on public.luna_garden_purchases to service_role;
create or replace function public.luna_mutate_garden(p_telegram_id bigint,p_action text,p_element text default null,p_amount integer default 0,p_earned integer default 0)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare g public.moon_gardens%rowtype; created uuid; planted integer; old_total integer; is_new boolean;
 canonical text[]:=array['first_bloom','lantern_glow','stone_path','twin_bloom','moon_bridge','reflection_garden','full_moon_garden'];
 legacy text[]:=array['moon_flower','calm_stone','water_ripple','golden_lantern','night_lily','crescent_tree','star_path','breathing_pond'];
 normalized jsonb:='[]'; legacy_seen jsonb:='[]'; item text; i integer;
begin
 if p_action is null or p_action not in ('purchase','award','premium','sync') then raise exception 'Invalid garden action'; end if;
 insert into public.moon_gardens(telegram_id,moon_seeds_available,moon_seeds_earned_total,planted_garden_elements,garden_level)
 values(p_telegram_id,0,0,'[]'::jsonb,0) on conflict(telegram_id) do nothing returning id into created;
 is_new:=created is not null;
 select * into strict g from public.moon_gardens where telegram_id=p_telegram_id for update;
 -- Match the existing backend legacy normalizer; do not let legacy users buy owned upgrades again.
 for item in select replace(value #>> '{}','-','_') from jsonb_array_elements(case when jsonb_typeof(g.planted_garden_elements)='array' then g.planted_garden_elements else '[]'::jsonb end) where jsonb_typeof(value)='string' loop
  if item=any(canonical) and not normalized ? item then normalized:=normalized||jsonb_build_array(item); end if;
  if item=any(legacy) and not legacy_seen ? item then legacy_seen:=legacy_seen||jsonb_build_array(item); end if;
 end loop;
 if normalized='[]'::jsonb then
  for i in 1..least(7,jsonb_array_length(legacy_seen)) loop normalized:=normalized||jsonb_build_array(canonical[i]); end loop;
 end if;
 g.planted_garden_elements:=normalized;
 planted:=jsonb_array_length(g.planted_garden_elements);
 old_total:=g.moon_seeds_earned_total;
 if p_action='purchase' then
  if p_element is null or p_element not in ('first_bloom','lantern_glow','stone_path','twin_bloom','moon_bridge','reflection_garden','full_moon_garden') then raise exception 'Invalid garden element'; end if;
  if g.planted_garden_elements ? p_element then return jsonb_build_object('status','owned','garden',to_jsonb(g)); end if;
  if g.moon_seeds_available<10 then return jsonb_build_object('status','insufficient','garden',to_jsonb(g)); end if;
  g.moon_seeds_earned_total:=greatest(old_total,g.moon_seeds_available+planted*10);
  g.moon_seeds_available:=g.moon_seeds_available-10;
  g.planted_garden_elements:=g.planted_garden_elements||jsonb_build_array(p_element);
  insert into public.luna_garden_purchases(telegram_id,element_id,cost,balance_after) values(p_telegram_id,p_element,10,g.moon_seeds_available);
 elsif p_action in ('award','premium') then
  if p_action='premium' and g.premium_bonus_granted_at is not null then return jsonb_build_object('status','owned','garden',to_jsonb(g)); end if;
  if p_action='premium' then p_amount:=40; g.premium_bonus_granted_at:=now(); end if;
  if p_amount<1 or p_amount>10000 then raise exception 'Invalid seed award'; end if;
  g.moon_seeds_earned_total:=greatest(old_total,g.moon_seeds_available+planted*10)+p_amount;
  g.moon_seeds_available:=g.moon_seeds_available+p_amount;
  g.last_moon_seed_earned_at:=now();
 else
  -- Preserve current derivation semantics without racing purchase/award writes.
  g.moon_seeds_earned_total:=greatest(old_total,greatest(0,p_earned),g.moon_seeds_available+planted*10);
  g.moon_seeds_available:=case when is_new then greatest(0,g.moon_seeds_earned_total-planted*10) else greatest(g.moon_seeds_available,old_total-planted*10) end;
  if g.moon_seeds_earned_total>old_total then g.last_moon_seed_earned_at:=now(); end if;
 end if;
 g.garden_level:=least(7,jsonb_array_length(g.planted_garden_elements));
 update public.moon_gardens set moon_seeds_available=g.moon_seeds_available,moon_seeds_earned_total=g.moon_seeds_earned_total,
 planted_garden_elements=g.planted_garden_elements,garden_level=g.garden_level,last_moon_seed_earned_at=g.last_moon_seed_earned_at,
 premium_bonus_granted_at=g.premium_bonus_granted_at,updated_at=now() where telegram_id=p_telegram_id returning * into g;
 return jsonb_build_object('status','ok','garden',to_jsonb(g));
end $$;
revoke all on function public.luna_mutate_garden(bigint,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.luna_mutate_garden(bigint,text,text,integer,integer) to service_role;
notify pgrst,'reload schema';
commit;
-- Rollback: first disable FEATURE_GARDEN_ATOMIC. Preserve the purchase ledger.
-- Then REVOKE EXECUTE ON FUNCTION public.luna_mutate_garden(bigint,text,text,integer,integer) FROM service_role;
-- Existing balances and planted elements must NOT be reset or restored from a stale snapshot.
