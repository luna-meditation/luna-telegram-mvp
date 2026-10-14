// Exact schema only; fixtures below are synthetic. Never connect to a hosted DB.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import {Client} from 'pg';
import {resolve} from 'node:path';
assert.equal(process.versions.node.split('.')[0],'22');
assert.equal(process.env.LUNA21_ISOLATED_REVIEW,'true');
const host=process.env.LUNA_RELEASE_REVIEW_SOCKET;
assert.equal(host,'/tmp/luna-backup-runtime.NXr99g/socket');
const m=JSON.parse(await readFile(process.env.LUNA_RELEASE_SCHEMA_METADATA,'utf8'));
assert.equal(m.project_id,'vkcdtasbdoeilgfucoax');assert.equal(m.tables.length,28);assert.equal(m.external_foreign_keys.length,0);
const config={host,port:55438,user:'luna_restore_admin',database:'postgres'};
const qi=n=>'"'+n.replaceAll('"','""')+'"',qn=(s,n)=>`${qi(s)}.${qi(n)}`;
const grants={r:'SELECT',a:'INSERT',w:'UPDATE',d:'DELETE',D:'TRUNCATE',x:'REFERENCES',t:'TRIGGER',m:'MAINTAIN',X:'EXECUTE',U:'USAGE',C:'CREATE'};
const root=resolve(process.cwd(),'..'),checks=[],files=['20261014141843_luna21_daily_card.sql','20261014141847_luna21_economy_foundation.sql','20261014141850_luna21_atomic_stars_fulfillment.sql','20261014142638_luna21_tarot_spreads.sql'];
const sql=await Promise.all(files.map(f=>readFile(resolve(root,'supabase/migrations',f),'utf8')));
const admin=new Client(config);await admin.connect();assert.equal((await admin.query('show listen_addresses')).rows[0].listen_addresses,'');
const dbname=`luna21_synthetic_${Date.now()}`;await admin.query(`create database ${qi(dbname)}`);await admin.end();
const db=new Client({...config,database:dbname});await db.connect();
async function acl(entries,kind,target){await db.query(`revoke all on ${kind} ${target} from public,anon,authenticated,service_role`);for(const e of entries){const eq=e.indexOf('=');for(const g of e.slice(eq+1).split('/')[0].matchAll(/([rawdDxtmXUC])(\*)?/g))await db.query(`grant ${grants[g[1]]} on ${kind} ${target} to ${e.slice(0,eq)?qi(e.slice(0,eq)):'public'}${g[2]?' with grant option':''}`);}}
async function check(name,fn){await fn();checks.push(name);console.log(`PASS ${name}`);}
async function role(name,fn){await db.query(`set session authorization ${qi(name)}`);try{return await fn();}finally{await db.query('reset session authorization');}}
async function denied(query,params=[]){await assert.rejects(db.query(query,params),e=>e.code==='42501');}
const a=880000021,b=880000022,c=880000023,med=randomUUID();
const daily=(user=a,generate=false,card='the-fool',orientation='reversed',language='ru')=>db.query('select public.reserve_luna_daily_card($1,$2,$3,$4,$5,10,200) r',[user,card,orientation,language,generate]).then(r=>r.rows[0].r);
const reward=(kind,id,user=a)=>db.query('select public.luna21_reward($1,$2,$3) r',[user,kind,id]).then(r=>r.rows[0].r);
const buy=(requestId=randomUUID(),user=a,kind='three')=>db.query('select public.luna21_buy_seed_reading($1,$2,$3) r',[user,requestId,kind]).then(r=>r.rows[0].r);
const cards=[{cardId:'the-fool',orientation:'upright'},{cardId:'the-star',orientation:'reversed'},{cardId:'the-moon',orientation:'upright'}];
const spread=(id,order=null,generate=true,user=a,hash='b'.repeat(64))=>db.query('select public.reserve_luna_tarot_spread($1,$2,$3,\'three\',$4::jsonb,\'growth\',\'Synthetic question\',\'en\',$5,$6,false,10,200) r',[user,id,hash,JSON.stringify(cards),generate,order]).then(r=>r.rows[0].r);
try{
 await db.query('set check_function_bodies=off;set timezone=\'UTC\'');
 for(const t of m.tables)await db.query(`create table ${qn(t.schema,t.name)} (${t.columns.map(c=>`${qi(c.name)} ${c.type}${c.default?` default ${c.default}`:''}${c.notNull?' not null':''}`).join(',')})`);
 for(const k of [...m.constraints].sort((a,b)=>(a.type==='f')-(b.type==='f')))await db.query(`alter table public.${qi(k.table)} add constraint ${qi(k.name)} ${k.definition}`);
 for(const statement of m.indexes)await db.query(statement);
 for(const f of m.functions){await db.query(f.definition);await db.query(`alter function ${f.signature} owner to ${qi(f.owner)}`);await acl(f.effectiveAcl,'function',f.signature);}
 for(const p of m.policies)await db.query(`create policy ${qi(p.policyname)} on public.${qi(p.tablename)} as ${p.permissive} for ${p.cmd} to ${p.roles.map(r=>r==='public'?'public':qi(r)).join(',')}${p.qual?` using (${p.qual})`:''}${p.with_check?` with check (${p.with_check})`:''}`);
 for(const t of m.tables){await db.query(`alter table public.${qi(t.name)} owner to ${qi(t.owner)}`);await acl(t.effectiveAcl,'table',`public.${qi(t.name)}`);if(t.rls)await db.query(`alter table public.${qi(t.name)} enable row level security`);if(t.force)await db.query(`alter table public.${qi(t.name)} force row level security`);}
 await acl(m.schema_acl.acl,'schema','public');
 await db.query("create schema unrelated_qa;create table unrelated_qa.sentinel(id int primary key,value text);insert into unrelated_qa.sentinel values(1,'Synthetic untouched');alter table unrelated_qa.sentinel enable row level security");
 const fingerprint=async()=>JSON.stringify((await db.query("select to_jsonb(c) structure,(select jsonb_agg(to_jsonb(s)) from unrelated_qa.sentinel s) data from pg_class c where oid='unrelated_qa.sentinel'::regclass")).rows);
 const other=await fingerprint();
 await db.query("insert into users(telegram_id,first_name,lifetime_access) values($1,'Synthetic QA',false),($2,'Synthetic Lifetime',true),($3,'Synthetic other',false)",[a,b,c]);
 await db.query("insert into moon_gardens(telegram_id,moon_seeds_available,moon_seeds_earned_total) values($1,100,100),($2,123,123)",[a,b]);
 await db.query("insert into categories(name,slug) values('Synthetic calm','calm')");
 await db.query("insert into meditations(id,title,description,category,duration,cover_image,audio_file,mood,published) values($1,'Synthetic','QA','calm',100,'https://example.invalid/image','https://example.invalid/audio','Calm',true)",[med]);
 const old=async()=>JSON.stringify((await db.query('select (select jsonb_agg(to_jsonb(u) order by telegram_id) from users u) users,(select jsonb_agg(to_jsonb(g) order by telegram_id) from moon_gardens g) garden,(select jsonb_agg(to_jsonb(p)) from payments p) payments')).rows);
 const before=await old();await db.query('set check_function_bodies=on');
 await check('four additive migrations apply; all new monetization disabled',async()=>{for(const s of sql)await db.query(s);const s=(await db.query('select * from luna21_settings')).rows[0];for(const key of ['wallet_enabled','rewards_enabled','paid_readings_enabled','premium_enabled'])assert.equal(s[key],false);assert.equal(s.monthly_premium_stars,null);assert.deepEqual(s.seed_packages,[]);});
 await check('repeat migration leaves existing balances, rights and records untouched',async()=>{for(const s of sql)await db.query(s);assert.equal(await old(),before);assert.equal(await fingerprint(),other);});
 const tables=['luna_daily_cards','luna21_settings','luna_seed_ledger','luna_reading_orders','luna_breath_proofs','luna_premium_reading_usage','luna_payment_fulfillments'];
 for(const name of ['anon','authenticated'])await check(`${name}: RLS/grants, direct RPC, role-switch, ALTER and row_security bypass denied`,()=>role(name,async()=>{
  for(const t of tables)await denied(`select * from public.${qi(t)}`);
  await denied('select reserve_luna_daily_card($1,\'the-fool\',\'upright\',\'en\',true,10,200)',[a]);
  await denied('select luna21_buy_seed_reading($1,$2,\'three\')',[a,randomUUID()]);
  await denied('select luna21_prepare_stars_reading($1,$2,\'three\')',[a,randomUUID()]);
  await denied('select luna21_claim_stars_checkout($1,$2,\'XTR\',17,\'synthetic-query\')',[a,randomUUID()]);
  await denied('select luna21_fulfill_stars_reading($1,$2,\'test\',\'XTR\',60)',[a,randomUUID()]);
  await denied('select luna21_reward($1,\'checkin\',$2)',[a,randomUUID()]);
  await denied('select luna21_analytics(30)');
  await denied('select luna21_fulfill_existing_stars($1,\'annual\',\'XTR\',750,\'synthetic\',\'\')',[a]);
  await denied('alter table public.luna_daily_cards disable row level security');await denied('set role service_role');
  await db.query('set row_security=off');try{await denied('select * from luna_daily_cards');}finally{await db.query('reset row_security');}
 }));
 await check('wallet/rewards/paid orders refuse calls while switches disabled',()=>role('service_role',async()=>{assert.equal((await buy()).status,'disabled');assert.equal((await reward('meditation',randomUUID())).status,'disabled');}));
 let day;
 await check('daily card uses UTC server day; card, orientation, language are immutable on reopen',()=>role('service_role',async()=>{day=await daily();const again=await daily(a,false,'the-star','upright','en');assert.equal(again.day,(await db.query("select (now() at time zone 'UTC')::date::text as current_day")).rows[0].current_day);assert.equal(day.reading.id,again.reading.id);assert.equal(again.reading.card_id,'the-fool');assert.equal(again.reading.orientation,'reversed');assert.equal(again.reading.language,'ru');}));
 await check('parallel daily reveals reserve one provider generation',async()=>{const clients=await Promise.all([0,1].map(async()=>{const c=new Client({...config,database:dbname});await c.connect();await c.query('set role service_role');return c;}));try{const results=await Promise.all(clients.map(c=>c.query("select reserve_luna_daily_card($1,'the-star','upright','en',true,10,200) r",[a])));assert.equal(results.filter(r=>r.rows[0].r.acquired).length,1);}finally{await Promise.all(clients.map(c=>c.end()));}});
 await check('daily result cache and deletion tombstone prevent repeat generation/reroll',()=>role('service_role',async()=>{await db.query("update luna_tarot_readings set status='ready',interpretation='{\"summary\":\"Synthetic test, not AI\"}' where id=$1",[day.reading.id]);assert.equal((await daily(a,true)).acquired,false);await db.query('delete from luna_tarot_readings where id=$1',[day.reading.id]);assert.equal((await daily(a,true)).status,'deleted');assert.equal((await db.query('select used from luna_tarot_daily_usage where telegram_id=$1',[a])).rows[0].used,1);}));
 await db.query('update luna21_settings set wallet_enabled=true,rewards_enabled=true,paid_readings_enabled=true');
 const checkin=randomUUID(),playback=randomUUID(),unverified=randomUUID(),breath=randomUUID();
 await db.query("insert into daily_checkins(id,telegram_id,mood,local_date) values($1,$2,'calm',current_date)",[checkin,a]);
 await db.query('insert into playback_sessions(id,telegram_id,meditation_id,listened_seconds,completed_at) values($1,$2,$3,90,now()),($4,$2,$3,1,now())',[playback,a,med,unverified]);
 await db.query("insert into breath_sessions(id,telegram_id,mode,duration_seconds) values($1,$2,'calm',600)",[breath,a]);
 await check('unverified playback and legacy client-reported breath durations earn nothing',()=>role('service_role',async()=>{assert.equal((await reward('meditation',unverified)).status,'unverified');assert.equal((await reward('breath',breath)).status,'unverified');assert.equal((await reward('checkin',checkin,c)).status,'unverified');}));
 await check('first verified meditation +3, checkin +1; repeated/different source same day earns nothing',()=>role('service_role',async()=>{assert.equal((await reward('meditation',playback)).awarded,3);assert.equal((await reward('checkin',checkin)).awarded,1);assert.equal((await reward('meditation',playback)).status,'duplicate');assert.equal((await reward('checkin',checkin)).status,'duplicate');}));
 const proof=randomUUID();await db.query("insert into luna_breath_proofs(id,telegram_id,mode,duration_seconds,started_at,verified_seconds,completed_at) values($1,$2,'calm',60,now()-interval '60 seconds',60,now())",[proof,a]);
 await check('verified breath +1 and aggregate regular cap 5 is server authoritative',()=>role('service_role',async()=>{assert.equal((await reward('breath',proof)).awarded,1);assert.equal((await db.query("select sum(delta)::int n from luna_seed_ledger where telegram_id=$1 and kind in ('meditation','breath','checkin')",[a])).rows[0].n,5);assert.equal((await reward('breath',proof)).status,'duplicate');}));
 await check('one bonus for each seven active server days, separate from regular cap',async()=>{
  for(let i=1;i<=6;i++)await db.query("insert into luna_seed_ledger(telegram_id,event_key,kind,delta,balance_after,reward_day) values($1,$2,'checkin',1,100,current_date-$3::int)",[c,`synthetic-history:${i}`,i]);
  const x=randomUUID(),y=randomUUID();await db.query("insert into daily_checkins(id,telegram_id,mood,local_date) values($1,$2,'calm',current_date)",[x,c]);await db.query('insert into moon_gardens(telegram_id,moon_seeds_available,moon_seeds_earned_total) values($1,10,10)',[c]);
  const first=await reward('checkin',x,c);assert.equal(first.bonus,10);
  await db.query('insert into playback_sessions(id,telegram_id,meditation_id,listened_seconds,completed_at) values($1,$2,$3,90,now())',[y,c,med]);assert.equal((await reward('meditation',y,c)).bonus,0);
 });
 const orderKey=randomUUID();let order;
 await check('Seeds order is atomic and idempotent; concurrent repeat cannot double debit',async()=>{order=(await buy(orderKey)).order;assert.equal(order.amount,60);const again=await buy(orderKey);assert.equal(again.status,'duplicate');assert.equal(again.order.id,order.id);assert.equal((await buy(orderKey,a,'five')).status,'conflict');assert.equal((await db.query("select count(*)::int n from luna_seed_ledger where kind='reading_purchase' and telegram_id=$1",[a])).rows[0].n,1);});
 await check('insufficient balance never creates an order, negative balance or partial debit',async()=>{const balance=(await db.query('select moon_seeds_available from moon_gardens where telegram_id=$1',[a])).rows[0].moon_seeds_available;assert.equal((await buy(randomUUID(),a,'five')).status,'insufficient');assert.equal((await db.query('select moon_seeds_available from moon_gardens where telegram_id=$1',[a])).rows[0].moon_seeds_available,balance);});
 const failedId=randomUUID();
 await check('paid spread binds one right; AI failure preserves the right without another debit',async()=>{assert.equal((await spread(failedId,order.id)).acquired,true);await db.query("select settle_luna_tarot_spread($1,$2,'fallback',null)",[a,failedId]);const o=(await db.query('select status,client_reading_id from luna_reading_orders where id=$1',[order.id])).rows[0];assert.equal(o.status,'entitled');assert.equal(o.client_reading_id,null);});
 const successId=randomUUID();
 await check('successful spread and entitlement consumption settle atomically; cannot reuse right',async()=>{assert.equal((await spread(successId,order.id)).acquired,true);await db.query("select settle_luna_tarot_spread($1,$2,'ready',$3::jsonb)",[a,successId,JSON.stringify({summary:'Synthetic stored 3-card interpretation'})]);assert.equal((await spread(successId,order.id)).acquired,false);assert.equal((await spread(randomUUID(),order.id)).status,'access_required');assert.equal((await db.query('select status from luna_reading_orders where id=$1',[order.id])).rows[0].status,'consumed');});
 await check('changed cards with same ID conflict; duplicate identities rejected',async()=>{assert.equal((await spread(successId,order.id,true,a,'c'.repeat(64))).status,'conflict');await assert.rejects(db.query("select reserve_luna_tarot_spread($1,$2,$3,'three',$4::jsonb,'general','','en',false,null,false,10,200)",[a,randomUUID(),'a'.repeat(64),JSON.stringify([cards[0],cards[0],cards[1]])]));});
 const payment='synthetic-stars-no-external-payment';let expiry;
 await check('existing annual Stars tariff applies once with the existing one-time Premium bonus',async()=>{const r=(await db.query("select luna21_fulfill_existing_stars($1,'annual','XTR',750,$2,'') r",[a,payment])).rows[0].r;assert.equal(r.isNewPayment,true);assert.equal(r.seedsGranted,true);expiry=(await db.query('select active_until from users where telegram_id=$1',[a])).rows[0].active_until.toISOString();});
 await check('Stars replay does not extend expiry or grant Seeds again',async()=>{const r=(await db.query("select luna21_fulfill_existing_stars($1,'annual','XTR',750,$2,'') r",[a,payment])).rows[0].r;assert.equal(r.isNewPayment,false);assert.equal(r.seedsGranted,false);assert.equal((await db.query('select active_until from users where telegram_id=$1',[a])).rows[0].active_until.toISOString(),expiry);});
 await check('Stars wrong currency, amount, missing charge, owner or plan mismatch rejected',async()=>{for(const [user,plan,currency,amount,charge] of [[a,'annual','USD',750,'bad'],[a,'annual','XTR',1,'bad'],[a,'annual','XTR',750,''],[c,'annual','XTR',750,payment],[a,'monthly','XTR',499,payment]])await assert.rejects(db.query('select luna21_fulfill_existing_stars($1,$2,$3,$4,$5,\'\')',[user,plan,currency,amount,charge]));});
 let starOrder;
 await check('Stars and Seeds are independently priced; changed quote cannot charge',async()=>{
  await db.query('update luna21_settings set three_stars=17');
  const changed=(await db.query("select luna21_prepare_stars_reading($1,$2,'three',60) r",[a,randomUUID()])).rows[0].r;assert.equal(changed.status,'price_changed');
  starOrder=(await db.query("select luna21_prepare_stars_reading($1,$2,'three',17) r",[a,randomUUID()])).rows[0].r.order;
  assert.equal(starOrder.amount,17);assert.equal(starOrder.status,'pending');assert.equal((await db.query('select three_seeds from luna21_settings')).rows[0].three_seeds,60);
 });
 await check('new Stars order rejects wrong amount, currency and owner without granting access',async()=>{
  for(const [u,currency,amount] of [[a,'USD',17],[a,'XTR',60],[c,'XTR',17]])await assert.rejects(db.query('select luna21_fulfill_stars_reading($1,$2,\'synthetic-new-stars\',$3,$4)',[u,starOrder.id,currency,amount]));
  assert.equal((await db.query('select status from luna_reading_orders where id=$1',[starOrder.id])).rows[0].status,'pending');
 });
 await check('parallel distinct Stars checkouts permit only one claim; same query replay is idempotent',async()=>{
  const clients=await Promise.all([0,1].map(async()=>{const client=new Client({...config,database:dbname});await client.connect();await client.query('set role service_role');return client;}));
  try{const results=await Promise.all(clients.map((client,i)=>client.query("select luna21_claim_stars_checkout($1,$2,'XTR',17,$3) allowed",[a,starOrder.id,`synthetic-query-${i}`])));assert.equal(results.filter(r=>r.rows[0].allowed).length,1);
   const winner=(await db.query('select checkout_query_id from luna_reading_orders where id=$1',[starOrder.id])).rows[0].checkout_query_id;
   assert.equal((await db.query("select luna21_claim_stars_checkout($1,$2,'XTR',17,$3) allowed",[a,starOrder.id,winner])).rows[0].allowed,true);
   assert.equal((await db.query("select luna21_claim_stars_checkout($1,$2,'XTR',17,'another') allowed",[a,starOrder.id])).rows[0].allowed,false);
  }finally{await Promise.all(clients.map(client=>client.end()));}
 });
 await check('one verified Stars receipt creates one right; replay and paused sales preserve it',async()=>{
  const before=(await db.query('select moon_seeds_available from moon_gardens where telegram_id=$1',[a])).rows[0].moon_seeds_available;
  await db.query('update luna21_settings set paid_readings_enabled=false');
  const first=(await db.query("select luna21_fulfill_stars_reading($1,$2,'synthetic-new-stars','XTR',17) r",[a,starOrder.id])).rows[0].r;
  const repeat=(await db.query("select luna21_fulfill_stars_reading($1,$2,'synthetic-new-stars','XTR',17) r",[a,starOrder.id])).rows[0].r;
  assert.equal(first.status,'ok');assert.equal(first.order.status,'entitled');assert.equal(repeat.status,'duplicate');assert.equal((await db.query('select moon_seeds_available from moon_gardens where telegram_id=$1',[a])).rows[0].moon_seeds_available,before);
 });
 await check('existing Lifetime remains Lifetime even when receiving a valid fixed-term payment',async()=>{await db.query("select luna21_fulfill_existing_stars($1,'annual','XTR',750,'synthetic-lifetime-preserved','')",[b]);const u=(await db.query('select lifetime_access,active_until from users where telegram_id=$1',[b])).rows[0];assert.equal(u.lifetime_access,true);assert.equal(u.active_until,null);});
 await check('rollback uses switches and grants, not data deletion; migrations reapply safely',async()=>{const count=(await db.query('select count(*)::int n from luna_reading_orders')).rows[0].n;await db.query('update luna21_settings set rewards_enabled=false,paid_readings_enabled=false,premium_enabled=false;revoke execute on function reserve_luna_daily_card(bigint,text,text,text,boolean,integer,integer,date) from service_role');await role('service_role',()=>denied("select reserve_luna_daily_card($1,'the-fool','upright','en',false,10,200)",[b]));for(const s of sql)await db.query(s);assert.equal((await db.query('select count(*)::int n from luna_reading_orders')).rows[0].n,count);});
 await check('aggregate analytics contain counts and costs, not private IDs or texts',()=>role('service_role',async()=>{const r=(await db.query('select luna21_analytics(30) r')).rows[0].r;assert.equal(r.timezone,'UTC');assert.equal(r.retention.length,3);assert.equal(r.starsRevenue,1517);assert.doesNotMatch(JSON.stringify(r),/Synthetic question|8800000|telegram_id|first_name/);assert.ok(r.seedsEarned>=5);}));
 await check('other application schema/data/RLS unchanged',async()=>assert.equal(await fingerprint(),other));
 const report={status:'PASS',schemaCapturedAt:m.captured_at,projectId:m.project_id,fixtures:'synthetic only',database:dbname,checks,migrationHashes:Object.fromEntries(files.map((f,i)=>[f,createHash('sha256').update(sql[i]).digest('hex')])),productionWrites:0,realPayments:0,realAiCalls:0};
 await writeFile(resolve(root,'luna21-database-review-result.json'),JSON.stringify(report,null,2)+'\n');console.log(`PASS ${checks.length} Luna 2.1 DB checks`);
}finally{await db.end();}
