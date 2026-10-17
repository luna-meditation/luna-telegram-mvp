-- Read-only release evidence. Outputs hashes/counts, not personal records.
with relations as (
 select c.relname,jsonb_build_object('kind',c.relkind,'rls',c.relrowsecurity,'forced',c.relforcerowsecurity,'acl',c.relacl,'owner',c.relowner,
 'columns',(select jsonb_agg(jsonb_build_array(a.attname,a.atttypid,a.atttypmod,a.attnotnull,pg_get_expr(d.adbin,d.adrelid)) order by a.attnum) from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),
 'constraints',(select jsonb_agg(jsonb_build_array(x.conname,pg_get_constraintdef(x.oid)) order by x.conname) from pg_constraint x where x.conrelid=c.oid),
 'indexes',(select jsonb_agg(indexdef order by indexname) from pg_indexes i where i.schemaname='public' and i.tablename=c.relname),
 'policies',(select jsonb_agg(to_jsonb(p) order by p.policyname) from pg_policies p where p.schemaname='public' and p.tablename=c.relname),
 'triggers',(select jsonb_agg(pg_get_triggerdef(t.oid) order by t.tgname) from pg_trigger t where t.tgrelid=c.oid and not t.tgisinternal)) definition
 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in('r','v','m','S') and c.relname not like 'luna34_%' and c.relname not in('luna_breath_proofs','luna30_referrals')
), functions as (
 select p.oid::regprocedure::text identity,md5(pg_get_functiondef(p.oid)||coalesce(p.proacl::text,'')||p.proowner::text) digest
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' and p.proname not like 'luna34_%'
)
select jsonb_build_object('capturedAt',now(),'projectId','vkcdtasbdoeilgfucoax',
 'relations',(select jsonb_object_agg(relname,md5(definition::text)) from relations),
 'functions',(select jsonb_object_agg(identity,digest) from functions),
 'budget',(select to_jsonb(s) from public.luna32_runtime_settings s where id),
 'financial',jsonb_build_object(
  'users',(select jsonb_build_object('count',count(*),'digest',md5(string_agg(to_jsonb(x)::text,'' order by telegram_id))) from public.users x),
  'gardens',(select jsonb_build_object('count',count(*),'digest',md5(string_agg(to_jsonb(x)::text,'' order by telegram_id))) from public.moon_gardens x),
  'payments',(select jsonb_build_object('count',count(*),'digest',md5(string_agg(to_jsonb(x)::text,'' order by id))) from public.payments x),
  'ledger',(select jsonb_build_object('count',count(*),'digest',md5(string_agg(to_jsonb(x)::text,'' order by id))) from public.luna_seed_ledger x),
  'periods',(select jsonb_build_object('count',count(*),'digest',md5(string_agg(to_jsonb(x)::text,'' order by id))) from public.luna30_entitlement_periods x),
  'receipts',(select jsonb_build_object('count',count(*),'digest',md5(string_agg(to_jsonb(x)::text,'' order by charge_id))) from public.luna30_commercial_receipts x)),
 'modifiedLunaTables',(select jsonb_object_agg(c.relname,jsonb_build_object('rls',c.relrowsecurity,'forced',c.relforcerowsecurity,'acl',c.relacl,'columns',(select jsonb_agg(jsonb_build_array(a.attname,a.atttypid,a.atttypmod,a.attnotnull) order by a.attnum) from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped))) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in('luna_breath_proofs','luna30_referrals'))
) as snapshot;
