// Real PostgreSQL functions/constraints/triggers, fresh catalog metadata, synthetic rows only.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash,randomUUID} from 'node:crypto';
import {Client,Pool} from 'pg';
import {calculateNatalChart} from '../dist/luna30-astrology-engine.js';

const exec=promisify(execFile),bin=process.env.LUNA_CORE_PG_BIN;
assert.equal(process.versions.node.split('.')[0],'22');
assert.ok(bin?.endsWith('/work/cosmos-postgres-runtime/bin'));
assert.ok(process.env.LUNA_CORE_SCHEMA?.endsWith('/luna-schema-only.json'));
globalThis.fetch=()=>{throw Error('External HTTP is forbidden in native release review');};
const raw=await readFile(process.env.LUNA_CORE_SCHEMA,'utf8'),schema=JSON.parse(raw);
const settings=JSON.parse(await readFile(process.env.LUNA_CORE_SETTINGS,'utf8'));
assert.equal(schema.project_id,'vkcdtasbdoeilgfucoax');assert.equal(schema.tables.length,91);
assert.equal(schema.functions.length,127);assert.ok(!('data' in schema));
const migrationPath=process.env.LUNA_CORE_GRANTS??'../docs/intelligence-core-v1/REVIEW-ONLY-sixteen-table-grants.sql';
const grantSql=await readFile(migrationPath,'utf8');
const review=grantSql.replace(/commit;\s*$/,'rollback;');
const promoted=review.replace(/rollback;\s*$/,'commit;');assert.notEqual(promoted,review);
const privateNames=['achievements','ai_chat_requests','ai_usage','breath_sessions','daily_checkins','favorites','history','moon_gardens','payments','practice_days','progress','streaks','users'];
const publicNames=['categories','meditations','practices'],targetNames=[...privateNames,...publicNames];
const qi=s=>'"'+s.replaceAll('"','""')+'"';
const rights={r:'select',a:'insert',w:'update',d:'delete',D:'truncate',x:'references',t:'trigger',m:'maintain',X:'execute',U:'usage',C:'create'};
const directory=await mkdtemp('/private/tmp/luna-core-release.'),data=directory+'/data';
let db,pool,started=false,pass=false;const checks=[];
const check=async(name,fn)=>{await fn();checks.push({name,status:'PASS'});console.log('PASS '+name);};
const config={host:directory,port:55459,user:'core_fixture_admin',database:'postgres'};
async function acl(kind,target,entries){
 await db.query(`revoke all privileges on ${kind} ${target} from public,${schema.roles.map(r=>qi(r.name)).join(',')}`);
 for(const entry of entries){const[principal,rest]=entry.split('=');for(const[,code,option]of rest.split('/')[0].matchAll(/([rawdDxtmXUC])(\*)?/g))await db.query(`grant ${rights[code]} on ${kind} ${target} to ${principal?qi(principal):'public'}${option?' with grant option':''}`);}
}
async function rpc(name,args){const c=await pool.connect();try{await c.query('set role service_role');return(await c.query(`select public.${name}(${Object.keys(args).map((k,i)=>k+' => $'+(i+1)).join(',')}) value`,Object.values(args).map(v=>Array.isArray(v)?JSON.stringify(v):v))).rows[0].value;}finally{await c.query('reset role');c.release();}}
const rows=async(sql,args=[])=>(await db.query(sql,args)).rows;
const a=880001001,b=880001002;
try{
 await exec(bin+'/initdb',['-D',data,'-A','trust','-U',config.user,'-E','UTF8','--no-locale']);
 await exec(bin+'/pg_ctl',['-D',data,'-l',directory+'/postgres.log','-o',`-h '' -p ${config.port} -k ${directory}`,'start']);started=true;
 db=new Client(config);await db.connect();assert.equal((await rows('show listen_addresses'))[0].listen_addresses,'');
 for(const role of schema.roles)await db.query(`create role ${qi(role.name)} nologin ${role.bypassrls?'bypassrls':'nobypassrls'} ${role.inherit?'inherit':'noinherit'}`);
 await db.query('create schema extensions;create extension pgcrypto with schema extensions;begin;set local check_function_bodies=off;set local search_path=public,extensions');
 for(const t of schema.tables)await db.query(`create table public.${qi(t.name)}(${t.columns.map(c=>`${qi(c.name)} ${c.type}${c.default?' default '+c.default:''}${c.notNull?' not null':''}`).join(',')})`);
 for(const f of schema.functions){await db.query(f.definition);await db.query(`alter function ${f.signature} owner to ${qi(f.owner)}`);}
 for(const c of [...schema.constraints].filter(c=>c.type!=='t').sort((x,y)=>(x.type==='f')-(y.type==='f')))await db.query(`alter table public.${qi(c.table)} add constraint ${qi(c.name)} ${c.definition}`);
 for(const sql of schema.indexes)await db.query(sql);
 for(const t of schema.triggers)await db.query(t.definition);
 for(const v of schema.views)await db.query(`create view public.${qi(v.name)} with(security_invoker=true) as ${v.definition}`);
 for(const p of schema.policies)await db.query(`create policy ${qi(p.policyname)} on public.${qi(p.tablename)} as ${p.permissive} for ${p.cmd} to ${p.roles.map(r=>r==='public'?'public':qi(r)).join(',')}${p.qual?' using ('+p.qual+')':''}${p.with_check?' with check ('+p.with_check+')':''}`);
 for(const t of schema.tables){await db.query(`alter table public.${qi(t.name)} owner to ${qi(t.owner)}`);await acl('table','public.'+qi(t.name),t.effectiveAcl);if(t.rls)await db.query(`alter table public.${qi(t.name)} enable row level security`);if(t.force)await db.query(`alter table public.${qi(t.name)} force row level security`);for(const c of t.columns)for(const e of c.acl??[]){const[p,r]=e.split('=');for(const[,g,o]of r.split('/')[0].matchAll(/([rawx])(\*)?/g))await db.query(`grant ${rights[g]}(${qi(c.name)}) on public.${qi(t.name)} to ${qi(p)}${o?' with grant option':''}`);}}
 for(const f of schema.functions)await acl('function',f.signature,f.effectiveAcl);
 await db.query('grant usage on schema public,extensions to anon,authenticated,service_role,postgres;commit;set search_path=public,extensions');
 pool=new Pool({...config,max:12});
 await check('real pgcrypto matches standard SHA-256 and HMAC-SHA256 test vectors',async()=>{assert.equal((await rows("select encode(extensions.digest('abc','sha256'),'hex') value"))[0].value,'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');assert.equal((await rows("select encode(extensions.hmac(convert_to('Hi There','UTF8'),decode(repeat('0b',20),'hex'),'sha256'),'hex') value"))[0].value,'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7');});
 const seededSettings={};
 for(const[name,record]of Object.entries(settings)){const keys=Object.keys(record);await db.query(`insert into public.${qi(name)}(${keys.map(qi)}) values(${keys.map((_,i)=>'$'+(i+1))})`,keys.map(k=>Array.isArray(record[k])?JSON.stringify(record[k]):record[k]));seededSettings[name]=(await rows('select to_jsonb(t) row from public.'+qi(name)+' t'))[0].row;}
 await check('all 91 Luna tables, constraints, indexes and full trigger set restore with no customer rows',async()=>{assert.equal(Number((await rows("select count(*) n from pg_class where relnamespace='public'::regnamespace and relkind='r'"))[0].n),91);assert.equal(Number((await rows("select count(*) n from pg_trigger t join pg_class c on c.oid=t.tgrelid where c.relnamespace='public'::regnamespace and not t.tgisinternal"))[0].n),schema.triggers.length);});
 await check('all 127 authoritative Luna function definitions exactly match fresh production hashes',async()=>{for(const f of schema.functions){const actual=(await rows('select md5(pg_get_functiondef($1::regprocedure)) hash',[f.signature]))[0].hash;assert.equal(actual,f.definition_md5,f.name);}});
 await db.query("insert into users(telegram_id,first_name,lifetime_access,ai_memory_enabled) values($1,'Synthetic A',false,true),($2,'Synthetic B Lifetime',true,true)",[a,b]);
 await db.query("insert into categories(name,slug) values('Synthetic category','core-qa')");
 await db.query("insert into meditations(title,description,category,duration,cover_image,audio_file,mood,published) values('Synthetic practice','Local only','core-qa',60,'/fixture.png','/fixture.wav','Calm',true)");
 await db.query("insert into practices(title,description,duration,type,access_level,audio_url) values('Synthetic practice','Local only','1 minute','meditation','free','/fixture.wav')");
 const snapshot=async()=>{const result=[];for(const t of schema.tables)result.push([t.name,await rows(`select to_jsonb(t) row from public.${qi(t.name)} t order by to_jsonb(t)::text`)]);return JSON.stringify(result);};
 const privileges=async()=>JSON.stringify(await rows("select c.relname,c.relacl::text,c.relrowsecurity,c.relforcerowsecurity from pg_class c where c.relnamespace='public'::regnamespace and c.relkind='r' order by c.relname"));
 const before=await snapshot(),beforeAcl=await privileges();
 await check('rollback-default grant proposal leaves all rows, policies and table ACLs unchanged',async()=>{await db.query(review);assert.equal(await snapshot(),before);assert.equal(await privileges(),beforeAcl);});
 await check('tested least-privilege fix applies twice while preserving all 91 tables and existing service CRUD',async()=>{await db.query(promoted);await db.query(promoted);assert.equal(await snapshot(),before);for(const t of targetNames)for(const p of ['SELECT','INSERT','UPDATE','DELETE'])assert.equal((await rows('select has_table_privilege($1,$2,$3) ok',['service_role',t,p]))[0].ok,true);});
 await check('unexpected column ACLs, policy changes or lost service rights abort the migration atomically',async()=>{const corrected=await privileges();for(const fault of ['grant select(telegram_id) on users to anon','create policy unexpected on users for select using(true)','revoke update on users from service_role']){await db.query('begin');await db.query(fault);await assert.rejects(db.query(promoted),e=>e.code==='P0001');await db.query('rollback');assert.equal(await privileges(),corrected);assert.equal(await snapshot(),before);}});
 for(const table of targetNames)await check(table+': expected SELECT access retained; browser mutation and admin privileges denied',async()=>{for(const role of ['anon','authenticated']){for(const privilege of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'])assert.equal((await rows('select has_table_privilege($1,$2,$3) ok',[role,table,privilege]))[0].ok,privilege==='SELECT'&&publicNames.includes(table));await db.query('set role '+role);await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({role:'service_role',telegram_id:a})]);if(publicNames.includes(table))assert.equal((await rows('select * from public.'+qi(table))).length,1);else await assert.rejects(db.query('select * from public.'+qi(table)),e=>e.code==='42501');await db.query('reset role');}});
 const ownedMemory=randomUUID(),foreignMemory=randomUUID();
 await db.query("insert into user_memories(id,telegram_id,category,memory_key,memory_value,confirmation_status,is_sensitive,source_type,memory_kind) values($1,$2,'reflections','synthetic_focus','Synthetic confirmed A','confirmed',false,'user_entered','symbolic'),($3,$4,'reflections','synthetic_focus','Synthetic confirmed B','confirmed',false,'user_entered','symbolic')",[ownedMemory,a,foreignMemory,b]);
 await check('confirmed memory correction/deletion retain explicit owner isolation with real foreign keys and triggers',async()=>{await db.query('begin;set local role service_role');assert.equal((await rows('update user_memories set memory_value=memory_value where id=$1 and telegram_id=$2 returning id',[foreignMemory,a])).length,0);assert.equal((await rows("update user_memories set memory_value='Synthetic corrected A',revision=revision+1 where id=$1 and telegram_id=$2 returning id",[ownedMemory,a])).length,1);assert.equal((await rows('delete from user_memories where id=$1 and telegram_id=$2 returning id',[foreignMemory,a])).length,0);await db.query('commit');});
 const calculation=calculateNatalChart({date:'2000-01-01',time:'12:00',location:{label:'Synthetic London',latitude:51.5,longitude:0,timezone:'Etc/UTC',placeId:'geonames:2643743',provider:'geonames',confirmed:true}});
 const document={version:1,projectionVersion:'luna-core-cosmos-portrait-v3:astronomy-engine-2.1.19',chart:{id:randomUUID(),calculation}};
 const args={p_owner:a,p_epoch:Number(await rpc('luna4_portrait_epoch',{p_owner:a})),p_digest:createHash('sha256').update(JSON.stringify(document)).digest('hex'),p_day:new Date().toISOString().slice(0,10),p_document:document};
 await check('twelve concurrent real chart snapshots persist one exact source revision',async()=>{const values=await Promise.all(Array.from({length:12},()=>rpc('luna4_save_portrait_snapshot',args)));assert.equal(values.filter(v=>!v.cached).length,1);assert.equal(new Set(values.map(v=>v.revision)).size,1);});
 await check('real memory invalidation trigger rejects stale saved-chart snapshots',async()=>{await db.query('delete from user_memories where id=$1 and telegram_id=$2',[ownedMemory,a]);assert.equal((await rpc('luna4_save_portrait_snapshot',args)).status,'source_changed');});
 const opening={p_owner:a,p_epoch:Number(await rpc('luna4_portrait_epoch',{p_owner:a})),p_message:randomUUID(),p_conversation:randomUUID(),p_operation:randomUUID(),p_section:'discoveries',p_language:'ru',p_content:'Synthetic source-bound reflection',p_sources:[]};
 await check('twelve contextual openings persist one conversation and reject another owner replay',async()=>{const values=await Promise.all(Array.from({length:12},()=>rpc('luna4_open_portrait_discussion',opening)));assert.equal(values.filter(v=>!v.cached).length,1);assert.equal(new Set(values.map(v=>v.conversationId)).size,1);await assert.rejects(rpc('luna4_open_portrait_discussion',{...opening,p_owner:b,p_epoch:Number(await rpc('luna4_portrait_epoch',{p_owner:b}))}),e=>e.code==='23505');});
 const pack=settings.luna34_commercial_settings.catalog.packages.find(p=>p.id==='seeds_300');assert.ok(pack);
 const request=randomUUID();let order;
 await check('twelve package preparations create one order with immutable current catalog terms',async()=>{const values=await Promise.all(Array.from({length:12},()=>rpc('luna4_prepare_order',{p_owner:a,p_request:request,p_product:pack.id,p_expected:pack.stars})));assert.equal(new Set(values.map(v=>v.order.id)).size,1);assert.equal(values.filter(v=>v.status==='pending').length,1);order=values[0].order;assert.equal(order.stars,pack.stars);assert.equal(order.seeds,pack.seeds);});
 await check('existing acceptance RPC rejects foreign-owner and changed-price callbacks',async()=>{assert.equal(await rpc('luna4_accept_order',{p_owner:b,p_order:order.id,p_stars:pack.stars,p_query:'synthetic-foreign'}),false);assert.equal(await rpc('luna4_accept_order',{p_owner:a,p_order:order.id,p_stars:pack.stars+1,p_query:'synthetic-price'}),false);assert.equal(await rpc('luna4_accept_order',{p_owner:a,p_order:order.id,p_stars:pack.stars,p_query:'synthetic-valid'}),true);});
 await check('twelve synthetic duplicate payment callbacks credit once through actual receipt/provenance/reconciliation logic',async()=>{const charge='synthetic-native:'+randomUUID(),args={p_owner:a,p_order:order.id,p_charge:charge,p_stars:pack.stars,p_expires:null,p_recurring:false},values=await Promise.all(Array.from({length:12},()=>rpc('luna34_fulfill_order',args)));assert.equal(values.filter(v=>v.status==='paid').length,1);assert.equal(values.filter(v=>v.status==='duplicate').length,11);assert.equal((await rows('select moon_seeds_available from moon_gardens where telegram_id=$1',[a]))[0].moon_seeds_available,pack.seeds);assert.equal(Number((await rows('select purchased from luna4_seed_sources where telegram_id=$1',[a]))[0].purchased),pack.seeds);assert.equal(Number((await rows('select count(*) n from luna30_commercial_receipts where order_id=$1',[order.id]))[0].n),1);});
 await check('deferred reconciliation trigger exists and historical Lifetime/financial settings are unchanged',async()=>{assert.ok(schema.triggers.some(t=>t.name==='luna4_wallet_journal_reconciliation'&&/DEFERRABLE INITIALLY DEFERRED/.test(t.definition)));assert.equal((await rows('select lifetime_access from users where telegram_id=$1',[b]))[0].lifetime_access,true);for(const[name,expected]of Object.entries(seededSettings))assert.deepEqual((await rows('select to_jsonb(t) row from public.'+qi(name)+' t'))[0].row,expected);});
 await check('all function bodies and non-target table privileges remain unchanged after the full native workflow',async()=>{for(const f of schema.functions)assert.equal((await rows('select md5(pg_get_functiondef($1::regprocedure)) hash',[f.signature]))[0].hash,f.definition_md5,f.name);const original=JSON.parse(beforeAcl).filter(r=>!targetNames.includes(r.relname)),after=JSON.parse(await privileges()).filter(r=>!targetNames.includes(r.relname));assert.deepEqual(after,original);});
 pass=true;
}catch(error){console.error(JSON.stringify({status:'FAIL',afterChecks:checks.length,error:error.message,code:error.code??null}));process.exitCode=1;}
finally{await pool?.end();await db?.end();if(started)await exec(bin+'/pg_ctl',['-D',data,'-m','fast','stop']);await rm(directory,{recursive:true,force:true});await writeFile(process.env.LUNA_CORE_DB_REPORT,JSON.stringify({status:pass?'PASS':'FAIL',schemaSha256:createHash('sha256').update(raw).digest('hex'),migrationSha256:createHash('sha256').update(grantSql).digest('hex'),tables:schema.tables.length,functions:schema.functions.length,triggers:schema.triggers.length,constraints:schema.constraints.length,indexes:schema.indexes.length,checks,productionWrites:0,copiedCustomerRows:0,providerCalls:0,realFinancialOperations:0,listenAddresses:'',clusterStopped:true,plaintextRemoved:true,scope:'Full Luna relational metadata; 27 unrelated application tables excluded and not touched. Native service-role/SQL execution is separate from positive hosted HTTP/Telegram acceptance.'},null,2));}
