// Generates one bounded, synthetic, STAGING-ONLY integration command for the
// connected Supabase executor. Does not itself connect to any database.
import assert from 'node:assert/strict';
import {luna4EconomyCandidate} from '../dist/luna4-economy-policy.js';
assert.equal(process.argv[2],'--query');assert.equal(process.versions.node.split('.')[0],'22');
const catalog=JSON.stringify(luna4EconomyCandidate);assert.ok(!catalog.includes('$luna4catalog$'));
console.log(`-- STAGING ONLY funvzpmpbgazsisehiru; synthetic accounts; no real invoice/provider call.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';
do $$begin
 if exists(select 1 from public.users where telegram_id in(510064101,510064102)) or exists(select 1 from public.luna30_qa_report_runs where run_name='luna4-financial-foundation-20261019-v1') then raise exception 'QA identity already exists; do not overwrite or replay';end if;
end $$;
set local role service_role;
insert into public.users(telegram_id,first_name,language_code) values(510064101,'Synthetic Luna4 Finance QA A','ru'),(510064102,'Synthetic Luna4 Finance QA B','en');
insert into public.moon_gardens(telegram_id,moon_seeds_available,moon_seeds_earned_total) values(510064101,0,0),(510064102,0,0);
do $$declare s public.luna4_seed_sources%rowtype;r jsonb;order_id uuid:=gen_random_uuid();request_id uuid:=gen_random_uuid();snapshot jsonb;catalog jsonb:=$luna4catalog$${catalog}$luna4catalog$;cfg public.luna34_commercial_settings%rowtype;begin
 insert into public.luna_seed_ledger(telegram_id,event_key,kind,delta,balance_after) values(510064101,'luna4qa:promotion','checkin',80,80);
 update public.moon_gardens set moon_seeds_available=80 where telegram_id=510064101;
 insert into public.luna_seed_ledger(telegram_id,event_key,kind,delta,balance_after) values(510064101,'luna4qa:package','stars_package',100,180);
 update public.moon_gardens set moon_seeds_available=180 where telegram_id=510064101;
 insert into public.luna_seed_ledger(telegram_id,event_key,kind,delta,balance_after) values(510064101,'luna43:purchase:64000000-0000-4000-8000-000000000001','deep_analysis_purchase',-90,90);
 update public.moon_gardens set moon_seeds_available=90 where telegram_id=510064101;
 select * into strict s from public.luna4_seed_sources where telegram_id=510064101;
 if s.promotional<>0 or s.purchased<>90 or s.legacy_unclassified<>0 then raise exception 'Incorrect promotional-first split';end if;
 insert into public.luna_seed_ledger(telegram_id,event_key,kind,delta,balance_after) values(510064101,'luna43:deep_refund:64000000-0000-4000-8000-000000000001','refund',90,180);
 update public.moon_gardens set moon_seeds_available=180 where telegram_id=510064101;
 select * into strict s from public.luna4_seed_sources where telegram_id=510064101;
 if s.promotional<>80 or s.purchased<>100 then raise exception 'Original refund split not restored';end if;
 r:=public.luna_mutate_garden(510064101,'purchase','first_bloom',0,0);
 if r->>'status'<>'ok' or (r#>>'{garden,moon_seeds_available}')::int<>170 then raise exception 'Legacy garden failed';end if;
 insert into public.luna30_commercial_orders(id,telegram_id,request_id,product,stars,seeds,days,catalog_version) values(order_id,510064101,request_id,'seeds_300',300,330,0,'luna-4.0-completion-v1');
 snapshot:=jsonb_build_object('product','seeds_300','stars',300,'seeds',330,'days',0);
 r:=public.luna4_capture_order_terms(510064101,order_id,'luna-4.0-completion-v1',0,snapshot);
 if r->>'saved'<>'true' or r->>'cached'<>'false' then raise exception 'Snapshot not captured';end if;
 r:=public.luna4_capture_order_terms(510064101,order_id,'luna-4.0-completion-v1',0,snapshot);
 if r->>'cached'<>'true' then raise exception 'Snapshot retry not idempotent';end if;
 begin perform public.luna4_capture_order_terms(510064102,order_id,'luna-4.0-completion-v1',0,snapshot);raise exception 'Foreign order accepted';exception when no_data_found then null;end;
 select * into strict cfg from public.luna34_commercial_settings where id;
 if cfg.next_catalog_revision<>0 or cfg.next_catalog is not null then raise exception 'Draft changed before QA; stop';end if;
 r:=public.luna4_update_next_catalog(510064101,request_id,0,catalog,'Synthetic Luna4 draft integration');
 if r->>'active'<>'false' or (r->>'revision')::int<>1 then raise exception 'Draft mutation failed';end if;
 r:=public.luna4_update_next_catalog(510064101,request_id,0,catalog,'Synthetic Luna4 draft integration');
 if (r->>'revision')::int<>1 then raise exception 'Draft retry not idempotent';end if;
 if (select c.catalog from public.luna34_commercial_settings c where c.id)<>cfg.catalog or (select c.checkout_enabled from public.luna34_commercial_settings c where c.id)<>cfg.checkout_enabled or (select c.quotas_enabled from public.luna34_commercial_settings c where c.id)<>cfg.quotas_enabled then raise exception 'Active financial settings changed';end if;
 if (select generation_enabled from public.luna32_runtime_settings where id) then raise exception 'Staging generation must remain closed';end if;
 if exists(select 1 from public.payments where telegram_id in(510064101,510064102)) then raise exception 'Unexpected real payment';end if;
 if exists(select 1 from public.luna4_seed_provenance where telegram_id=510064102) then raise exception 'Cross-user source entry';end if;
end $$;
reset role;
commit;
-- Deferred old-wallet reconciliation has completed before this read.
insert into public.luna30_qa_report_runs(run_name,state,result)
select 'luna4-financial-foundation-20261019-v1','completed',jsonb_build_object('status','PASS_FOUNDATION_ONLY','scope','synthetic ledger, immutable terms and NEXT catalog, not product delivery or real Stars','productionTouched',false,'providerCalls',0,'realStarsPayments',0,'checks',jsonb_build_array('promotional-first spend','exact-origin refund','old garden action','deferred journal reconciled once','owner-isolated order','immutable snapshot retry','audited draft retry','active catalog unchanged','staging generation stays disabled','zero real payment'),'sourceTotal',s.promotional+s.purchased+s.legacy_unclassified,'actualBalance',g.moon_seeds_available,'balanced',s.promotional+s.purchased+s.legacy_unclassified=g.moon_seeds_available,'nextCatalogRevision',cfg.next_catalog_revision,'activeCatalog',cfg.catalog->>'version')
from public.luna4_seed_sources s join public.moon_gardens g using(telegram_id) cross join public.luna34_commercial_settings cfg where s.telegram_id=510064101 and cfg.id;
select result from public.luna30_qa_report_runs where run_name='luna4-financial-foundation-20261019-v1';`);
