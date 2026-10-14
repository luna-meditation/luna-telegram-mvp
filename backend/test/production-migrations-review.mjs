// Fresh production schema metadata, synthetic fixtures only, no hosted connection.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {Client} from 'pg';

assert.equal(process.versions.node.split('.')[0],'22');
assert.equal(process.env.LUNA_ISOLATED_RELEASE_REVIEW,'true');
const host=process.env.LUNA_RELEASE_REVIEW_SOCKET;
assert.ok(host?.startsWith('/tmp/luna-backup-runtime.')&&host.endsWith('/socket'),'Private local Unix socket required');
const metadata=JSON.parse(await readFile(process.env.LUNA_RELEASE_SCHEMA_METADATA,'utf8'));
assert.equal(metadata.project_id,'vkcdtasbdoeilgfucoax');
assert.equal(metadata.tables.length,22);assert.equal(metadata.external_foreign_keys.length,0);
const config={host,port:55438,user:'luna_restore_admin',database:'postgres'};
const qi=n=>'"'+n.replaceAll('"','""')+'"';
const qn=(s,n)=>`${qi(s)}.${qi(n)}`;
const checks=[];
const dbname=`luna_release_synthetic_${Date.now()}`;
const root=resolve(process.cwd(),'..');
const admin=new Client(config);await admin.connect();
assert.equal((await admin.query('show listen_addresses')).rows[0].listen_addresses,'');
await admin.query(`create database ${qi(dbname)}`);await admin.end();
const db=new Client({...config,database:dbname});await db.connect();
async function check(name,action){await action();checks.push(name);console.log(`PASS ${name}`);}
async function role(name,action){await db.query(`set session authorization ${qi(name)}`);try{return await action();}finally{await db.query('reset session authorization');}}
async function denied(sql,params=[]){await assert.rejects(db.query(sql,params),e=>e.code==='42501');}
const grants={r:'SELECT',a:'INSERT',w:'UPDATE',d:'DELETE',D:'TRUNCATE',x:'REFERENCES',t:'TRIGGER',m:'MAINTAIN',X:'EXECUTE',U:'USAGE',C:'CREATE'};
async function acl(entries,kind,target){await db.query(`revoke all on ${kind} ${target} from public,anon,authenticated,service_role`);for(const e of entries){const eq=e.indexOf('=');const to=e.slice(0,eq);for(const g of e.slice(eq+1).split('/')[0].matchAll(/([rawdDxtmXUC])(\*)?/g))await db.query(`grant ${grants[g[1]]} on ${kind} ${target} to ${to?qi(to):'public'}${g[2]?' with grant option':''}`);}}
const files=['20261014034527_luna_garden_atomic_mutations.sql','20261014035512_luna_personalization_foundation.sql','20261014041334_luna_tarot_ai_reading_history.sql'];
const migrationSql=await Promise.all(files.map(f=>readFile(resolve(root,'supabase/migrations',f),'utf8')));
const security=await readFile(resolve(root,'supabase/migrations/20261013061155_luna_security_boundary_hardening.sql'),'utf8');
const rollbackDoc=await readFile(resolve(root,'docs/phase-1-security-hardening.md'),'utf8');
const rollback=rollbackDoc.split('## Emergency rollback')[1].match(/```sql\n([\s\S]*?)```/)[1];
const user=880000011,lifetime=880000012,meditation=randomUUID(),conversation=randomUUID();
try{
 await db.query('set check_function_bodies=off; set timezone=\'UTC\'');
 for(const t of metadata.tables)await db.query(`create table ${qn(t.schema,t.name)} (${t.columns.map(c=>`${qi(c.name)} ${c.type}${c.default?` default ${c.default}`:''}${c.notNull?' not null':''}`).join(',')})`);
 for(const c of [...metadata.constraints].sort((a,b)=>(a.type==='f')-(b.type==='f')))await db.query(`alter table ${qn(c.schema,c.table)} add constraint ${qi(c.name)} ${c.definition}`);
 for(const sql of metadata.indexes)await db.query(sql);
 for(const f of metadata.functions){await db.query(f.definition);await db.query(`alter function ${f.signature} owner to ${qi(f.owner)}`);await acl(f.effectiveAcl,'function',f.signature);}
 for(const p of metadata.policies)await db.query(`create policy ${qi(p.policyname)} on ${qn(p.schemaname,p.tablename)} as ${p.permissive} for ${p.cmd} to ${p.roles.map(r=>r==='public'?'public':qi(r)).join(',')}${p.qual?` using (${p.qual})`:''}${p.with_check?` with check (${p.with_check})`:''}`);
 for(const t of metadata.tables){const target=qn(t.schema,t.name);await db.query(`alter table ${target} owner to ${qi(t.owner)}`);await acl(t.effectiveAcl,'table',target);if(t.rls)await db.query(`alter table ${target} enable row level security`);if(t.force)await db.query(`alter table ${target} force row level security`);}
 await acl(metadata.schema_acl.acl,'schema','public');
 await db.query('create schema other_application_review; create table other_application_review.sentinel(id integer primary key,value text); insert into other_application_review.sentinel values(1,\'unchanged synthetic fixture\'); alter table other_application_review.sentinel enable row level security;');
 const otherFingerprint=async()=>JSON.stringify((await db.query("select to_jsonb(c) structure,pg_get_userbyid(c.relowner) owner,(select jsonb_agg(to_jsonb(s)) from other_application_review.sentinel s) rows from pg_class c where c.oid='other_application_review.sentinel'::regclass")).rows);
 const beforeOther=await otherFingerprint();
 await db.query("insert into users(telegram_id,first_name,language_code,lifetime_access,active_until) values($1,'Synthetic QA','en',false,null),($2,'Synthetic Lifetime','ru',true,null)",[user,lifetime]);
 await db.query("insert into moon_gardens(telegram_id,moon_seeds_available,moon_seeds_earned_total,garden_level,planted_garden_elements) values($1,123,123,0,'[]'::jsonb)",[lifetime]);
 await db.query("insert into categories(name,slug) values('Synthetic category','qa')");
 await db.query("insert into meditations(id,title,description,category,duration,cover_image,audio_file,mood,published) values($1,'Synthetic practice','QA only','qa',100,'https://example.invalid/cover','https://example.invalid/audio','Calm',true)",[meditation]);
 await db.query("insert into ai_conversations(id,telegram_id,title) values($1,$2,'Synthetic preserved conversation')",[conversation,user]);
 await db.query("insert into payments(telegram_id,plan,amount_stars,status,telegram_payment_charge_id) values($1,'lifetime',2499,'paid','synthetic-payment-no-external-transaction')",[lifetime]);
 const oldRows=async()=>JSON.stringify((await db.query("select (select jsonb_agg(to_jsonb(u) order by telegram_id) from users u) users,(select jsonb_agg(to_jsonb(g)) from moon_gardens g) garden,(select jsonb_agg(to_jsonb(p)) from payments p) payments,(select jsonb_agg(to_jsonb(a)) from ai_conversations a) conversations")).rows);
 const initialRows=await oldRows();
 await check('three additive migrations apply to fresh exact production schema',async()=>{for(const sql of migrationSql)await db.query(sql);});
 await check('hardening applies with service_role BYPASSRLS and existing RPC signatures',()=>db.query(security));
 await check('all four migrations are repeatable',async()=>{for(const sql of migrationSql)await db.query(sql);await db.query(security);});
 await check('migration DDL preserves users, Lifetime, Moon Seeds, payments and conversations exactly',async()=>assert.equal(await oldRows(),initialRows));
 await check('unrelated application sentinel schema/RLS/data unchanged',async()=>assert.equal(await otherFingerprint(),beforeOther));
 const newTables=['luna_garden_purchases','luna_personal_profiles','luna_tarot_readings','luna_tarot_daily_usage','luna_tarot_global_usage','luna_tarot_attempts'];
 for(const r of ['anon','authenticated']){
  await check(`${r}: direct private tables and RPC calls denied`,()=>role(r,async()=>{
   for(const table of [...newTables,'playback_sessions'])await denied(`select * from public.${qi(table)}`);
   await denied('select public.increment_meditation_play_count($1)',[meditation]);
   await denied('select * from public.reserve_luna_chat_request($1,$2,8,$3)',[user,'unauthorized',conversation]);
   await denied('select public.luna_mutate_garden($1,\'purchase\',\'first_bloom\')',[lifetime]);
   await denied('select public.reserve_luna_tarot_reading($1,$2,$3,\'the-fool\',\'upright\',\'general\',\'QA\',\'en\',true,2,200)',[user,randomUUID(),'a'.repeat(64)]);
   await denied('alter table public.playback_sessions disable row level security');
   await denied('set role service_role');
  }));
  await check(`${r}: row_security=off cannot bypass grants/RLS`,()=>role(r,async()=>{await db.query('set row_security=off');try{await denied('select * from playback_sessions');}finally{await db.query('reset row_security');}}));
 }
 await check('restrictive playback RLS blocks accidental permissive policy/grant',async()=>{
  await db.query('begin; grant select,insert on playback_sessions to anon,authenticated; create policy review_accidental_allow on playback_sessions for all to anon,authenticated using(true) with check(true)');
  await db.query('insert into playback_sessions(telegram_id,meditation_id) values($1,$2)',[user,meditation]);
  await db.query('set local role anon');assert.equal((await db.query('select * from playback_sessions')).rowCount,0);await denied('insert into playback_sessions(telegram_id,meditation_id) values($1,$2)',[user,meditation]);await db.query('rollback');
 });
 await check('service_role: playback, meditation play count and existing AI quota RPC work',()=>role('service_role',async()=>{
  const {rows:[session]}=await db.query('insert into playback_sessions(telegram_id,meditation_id) values($1,$2) returning id',[user,meditation]);
  assert.equal((await db.query('update playback_sessions set listened_seconds=95,completed_at=now() where id=$1 returning id',[session.id])).rowCount,1);
  await db.query('select public.increment_meditation_play_count($1)',[meditation]);
  const argumentsList=[user,'synthetic-compatibility',conversation];
  const first=(await db.query('select * from public.reserve_luna_chat_request($1,$2,8,$3)',argumentsList)).rows[0];
  const repeat=(await db.query('select * from public.reserve_luna_chat_request($1,$2,8,$3)',argumentsList)).rows[0];
  assert.equal(first.acquired,true);assert.equal(first.remaining,7);assert.equal(repeat.acquired,false);
  await denied('delete from playback_sessions');
 }));
 await check('parallel garden purchase charges exactly once; existing price stays 10',async()=>{
  const clients=await Promise.all([0,1].map(async()=>{const c=new Client({...config,database:dbname});await c.connect();await c.query('set role service_role');return c;}));
  try{const results=await Promise.all(clients.map(c=>c.query("select public.luna_mutate_garden($1,'purchase','first_bloom') result",[lifetime])));assert.deepEqual(results.map(r=>r.rows[0].result.status).sort(),['ok','owned']);}finally{await Promise.all(clients.map(c=>c.end()));}
  assert.equal((await db.query('select moon_seeds_available from moon_gardens where telegram_id=$1',[lifetime])).rows[0].moon_seeds_available,113);
  assert.equal((await db.query('select count(*)::int n,sum(cost)::int spent from luna_garden_purchases')).rows[0].spent,10);
 });
 await check('premium garden allocation remains one-time and existing Lifetime entitlement survives',()=>role('service_role',async()=>{
  const a=(await db.query("select public.luna_mutate_garden($1,'premium') r",[lifetime])).rows[0].r;
  const b=(await db.query("select public.luna_mutate_garden($1,'premium') r",[lifetime])).rows[0].r;assert.equal(a.status,'ok');assert.equal(b.status,'owned');assert.equal(b.garden.moon_seeds_available,153);
  assert.equal((await db.query('select lifetime_access from users where telegram_id=$1',[lifetime])).rows[0].lifetime_access,true);
 }));
 const clientId=randomUUID();const request=[user,clientId,'a'.repeat(64),'the-fool','reversed','growth','Synthetic QA: how can I take a small next step?','ru',true,1,10];
 const reserve='select public.reserve_luna_tarot_reading($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) r';
 let reading;
 await check('Tarot acquires one generation and persists a result; no Moon Seeds charge',()=>role('service_role',async()=>{
  const before=(await db.query('select moon_seeds_available from moon_gardens where telegram_id=$1',[lifetime])).rows[0].moon_seeds_available;
  const first=(await db.query(reserve,request)).rows[0].r;assert.equal(first.acquired,true);reading=first.reading;
  await db.query("update luna_tarot_readings set status='ready',interpretation=$1::jsonb where id=$2 and telegram_id=$3",[JSON.stringify({summary:'Synthetic cached interpretation — not a real AI response'}),reading.id,user]);
  const reopen=(await db.query(reserve,request)).rows[0].r;assert.equal(reopen.acquired,false);assert.equal(reopen.status,'ready');assert.equal(reopen.reading.id,reading.id);assert.equal(reopen.reading.interpretation.summary,'Synthetic cached interpretation — not a real AI response');
  assert.equal((await db.query('select used from luna_tarot_daily_usage where telegram_id=$1',[user])).rows[0].used,1);
  assert.equal((await db.query('select moon_seeds_available from moon_gardens where telegram_id=$1',[lifetime])).rows[0].moon_seeds_available,before);
 }));
 await check('changed payload with same reading ID conflicts; daily limit prevents another generation',()=>role('service_role',async()=>{
  assert.equal((await db.query(reserve,[...request.slice(0,2),'b'.repeat(64),...request.slice(3)])).rows[0].r.status,'conflict');
  const second=[...request];second[1]=randomUUID();const limited=(await db.query(reserve,second)).rows[0].r;assert.equal(limited.status,'limit');assert.equal(limited.acquired,false);
  assert.equal((await db.query('select used from luna_tarot_global_usage')).rows[0].used,1);
 }));
 await check('deleting reading retains attempt tombstone and counters; cannot regenerate deleted result',()=>role('service_role',async()=>{
  await db.query('delete from luna_tarot_readings where id=$1 and telegram_id=$2',[reading.id,user]);assert.equal((await db.query(reserve,request)).rows[0].r.status,'deleted');assert.equal((await db.query('select used from luna_tarot_daily_usage where telegram_id=$1',[user])).rows[0].used,1);
 }));
 await check('personalization defaults to no consent and is writable by server role only',()=>role('service_role',async()=>{
  await db.query("insert into luna_personal_profiles(telegram_id,interests,preferences) values($1,'{tarot}','Synthetic preference')",[user]);assert.equal((await db.query('select ai_context_consent from luna_personal_profiles where telegram_id=$1',[user])).rows[0].ai_context_consent,false);
 }));
 await check('personalization safely upgrades an earlier development schema without changing stored preferences',async()=>{
  const before=JSON.stringify((await db.query("select to_jsonb(p)-'display_name' p from luna_personal_profiles p order by telegram_id")).rows);
  assert.equal((await db.query('select count(*)::int n from luna_personal_profiles where display_name is not null')).rows[0].n,0);
  await db.query('alter table luna_personal_profiles drop column display_name');
  await db.query(migrationSql[1]);
  assert.equal(JSON.stringify((await db.query("select to_jsonb(p)-'display_name' p from luna_personal_profiles p order by telegram_id")).rows),before);
 });
 await check('optional display name never replaces verified Telegram identity',()=>role('service_role',async()=>{
  await db.query("update luna_personal_profiles set display_name='Aster' where telegram_id=$1",[user]);
  assert.equal((await db.query('select first_name from users where telegram_id=$1',[user])).rows[0].first_name,'Synthetic QA');
 }));
 await check('reviewed security rollback restores operational baseline, then hardening reapplies',async()=>{
  await db.query(rollback);assert.equal((await db.query("select relrowsecurity rls from pg_class where oid='public.playback_sessions'::regclass")).rows[0].rls,false);
  assert.equal((await db.query("select has_function_privilege('anon','public.increment_meditation_play_count(uuid)','execute') allowed")).rows[0].allowed,true);
  await db.query(security);assert.equal((await db.query("select has_function_privilege('anon','public.increment_meditation_play_count(uuid)','execute') allowed")).rows[0].allowed,false);
 });
 await check('new feature rollback is reversible without dropping data or ledgers',async()=>{
  const count=(await db.query('select count(*)::int n from luna_garden_purchases')).rows[0].n;
  await db.query('revoke execute on function public.luna_mutate_garden(bigint,text,text,integer,integer) from service_role; revoke execute on function public.reserve_luna_tarot_reading(bigint,uuid,text,text,text,text,text,text,boolean,integer,integer) from service_role');
  await role('service_role',()=>denied("select luna_mutate_garden($1,'sync')",[lifetime]));
  for(const sql of migrationSql)await db.query(sql);assert.equal((await db.query('select count(*)::int n from luna_garden_purchases')).rows[0].n,count);
 });
 await check('unrelated application unchanged after all operations and rollback',async()=>assert.equal(await otherFingerprint(),beforeOther));
 const migrationHashes=Object.fromEntries(files.map((f,i)=>[f,createHash('sha256').update(migrationSql[i]).digest('hex')]));
 migrationHashes['20261013061155_luna_security_boundary_hardening.sql']=createHash('sha256').update(security).digest('hex');
 const report={status:'PASS',schemaCapturedAt:metadata.captured_at,projectId:metadata.project_id,fixtures:'Synthetic only — no production user rows',postgres:(await db.query('select version() version')).rows[0].version,node:process.version,database:dbname,checks,preparedMigrations:files,migrationHashes,securityMigration:'20261013061155_luna_security_boundary_hardening.sql',productionMigrationsApplied:0,productionWrites:0,apiCalls:0,paymentsSent:0};
 await writeFile(resolve(root,'production-migration-review-result.json'),JSON.stringify(report,null,2)+'\n');
 console.log(`PASS ${checks.length} release database checks; zero production writes or outbound calls`);
}finally{await db.end();}
