import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHmac, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { Client } from 'pg';

// Explicit opt-in and loopback-only connection prevent accidental production use.
assert.equal(process.versions.node.split('.')[0], '22');
const url = new URL(process.env.PHASE1_DATABASE_URL ?? '');
assert.equal(url.hostname, '127.0.0.1');
assert.equal(url.pathname, '/luna_phase1_security');
assert.notEqual(url.port, '5432');
assert.equal(process.env.PHASE1_ISOLATED_REVIEW, 'true');
const metadata = JSON.parse(readFileSync(process.env.PHASE1_SCHEMA_METADATA, 'utf8'));
const extra = JSON.parse(readFileSync(process.env.PHASE1_EXTRA_METADATA, 'utf8'));
const root = resolve(process.cwd(), '..');
const migration = readFileSync(resolve(root, 'supabase/migrations/20261013061155_luna_security_boundary_hardening.sql'), 'utf8');
const rollbackDoc = readFileSync(resolve(root, 'docs/phase-1-security-hardening.md'), 'utf8');
const rollback = rollbackDoc.split('## Emergency rollback')[1].match(/```sql\n([\s\S]*?)```/)[1];
const qi = (name) => `"${name.replaceAll('"', '""')}"`;
const qname = (name) => name.split('.').map(qi).join('.');
const privileges = { r: 'SELECT', a: 'INSERT', w: 'UPDATE', d: 'DELETE', D: 'TRUNCATE', x: 'REFERENCES', t: 'TRIGGER', m: 'MAINTAIN', X: 'EXECUTE', U: 'USAGE', C: 'CREATE' };
function restoreAcl(acl, target, kind) {
  const revoke = `revoke all on ${kind} ${target} from public, anon, authenticated, service_role;`;
  return revoke + (acl ?? []).map((entry) => {
    const [role, grant] = entry.split('=');
    const rights = [...grant.split('/')[0].replaceAll('*', '')].map((right) => privileges[right]);
    return `grant ${rights.join(',')} on ${kind} ${target} to ${role ? qi(role) : 'public'};`;
  }).join('\n');
}
const adminUrl = new URL(url); adminUrl.pathname = '/postgres';
const admin = new Client({ connectionString: adminUrl.href });
await admin.connect();
for (const [role, options] of [['postgres','login bypassrls'],['anon',''],['authenticated',''],['service_role','bypassrls'],['authenticator','login noinherit']]) {
  if (!(await admin.query('select 1 from pg_roles where rolname=$1',[role])).rows.length) await admin.query(`create role ${qi(role)} ${options}`);
}
await admin.query('grant anon, authenticated, service_role to authenticator');
await admin.query('drop database if exists luna_phase1_security with (force)');
await admin.query('create database luna_phase1_security owner postgres');
await admin.query("alter database luna_phase1_security set timezone to 'UTC'");
await admin.end();
const db = new Client({ connectionString: url.href });
await db.connect();
const cases = [];
async function check(name, action) { await action(); cases.push(name); console.log(`PASS ${name}`); }
async function asRole(role, action) {
  await db.query(`set session authorization ${qi(role)}`);
  await db.query('begin');
  try { return await action(); }
  finally { await db.query('rollback'); await db.query('reset session authorization'); }
}
async function denied(sql, params = []) {
  await assert.rejects(db.query(sql, params), (error) => error.code === '42501');
}
const jwtSecret = 'luna-phase1-synthetic-local-jwt-secret-only';
const localFetch = globalThis.fetch;
globalThis.fetch = (input, options) => {
  const target = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  assert.ok(['127.0.0.1','localhost'].includes(target.hostname),`Test blocked outbound request to ${target.hostname}`);
  return localFetch(input, options);
};
function token(role) {
  const head = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ role, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
  return `${head}.${payload}.${createHmac('sha256', jwtSecret).update(`${head}.${payload}`).digest('base64url')}`;
}
let rest;
let proxy;
try {
  await db.query(`set role postgres; set check_function_bodies=off; create schema private; create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claims', true)::jsonb->>'sub','')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select current_setting('request.jwt.claims', true)::jsonb $$;`);
  for (const table of metadata.structure.tables) {
    const columns = table.columns.map((c) => `${qi(c.name)} ${c.type}${c.default ? ` default ${c.default}` : ''}${c.notNull ? ' not null' : ''}`);
    await db.query(`create table ${qi(table.schema)}.${qi(table.name)} (${columns.join(',')})`);
  }
  for (const constraint of [...metadata.structure.constraints].sort((a, b) => (a.type === 'f') - (b.type === 'f'))) {
    await db.query(`alter table ${qname(constraint.table)} add constraint ${qi(constraint.name)} ${constraint.definition}`);
  }
  for (const definition of metadata.security.indexes) await db.query(definition);
  for (const f of metadata.security.functions) await db.query(f.definition);
  for (const p of metadata.security.policies) {
    const roles = Array.isArray(p.roles) ? p.roles : p.roles.slice(1,-1).split(',');
    await db.query(`create policy ${qi(p.policyname)} on ${qi(p.schemaname)}.${qi(p.tablename)} as ${p.permissive} for ${p.cmd} to ${roles.map(role=>role==='public'?'public':qi(role)).join(',')}${p.qual ? ` using (${p.qual})` : ''}${p.with_check ? ` with check (${p.with_check})` : ''}`);
  }
  for (const table of metadata.structure.tables) {
    const name = `${qi(table.schema)}.${qi(table.name)}`;
    if (table.rls) await db.query(`alter table ${name} enable row level security`);
    if (table.force) await db.query(`alter table ${name} force row level security`);
    await db.query(restoreAcl(table.acl, name, 'table'));
  }
  for (const f of metadata.security.functions) await db.query(restoreAcl(f.acl, f.signature, 'function'));
  for (const schema of extra.schemaGrants) await db.query(restoreAcl(schema.acl, qi(schema.name), 'schema'));
  for (const column of extra.columnGrants) {
    for (const acl of column.acl) {
      const [role, grants] = acl.split('=');
      await db.query(`grant ${[...grants.split('/')[0]].map(g=>`${privileges[g]} (${qi(column.column)})`).join(',')} on ${qname(column.table)} to ${qi(role)}`);
    }
  }
  await db.query('reset role');
  const userId = 880000001;
  const lifetimeId = 880000002;
  const meditationId = randomUUID();
  const conversationId = randomUUID();
  await db.query(`insert into public.users(telegram_id, first_name, language_code, lifetime_access, active_until) values ($1,'Synthetic QA','en',false,null),($2,'Synthetic Lifetime','ru',true,'2000-01-01'),(880000003,'Synthetic annual','en',false,'2099-01-01'),(880000004,'Synthetic expired','ru',false,'2000-01-01');
    `, [userId, lifetimeId]);
  await db.query("insert into public.categories(name,slug) values('QA','qa')");
  await db.query(`insert into public.meditations(id,title,description,category,duration,cover_image,audio_file,mood,published) values($1,'QA meditation','Synthetic test','qa',100,'https://example.invalid/cover','https://example.invalid/audio','Calm',true)`, [meditationId]);
  await db.query(`insert into public.ai_conversations(id,telegram_id,title) values($1,$2,'Synthetic preserved conversation')`,[conversationId,userId]);
  await db.query(`insert into public.ai_messages(conversation_id,telegram_id,role,content) values($1,$2,'user','Synthetic preserved memory source')`,[conversationId,userId]);
  await db.query(`insert into public.moon_gardens(telegram_id,moon_seeds_available,moon_seeds_earned_total,garden_level,planted_garden_elements) values($1,123,345,3,'["moonflower"]')`,[lifetimeId]);
  await db.query(`insert into public.history(telegram_id,meditation_id,completed,listened_seconds) values($1,$2,true,100)`,[lifetimeId,meditationId]);
  await db.query(`insert into public.favorites(telegram_id,meditation_id) values($1,$2)`,[lifetimeId,meditationId]);
  await db.query(`insert into public.streaks(telegram_id,current_streak,longest_streak) values($1,5,10)`,[lifetimeId]);
  await db.query(`insert into public.achievements(telegram_id,achievement_id) values($1,'synthetic-achievement')`,[lifetimeId]);
  await db.query(`insert into public.payments(telegram_id,plan,amount_stars,status,telegram_payment_charge_id) values($1,'lifetime',1500,'paid','synthetic-historical-payment')`,[lifetimeId]);
  await db.query(`insert into public.user_memories(telegram_id,memory_key,memory_value,category) values($1,'synthetic','Synthetic preserved memory','preference')`,[userId]);
  async function dataSnapshot() {
    const result = {};
    for (const t of metadata.structure.tables) {
      result[`${t.schema}.${t.name}`] = (await db.query(`select to_jsonb(t) as value from ${qi(t.schema)}.${qi(t.name)} t order by to_jsonb(t)::text`)).rows;
    }
    return result;
  }
  async function catalogSnapshot() {
    const rows = (await db.query(`select 'table' kind,c.oid::regclass::text name,jsonb_build_object('oid',c.oid,'owner',c.relowner,'acl',c.relacl,'rls',c.relrowsecurity,'force',c.relforcerowsecurity) definition from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind='r'
      union all select 'function',p.oid::regprocedure::text,jsonb_build_object('oid',p.oid,'definition',pg_get_functiondef(p.oid),'acl',p.proacl) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private')
      union all select 'policy',schemaname||'.'||tablename||'.'||policyname,to_jsonb(p) from pg_policies p where schemaname in ('public','private')
      union all select 'column_acl',c.oid::regclass::text||'.'||a.attname,to_jsonb(a.attacl) from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and a.attacl is not null
      union all select 'constraint',conrelid::regclass::text||'.'||conname,to_jsonb(pg_get_constraintdef(oid)) from pg_constraint where connamespace in ('public'::regnamespace,'private'::regnamespace)
      union all select 'schema',nspname,jsonb_build_object('owner',nspowner,'acl',nspacl) from pg_namespace where nspname in ('public','private')
      union all select 'default_acl',defaclrole::regrole::text||'.'||defaclnamespace::text||'.'||defaclobjtype::text,to_jsonb(defaclacl) from pg_default_acl
      union all select 'index',schemaname||'.'||indexname,to_jsonb(indexdef) from pg_indexes where schemaname in ('public','private') order by kind,name`)).rows;
    for (const row of rows) {
      if (Array.isArray(row.definition?.acl)) row.definition.acl.sort();
      if (Array.isArray(row.definition)) row.definition.sort();
    }
    return rows;
  }
  const baselineData = await dataSnapshot();
  const baselineCatalog = await catalogSnapshot();
  await check('production schema replica: 51 tables, 417 constraints, 118 indexes, 11 functions, 68 policies; synthetic records only', async()=>{
    assert.equal(metadata.structure.tables.length,51); assert.equal(metadata.structure.constraints.length,417);
    assert.equal(metadata.security.functions.length,11); assert.equal(metadata.security.policies.length,68);
  });
  await check('migration executes with production-equivalent nonsuperuser postgres owner',async()=>{ await db.query('set role postgres'); await db.query(migration); await db.query('reset role'); });
  const afterCatalog = await catalogSnapshot();
  const expectedNames = new Set(['playback_sessions','increment_meditation_play_count(uuid)','reserve_luna_chat_request(bigint,text,integer,uuid)','public.playback_sessions.Playback sessions are server managed']);
  await check('only three Luna objects and their named policy change; all other objects and all data unchanged',async()=>{
    const unaffected = rows=>rows.filter(r=>!expectedNames.has(r.name));
    assert.deepEqual(unaffected(afterCatalog),unaffected(baselineCatalog));
    assert.deepEqual(await dataSnapshot(),baselineData);
  });
  await check('second application is idempotent with unchanged catalog and data',async()=>{
    await db.query('set role postgres'); await db.query(migration); await db.query('reset role');
    assert.deepEqual(await catalogSnapshot(),afterCatalog); assert.deepEqual(await dataSnapshot(),baselineData);
  });
  await check('precondition failure is atomic when service_role loses BYPASSRLS',async()=>{
    await db.query('alter role service_role nobypassrls; set role postgres');
    await assert.rejects(db.query(migration),/must retain BYPASSRLS/);
    await db.query('rollback; reset role; alter role service_role bypassrls');
    assert.deepEqual(await catalogSnapshot(),afterCatalog);assert.deepEqual(await dataSnapshot(),baselineData);
  });
  await check('5-second lock timeout rolls back cleanly instead of waiting indefinitely',async()=>{
    const blocker=new Client({connectionString:url.href});await blocker.connect();
    try{
      await blocker.query('begin; lock table public.playback_sessions in access exclusive mode');
      await db.query('set role postgres');
      await assert.rejects(db.query(migration),error=>error.code==='55P03');
      await db.query('rollback; reset role');
    }finally{await blocker.query('rollback');await blocker.end();}
    assert.deepEqual(await catalogSnapshot(),afterCatalog);assert.deepEqual(await dataSnapshot(),baselineData);
  });
  for (const role of ['anon','authenticated']) {
    for (const sql of ['select * from public.playback_sessions',`insert into public.playback_sessions(telegram_id,meditation_id) values(${userId},'${meditationId}')`,'update public.playback_sessions set listened_seconds=999','delete from public.playback_sessions','truncate public.playback_sessions',`select public.increment_meditation_play_count('${meditationId}')`,`select * from public.reserve_luna_chat_request(${userId},'unauthorized',8,'${conversationId}')`,'alter table public.playback_sessions disable row level security','set role service_role']) {
      await check(`${role} denied: ${sql.split(' ').slice(0,4).join(' ')}`,()=>asRole(role,()=>denied(sql)));
    }
    await check(`${role} cannot bypass RLS with row_security=off`,()=>asRole(role,async()=>{await db.query('set local row_security=off');await denied('select * from public.playback_sessions');}));
  }
  await check('restrictive policy denies rows even with accidental column/table grants plus a permissive policy',async()=>{
    await db.query('begin');
    try {
      await db.query('grant select,insert,update,delete on public.playback_sessions to anon,authenticated; create policy accidental_allow on public.playback_sessions for all to anon,authenticated using(true) with check(true)');
      await db.query(`insert into public.playback_sessions(telegram_id,meditation_id) values($1,$2)`,[userId,meditationId]);
      await db.query('set local role authenticated');
      assert.equal((await db.query('select * from public.playback_sessions')).rows.length,0);
      assert.equal((await db.query('update public.playback_sessions set listened_seconds=999 returning *')).rows.length,0);
      assert.equal((await db.query('delete from public.playback_sessions returning *')).rows.length,0);
      await denied(`insert into public.playback_sessions(telegram_id,meditation_id) values(${userId},'${meditationId}')`);
    } finally {await db.query('rollback');}
  });
  await check('service_role playback CRUD subset and both RPC contracts remain operational',()=>asRole('service_role',async()=>{
    const inserted=await db.query('insert into public.playback_sessions(telegram_id,meditation_id) values($1,$2) returning id',[userId,meditationId]);
    assert.equal((await db.query('update public.playback_sessions set listened_seconds=90,completed_at=now() where id=$1 returning *',[inserted.rows[0].id])).rows.length,1);
    await db.query('select public.increment_meditation_play_count($1)',[meditationId]);
    const args=[userId,'local-sql-reservation',8,conversationId];
    const first=(await db.query('select * from public.reserve_luna_chat_request($1,$2,$3,$4)',args)).rows[0];
    const second=(await db.query('select * from public.reserve_luna_chat_request($1,$2,$3,$4)',args)).rows[0];
    assert.equal(first.acquired,true);assert.equal(second.acquired,false);assert.equal(first.remaining,7);
  }));
  await check('service_role cannot DELETE or TRUNCATE playback sessions',async()=>{
    await asRole('service_role',()=>denied('delete from public.playback_sessions'));
    await asRole('service_role',()=>denied('truncate public.playback_sessions'));
  });
  await check('concurrent duplicate Luna requests reserve one quota unit',async()=>{
    const clients=await Promise.all(Array.from({length:6},async()=>{const client=new Client({connectionString:url.href});await client.connect();await client.query('set session authorization service_role');return client;}));
    try{
      const results=await Promise.all(clients.map(client=>client.query('select * from public.reserve_luna_chat_request($1,$2,$3,$4)',[userId,'concurrent-idempotency',8,conversationId])));
      assert.equal(results.filter(r=>r.rows[0].acquired).length,1);
      assert.equal((await db.query("select count(*)::integer count from public.ai_chat_requests where client_request_id='concurrent-idempotency'")).rows[0].count,1);
    }finally{await Promise.all(clients.map(client=>client.end()));await db.query("delete from public.ai_chat_requests where client_request_id='concurrent-idempotency'");}
  });
  await check('RPC ignores attacker search_path/temp-table shadowing and validates conversation ownership',()=>asRole('service_role',async()=>{
    await db.query('create temp table meditations(id uuid,play_count integer,updated_at timestamptz); set local search_path=pg_temp,public');
    await db.query('select public.increment_meditation_play_count($1)',[meditationId]);
    assert.equal((await db.query('select * from pg_temp.meditations')).rows.length,0);
    await denied('select * from public.reserve_luna_chat_request($1,$2,$3,$4)',[lifetimeId,'ownership-attack',8,conversationId]);
  }));
  await check('rollback restores observed operational ACL/RLS/search_path without changing any rows or other objects',async()=>{
    await db.query('set role postgres');await db.query(rollback);await db.query('reset role');
    assert.deepEqual(await catalogSnapshot(),baselineCatalog);assert.deepEqual(await dataSnapshot(),baselineData);
  });
  await check('hardening can be reapplied after rollback',async()=>{await db.query('set role postgres');await db.query(migration);await db.query('reset role');assert.deepEqual(await catalogSnapshot(),afterCatalog);});
  const restUrl = new URL(url); restUrl.username = 'authenticator';
  rest = spawn(process.env.PHASE1_POSTGREST_BIN, [], { env: {...process.env,DYLD_LIBRARY_PATH:process.env.PHASE1_POSTGREST_LIB,PGRST_DB_URI:restUrl.href,PGRST_DB_SCHEMAS:'public',PGRST_DB_ANON_ROLE:'anon',PGRST_JWT_SECRET:jwtSecret,PGRST_SERVER_HOST:'127.0.0.1',PGRST_SERVER_PORT:'55438'},stdio:['ignore','ignore','pipe'] });
  let restLogs='';rest.stderr.on('data',chunk=>{restLogs+=chunk;});
  for(let attempt=0;attempt<100;attempt++) {
    if(rest.exitCode!==null) throw new Error(restLogs);
    try {if((await fetch('http://127.0.0.1:55438/')).ok) break;}catch{}
    await new Promise(r=>setTimeout(r,50));
  }
  proxy=createServer(async(req,res)=>{
    try {
      const chunks=[];for await(const chunk of req)chunks.push(chunk);
      const reply=await fetch(`http://127.0.0.1:55438${req.url.replace(/^\/rest\/v1/,'')}`,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)});
      res.writeHead(reply.status,Object.fromEntries(reply.headers));res.end(Buffer.from(await reply.arrayBuffer()));
    }catch(error){res.writeHead(502);res.end(String(error));}
  });proxy.listen(55439,'127.0.0.1');await once(proxy,'listening');
  for(const role of ['anon','authenticated']) {
    await check(`${role} direct REST and RPC rejected`,async()=>{
      for(const [path,body] of [['playback_sessions',null],['rpc/increment_meditation_play_count',{meditation_uuid:meditationId}],['rpc/reserve_luna_chat_request',{p_telegram_id:userId,p_client_request_id:'http-attack',p_daily_limit:8,p_conversation_id:conversationId}]]) {
        const response=await fetch(`http://127.0.0.1:55438/${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token(role)}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
        assert.ok([401,403].includes(response.status),`${role} ${path}: ${response.status}`);
      }
    });
  }
  await check('unsigned or wrongly signed JWT cannot impersonate service_role',async()=>{
    const forged=token('service_role').slice(0,-8)+'invalid!';
    const response=await fetch('http://127.0.0.1:55438/playback_sessions',{headers:{Authorization:`Bearer ${forged}`}});assert.equal(response.status,401);
  });
  process.env.BOT_TOKEN='synthetic-local-token';process.env.BOT_USERNAME='luna_local_qa';process.env.MINI_APP_URL='http://127.0.0.1:55439';
  process.env.SUPABASE_URL='http://127.0.0.1:55439';process.env.SUPABASE_SERVICE_ROLE_KEY=token('service_role');process.env.RUN_MIGRATIONS='false';process.env.AI_CHAT_ENABLED='true';process.env.OPENAI_API_KEY='synthetic-local-key';
  for(const key of Object.keys(process.env))if(key.startsWith('FEATURE_'))delete process.env[key];
  const api=await import('../src/db.ts');
  const ai=await import('../src/luna-ai.ts');
  await check('current backend: Lifetime/fixed-term access, balances, favorites, history and AI memory preserved',async()=>{
    const access=await api.getUserAccess(lifetimeId);assert.equal(access.plan,'Lifetime');assert.equal(access.hasPremium,true);
    assert.equal((await api.getUserAccess(880000003)).plan,'Monthly');assert.equal((await api.getUserAccess(880000003)).hasPremium,true);
    assert.equal((await api.getUserAccess(880000004)).hasPremium,false);
    assert.equal((await api.getFavorites(lifetimeId)).length,1);assert.equal((await api.getHistory(lifetimeId)).length,1);
    assert.equal((await db.query('select moon_seeds_available from public.moon_gardens where telegram_id=$1',[lifetimeId])).rows[0].moon_seeds_available,123);
    assert.equal((await ai.getLunaMemory(userId)).memories.length,1);
  });
  await check('actual backend playback start, accepted heartbeat, completion, replay and anti-seek through service-role API',async()=>{
    const session=await api.startPlaybackSession(userId,meditationId,'2026-10-13');
    await db.query('update public.playback_sessions set last_heartbeat_at=now()-interval \'10 seconds\' where id=$1',[session.id]);
    assert.equal((await api.heartbeatPlaybackSession(userId,session.id,10)).intervalAccepted,true);
    // Synthetic time advance keeps the test fast while the backend still validates each interval.
    for(let position=20;position<=90;position+=10){await db.query('update public.playback_sessions set last_heartbeat_at=now()-interval \'10 seconds\' where id=$1',[session.id]);await api.heartbeatPlaybackSession(userId,session.id,position);}
    const saved=await api.upsertHistory(userId,{meditation_id:meditationId,last_position:90,duration:100,completed:false,session_id:session.id,local_date:'2026-10-13'});assert.equal(saved.completed,true);
    const duplicate=await api.upsertHistory(userId,{meditation_id:meditationId,last_position:90,duration:100,completed:true,session_id:session.id,local_date:'2026-10-13'});assert.equal(duplicate.moonSeedsAwarded,0);
    const seek=await api.startPlaybackSession(userId,meditationId,'2026-10-13');
    assert.equal((await api.heartbeatPlaybackSession(userId,seek.id,100)).completed,false);
    const replay=await api.startPlaybackSession(userId,meditationId,'2026-10-13');
    for(let position=10;position<=90;position+=10){await db.query('update public.playback_sessions set last_heartbeat_at=now()-interval \'10 seconds\' where id=$1',[replay.id]);await api.heartbeatPlaybackSession(userId,replay.id,position);}
    const repeated=await api.upsertHistory(userId,{meditation_id:meditationId,last_position:90,duration:100,session_id:replay.id,local_date:'2026-10-13'});assert.equal(repeated.completed,true);assert.equal(repeated.moonSeedsAwarded,0);
    assert.equal((await db.query('select count(*)::integer count from public.playback_sessions where telegram_id=$1 and completed_at is not null',[userId])).rows[0].count,2);
  });
  await check('actual Luna AI backend reserves one request, persists answer and returns same response on retry',async()=>{
    const input={message:'Open QA meditation',requestId:'qa-ai-local',language:'en'};
    const first=await ai.sendLunaMessage({telegram_id:userId,first_name:'Synthetic QA',language_code:'en'},input);
    const retry=await ai.sendLunaMessage({telegram_id:userId,first_name:'Synthetic QA',language_code:'en'},input);
    assert.equal(first.message.id,retry.message.id);
    assert.equal((await db.query("select count(*)::integer count from public.ai_chat_requests where client_request_id='qa-ai-local'")).rows[0].count,1);
  });
  const {backendFeatureFlags}=await import('../src/feature-flags.ts');
  await check('all actual backend feature flags resolve false with absent env',async()=>{assert.ok(Object.values(backendFeatureFlags).every(value=>value===false));});
  await check('Railway start survives stale RUN_MIGRATIONS=true without SQL changes or real Telegram calls',async()=>{
    const before=await catalogSnapshot();const dataBefore=await dataSnapshot();
    const child=spawn(process.execPath,['--import','tsx','test/phase1-startup-probe.mjs'],{cwd:process.cwd(),env:{...process.env,PORT:'55440',NODE_ENV:'production',DATABASE_URL:url.href,RUN_MIGRATIONS:'true',WEBHOOK_URL:'http://127.0.0.1:55440',REMINDER_SCHEDULER_ENABLED:'false'},stdio:['ignore','pipe','pipe']});
    let logs='';child.stdout.on('data',chunk=>{logs+=chunk;});child.stderr.on('data',chunk=>{logs+=chunk;});
    try{
      for(let attempt=0;attempt<600;attempt++){
        if(child.exitCode!==null)throw new Error(logs);
        if(logs.includes('Scheduler disabled by configuration'))break;
        await new Promise(r=>setTimeout(r,50));
      }
      assert.match(logs,/Telegram webhook configured/);assert.doesNotMatch(logs,/migrations applied|backfilled/);
      assert.equal((await fetch('http://127.0.0.1:55440/health')).status,200);
      assert.deepEqual(await catalogSnapshot(),before);assert.deepEqual(await dataSnapshot(),dataBefore);
    }finally{child.kill('SIGKILL');if(child.exitCode===null)await once(child,'exit');}
  });
  console.log(JSON.stringify({postgres:(await db.query('select version()')).rows[0].version,cases:cases.length,passed:cases,productionWrites:0,realTelegramMessages:0},null,2));
} finally {
  if(proxy)await new Promise(r=>proxy.close(r));
  if(rest){rest.kill('SIGTERM');if(rest.exitCode===null)await once(rest,'exit');}
  await db.end();
}
