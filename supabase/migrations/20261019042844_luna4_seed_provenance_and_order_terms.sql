-- Forward-only accounting metadata. The wallet authority remains moon_gardens.
-- No prices, balances, paid rights, payment flags or old rows are rewritten.
-- Existing unclassified balances are NOT described as purchased currency.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

create table if not exists public.luna4_seed_sources (
 telegram_id bigint primary key references public.users(telegram_id) on delete cascade,
 promotional bigint not null default 0 check(promotional>=0),
 purchased bigint not null default 0 check(purchased>=0),
 legacy_unclassified bigint not null default 0 check(legacy_unclassified>=0),
 revision bigint not null default 0 check(revision>=0),
 updated_at timestamptz not null default now()
);
create table if not exists public.luna4_seed_provenance (
 ledger_id uuid primary key references public.luna_seed_ledger(id) on delete cascade,
 telegram_id bigint not null references public.users(telegram_id) on delete cascade,
 promotional_delta bigint not null,
 purchased_delta bigint not null,
 legacy_delta bigint not null,
 original_ledger_id uuid references public.luna_seed_ledger(id),
 classification text not null check(classification in('promotional','purchased','legacy_unclassified','spend','refund','purchase_refund')),
 revision bigint not null,
 created_at timestamptz not null default now(),
 unique(telegram_id,revision)
);
create index if not exists luna4_seed_provenance_owner_created on public.luna4_seed_provenance(telegram_id,created_at desc);
create unique index if not exists luna4_seed_one_refund on public.luna4_seed_provenance(original_ledger_id) where original_ledger_id is not null;

create table if not exists public.luna4_order_terms (
 order_id uuid primary key references public.luna30_commercial_orders(id),
 telegram_id bigint not null references public.users(telegram_id),
 catalog_version text not null,
 catalog_revision integer not null check(catalog_revision>=0),
 snapshot jsonb not null check(jsonb_typeof(snapshot)='object' and octet_length(snapshot::text)<=32000),
 created_at timestamptz not null default now()
);
create index if not exists luna4_order_terms_owner on public.luna4_order_terms(telegram_id,created_at desc);
do $$declare t text;begin foreach t in array array['luna4_seed_sources','luna4_seed_provenance','luna4_order_terms'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('alter table public.%I force row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
end loop;end $$;
grant select,insert,update on public.luna4_seed_sources to service_role;
grant select,insert on public.luna4_seed_provenance,public.luna4_order_terms to service_role;

create or replace function public.luna4_journal_seed_sources()
returns trigger language plpgsql security invoker set search_path='' as $$
declare s public.luna4_seed_sources%rowtype; original public.luna4_seed_provenance%rowtype;
 before_value bigint:=new.balance_after::bigint-new.delta::bigint;
 promo bigint:=0;paid bigint:=0;legacy bigint:=0;remaining bigint;take_value bigint;source text;original_id uuid;
begin
 -- Wallet row precedes projection row everywhere, including old routines that
 -- insert the ledger after updating the wallet. No extra advisory-lock order.
 perform 1 from public.moon_gardens where telegram_id=new.telegram_id for update;
 if before_value<0 then raise exception 'Invalid seed ledger balance' using errcode='23514';end if;
 insert into public.luna4_seed_sources(telegram_id,legacy_unclassified) values(new.telegram_id,before_value) on conflict do nothing;
 select * into strict s from public.luna4_seed_sources where telegram_id=new.telegram_id for update;
 if s.promotional+s.purchased+s.legacy_unclassified<>before_value then
  raise exception 'Seed provenance requires reconciliation' using errcode='23514';
 end if;
 -- Exact historical refund identity, never the current catalog price.
 if new.event_key like 'luna43:deep_refund:%' then
  select p.* into original from public.luna4_seed_provenance p join public.luna_seed_ledger l on l.id=p.ledger_id
   where l.telegram_id=new.telegram_id and l.event_key='luna43:purchase:'||substr(new.event_key,length('luna43:deep_refund:')+1);
 elsif new.event_key like 'luna30:refund:%' then
  select p.* into original from public.luna4_seed_provenance p join public.luna_seed_ledger l on l.id=p.ledger_id
   where l.telegram_id=new.telegram_id and l.event_key='luna30:charge:'||substr(new.event_key,length('luna30:refund:')+1);
 end if;
 if original.ledger_id is not null and new.delta>0 and original.promotional_delta+original.purchased_delta+original.legacy_delta=-new.delta then
  promo:=-original.promotional_delta;paid:=-original.purchased_delta;legacy:=-original.legacy_delta;source:='refund';original_id:=original.ledger_id;
 elsif original.ledger_id is not null and new.delta<0 and original.promotional_delta+original.purchased_delta+original.legacy_delta=-new.delta then
  -- The old refund service decides whether recovery is permissible. Record the
  -- actual debit, taking the original origin first, without inventing a debt.
  remaining:=-new.delta;
  paid:=-least(s.purchased,greatest(0,original.purchased_delta),remaining);remaining:=remaining+paid;
  promo:=-least(s.promotional,greatest(0,original.promotional_delta),remaining);remaining:=remaining+promo;
  legacy:=-least(s.legacy_unclassified,remaining);remaining:=remaining+legacy;
  if remaining>0 then take_value:=least(s.purchased+paid,remaining);paid:=paid-take_value;remaining:=remaining-take_value;end if;
  if remaining>0 then promo:=promo-remaining;end if;
  source:='purchase_refund';original_id:=original.ledger_id;
 elsif new.delta<0 then
  remaining:=-new.delta;promo:=-least(s.promotional,remaining);remaining:=remaining+promo;
  legacy:=-least(s.legacy_unclassified,remaining);remaining:=remaining+legacy;paid:=-remaining;source:='spend';
 elsif new.kind='stars_package' then paid:=new.delta;source:='purchased';
 elsif new.kind in('checkin','seven_days','meditation','breath','journal','referral','premium_renewal') then promo:=new.delta;source:='promotional';
 else legacy:=new.delta;source:='legacy_unclassified';end if;
 if promo+paid+legacy<>new.delta or s.promotional+promo<0 or s.purchased+paid<0 or s.legacy_unclassified+legacy<0 then raise exception 'Invalid provenance split' using errcode='23514';end if;
 update public.luna4_seed_sources set promotional=promotional+promo,purchased=purchased+paid,legacy_unclassified=legacy_unclassified+legacy,revision=revision+1,updated_at=now() where telegram_id=new.telegram_id returning * into s;
 insert into public.luna4_seed_provenance(ledger_id,telegram_id,promotional_delta,purchased_delta,legacy_delta,original_ledger_id,classification,revision)
 values(new.id,new.telegram_id,promo,paid,legacy,original_id,source,s.revision);
 return new;
end $$;

create or replace function public.luna4_reconcile_unjournaled_seed_change()
returns trigger language plpgsql security invoker set search_path='' as $$
declare s public.luna4_seed_sources%rowtype;balance_value bigint;opening_value bigint;difference bigint;
begin
 if tg_op='UPDATE' and new.moon_seeds_available=old.moon_seeds_available then return null;end if;
 -- Deferred until the entire existing transaction completes: an old routine
 -- may write the wallet before OR after its existing ledger. Never double log.
 select moon_seeds_available into balance_value from public.moon_gardens where telegram_id=new.telegram_id for update;
 if not found then return null;end if;
 opening_value:=case when tg_op='UPDATE' then old.moon_seeds_available else new.moon_seeds_available end;
 insert into public.luna4_seed_sources(telegram_id,legacy_unclassified) values(new.telegram_id,opening_value) on conflict do nothing;
 select * into strict s from public.luna4_seed_sources where telegram_id=new.telegram_id for update;
 difference:=balance_value-s.promotional-s.purchased-s.legacy_unclassified;
 if difference<>0 then
  -- Preserve old totals and functionality. The historical source is unknown,
  -- so a forward adjustment is auditable but never labelled as a purchase.
  insert into public.luna_seed_ledger(telegram_id,event_key,kind,delta,balance_after)
  values(new.telegram_id,'luna4:unclassified:'||pg_catalog.txid_current()::text||':'||s.revision::text,'admin_adjustment',difference::integer,balance_value::integer);
 end if;
 return null;
end $$;

create or replace function public.luna4_capture_order_terms(p_owner bigint,p_order uuid,p_version text,p_revision integer,p_snapshot jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare o public.luna30_commercial_orders%rowtype;prior public.luna4_order_terms%rowtype;
begin
 if coalesce(p_revision<0 or p_version is null or p_version='' or p_snapshot is null or jsonb_typeof(p_snapshot)<>'object' or octet_length(p_snapshot::text)>32000,true) then raise exception 'Invalid order terms' using errcode='22023';end if;
 select * into strict o from public.luna30_commercial_orders where telegram_id=p_owner and id=p_order for update;
 if p_version<>o.catalog_version or (p_snapshot->>'stars')::integer is distinct from o.stars or (p_snapshot->>'seeds')::integer is distinct from o.seeds or (p_snapshot->>'days')::integer is distinct from o.days or p_snapshot->>'product' is distinct from o.product then raise exception 'Order terms mismatch' using errcode='23514';end if;
 select * into prior from public.luna4_order_terms where order_id=o.id;
 if found then
  if prior.snapshot<>p_snapshot or prior.catalog_revision<>p_revision or prior.catalog_version<>p_version then raise exception 'Immutable terms conflict' using errcode='23505';end if;
  return jsonb_build_object('saved',true,'cached',true);
 end if;
 if o.state<>'pending' then raise exception 'Terms must precede accepted payment' using errcode='23514';end if;
 insert into public.luna4_order_terms(order_id,telegram_id,catalog_version,catalog_revision,snapshot) values(o.id,p_owner,p_version,p_revision,p_snapshot);
 return jsonb_build_object('saved',true,'cached',false);
end $$;
revoke all on function public.luna4_journal_seed_sources(),public.luna4_reconcile_unjournaled_seed_change(),public.luna4_capture_order_terms(bigint,uuid,text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.luna4_journal_seed_sources(),public.luna4_reconcile_unjournaled_seed_change(),public.luna4_capture_order_terms(bigint,uuid,text,integer,jsonb) to service_role;
drop trigger if exists luna4_seed_source_journal on public.luna_seed_ledger;
create trigger luna4_seed_source_journal after insert on public.luna_seed_ledger for each row execute function public.luna4_journal_seed_sources();
drop trigger if exists luna4_wallet_journal_reconciliation on public.moon_gardens;
create constraint trigger luna4_wallet_journal_reconciliation after insert or update on public.moon_gardens deferrable initially deferred for each row execute function public.luna4_reconcile_unjournaled_seed_change();
notify pgrst,'reload schema';
commit;
-- Safe rollback: remove ONLY the two new triggers, retain journal metadata and
-- immutable order terms. Never recalculate wallet totals or revoke old rights.
