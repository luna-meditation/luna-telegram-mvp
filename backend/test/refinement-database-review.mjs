import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Client} from 'pg';
assert.equal(process.versions.node.split('.')[0],'22');
const url='postgresql://fixture_admin@127.0.0.1:55437/luna_refinement_qa';
const admin=new Client({connectionString:url.replace('/luna_refinement_qa','/postgres')});await admin.connect();
if(!(await admin.query("select 1 from pg_database where datname='luna_refinement_qa'")).rows.length)await admin.query('create database luna_refinement_qa template luna_phase1_security owner postgres');
await admin.end();
const db=new Client({connectionString:url});await db.connect();await db.query('set role postgres');
const sql=readFileSync('../supabase/migrations/20261014034527_luna_garden_atomic_mutations.sql','utf8');
await db.query(sql);await db.query(sql);console.log('PASS garden migration and repeat application');
const user=880030001;
await db.query("insert into public.users(telegram_id,first_name) values($1,'Local QA only') on conflict(telegram_id) do nothing",[user]);
await db.query("insert into public.moon_gardens(telegram_id,moon_seeds_available,moon_seeds_earned_total,planted_garden_elements,garden_level) values($1,100,100,'[]',0) on conflict(telegram_id) do update set moon_seeds_available=100,moon_seeds_earned_total=100,planted_garden_elements='[]',garden_level=0,premium_bonus_granted_at=null",[user]);
await db.query('delete from public.luna_garden_purchases where telegram_id=$1',[user]);
async function call(action,element=null,amount=0){const c=new Client({connectionString:url});await c.connect();try{await c.query('set role service_role');return (await c.query('select public.luna_mutate_garden($1,$2,$3,$4,0) as result',[user,action,element,amount])).rows[0].result;}finally{await c.end();}}
const purchases=await Promise.all(Array.from({length:12},()=>call('purchase','first_bloom')));
assert.equal(purchases.filter(p=>p.status==='ok').length,1);assert.equal(purchases.filter(p=>p.status==='owned').length,11);
assert.equal((await db.query('select moon_seeds_available from public.moon_gardens where telegram_id=$1',[user])).rows[0].moon_seeds_available,90);
await Promise.all([call('award',null,1),call('purchase','lantern_glow'),call('award',null,1)]);
assert.equal((await db.query('select moon_seeds_available from public.moon_gardens where telegram_id=$1',[user])).rows[0].moon_seeds_available,82);
const bonuses=await Promise.all(Array.from({length:8},()=>call('premium')));assert.equal(bonuses.filter(p=>p.status==='ok').length,1);
assert.equal((await db.query('select moon_seeds_available from public.moon_gardens where telegram_id=$1',[user])).rows[0].moon_seeds_available,122);
console.log('PASS concurrent purchases, awards and once-only existing premium bonus');
await db.query("update public.moon_gardens set planted_garden_elements='[\"moon_flower\",\"calm_stone\"]' where telegram_id=$1",[user]);
assert.equal((await call('purchase','first_bloom')).status,'owned');console.log('PASS legacy owned upgrades cannot be repurchased');
for(const role of ['anon','authenticated'])for(const statement of ['select * from public.luna_garden_purchases','select public.luna_mutate_garden(880030001,\'purchase\',\'first_bloom\',0,0)']){
 await db.query(`set role ${role}`);await assert.rejects(db.query(statement),error=>error.code==='42501');await db.query('set role postgres');
}
console.log('PASS anon/authenticated table and direct RPC denial');
await db.query('revoke execute on function public.luna_mutate_garden(bigint,text,text,integer,integer) from service_role');
await assert.rejects(call('purchase','stone_path'),error=>error.code==='42501');
await db.query(sql);console.log('PASS non-destructive rollback and reapply');
const personal=readFileSync('../supabase/migrations/20261014035512_luna_personalization_foundation.sql','utf8');
await db.query(personal);await db.query(personal);
await db.query('set role service_role');
await db.query("insert into public.luna_personal_profiles(telegram_id,interests,preferences,ai_context_consent) values($1,array['tarot'],'QA short responses',false) on conflict(telegram_id) do update set preferences='QA short responses',ai_context_consent=false",[user]);
assert.equal((await db.query('select ai_context_consent from public.luna_personal_profiles where telegram_id=$1',[user])).rows[0].ai_context_consent,false);
await db.query('delete from public.luna_personal_profiles where telegram_id=$1',[user]);await db.query('set role postgres');
for(const role of ['anon','authenticated']){await db.query(`set role ${role}`);await assert.rejects(db.query('select * from public.luna_personal_profiles'),error=>error.code==='42501');await db.query('set role postgres');}
console.log('PASS optional profile save/read/delete, false default consent and closed client grants');
await db.end();
