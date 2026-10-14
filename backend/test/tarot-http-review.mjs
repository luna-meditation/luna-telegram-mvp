import assert from 'node:assert/strict';import{createHmac,randomUUID}from'node:crypto';import{spawn}from'node:child_process';import{Client}from'pg';import express from'express';
assert.equal(process.versions.node.split('.')[0],'22');
const database='postgresql://fixture_admin@127.0.0.1:55437/luna_refinement_qa';
const jwtSecret='only-local-qa-postgrest-signing-secret-not-production';
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');const payload=encode({role:'service_role',exp:Math.floor(Date.now()/1000)+1800});const header=encode({alg:'HS256',typ:'JWT'});const jwt=`${header}.${payload}.${createHmac('sha256',jwtSecret).update(`${header}.${payload}`).digest('base64url')}`;
const rest=spawn('/tmp/luna-phase1-review.tHOJho/postgrest',[],{env:{...process.env,DYLD_LIBRARY_PATH:'/tmp/luna-phase1-review.tHOJho/node_modules/@embedded-postgres/darwin-arm64/native/lib',PGRST_DB_URI:database,PGRST_DB_ANON_ROLE:'anon',PGRST_DB_SCHEMAS:'public',PGRST_JWT_SECRET:jwtSecret,PGRST_SERVER_HOST:'127.0.0.1',PGRST_SERVER_PORT:'55465'},stdio:['ignore','inherit','inherit']});
const nativeFetch=globalThis.fetch;let calls=0,fail=false;
globalThis.fetch=async(url,options)=>{
 if(String(url)==='https://api.openai.com/v1/responses'){calls++;if(fail)return new Response('{}',{status:503});return new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({summary:'QA generated reflection',cardMeaning:'QA symbolic meaning',context:'QA question context',reflection:'QA practical step',question:'QA reflection question?',continuation:null})}]}]}));}
 const target=new URL(url instanceof Request?url.url:String(url));assert.equal(target.hostname,'127.0.0.1','No production request allowed');if(target.port==='55465')target.pathname=target.pathname.replace(/^\/rest\/v1/,'');const response=await nativeFetch(url instanceof Request?new Request(target,url):target,options);if(!response.ok){const detail=await response.clone().json().catch(()=>({}));console.log('QA REST failure',response.status,detail.code,detail.message);}return response;
};
Object.assign(process.env,{BOT_TOKEN:'local-qa-bot-token',BOT_USERNAME:'local_qa',MINI_APP_URL:'http://127.0.0.1:55464',SUPABASE_URL:'http://127.0.0.1:55465',SUPABASE_SERVICE_ROLE_KEY:jwt,OPENAI_API_KEY:'local-qa-mock-only',FEATURE_TAROT_HISTORY:'true',FEATURE_TAROT_AI:'true',FEATURE_PERSONALIZATION:'true',TAROT_AI_DAILY_LIMIT:'2',TAROT_AI_GLOBAL_DAILY_LIMIT:'200',DATABASE_URL:database,RUN_MIGRATIONS:'false',ALLOW_UNVERIFIED_TELEGRAM_WEBAPP:'false'});
let server;const db=new Client({connectionString:database});
try{
 await db.connect();await db.query('set role postgres');
 const user=880030003,other=880030004;
 await db.query("insert into public.users(telegram_id,first_name) values($1,'QA only'),($2,'Other QA only') on conflict(telegram_id) do nothing",[user,other]);
 for(const table of ['luna_tarot_readings','luna_tarot_attempts','luna_tarot_daily_usage','luna_personal_profiles'])await db.query(`delete from public.${table} where telegram_id in ($1,$2)`,[user,other]);
 let ready=false;for(let attempt=0;attempt<50;attempt++){try{const r=await nativeFetch('http://127.0.0.1:55465/');if(r.ok){ready=true;break;}}catch{}await new Promise(done=>setTimeout(done,100));}assert.equal(ready,true,'Local PostgREST must start before testing');
 const {tarotRouter}=await import('../src/tarot-router.ts');const {FoundationError}=await import('../src/personalization.ts');
 // Use the actual production mount order: Tarot precedes the global parser.
 const app=express();app.use('/api/tarot',tarotRouter);app.use(express.json());app.use((error,_req,res,_next)=>res.status(error instanceof FoundationError?error.status:error.name==='ZodError'?400:500).json({code:error.code??'invalid_request'}));
 server=await new Promise(done=>{const s=app.listen(0,'127.0.0.1',()=>done(s));});const origin=`http://127.0.0.1:${server.address().port}`;
 function auth(id){const p=new URLSearchParams({user:JSON.stringify({id,first_name:'QA'}),auth_date:String(Math.floor(Date.now()/1000))});const text=[...p.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n');const secret=createHmac('sha256','WebAppData').update(process.env.BOT_TOKEN).digest();p.set('hash',createHmac('sha256',secret).update(text).digest('hex'));return p.toString();}
 async function request(path,method='GET',body,who=user){const r=await nativeFetch(origin+'/api/tarot'+path,{method,headers:{'content-type':'application/json',...(who?{'x-telegram-init-data':auth(who)}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};}
 const input={clientReadingId:randomUUID(),cardId:'the-fool',orientation:'reversed',intention:'growth',question:'Local QA question',language:'ru',generate:true};
 assert.equal((await request('/readings','POST',input,null)).status,401);assert.equal((await request('/readings','POST',{...input,telegram_id:other})).status,400);
 const generated=await request('/readings','POST',input);assert.equal(generated.status,200);assert.equal(generated.data.reading.status,'ready');assert.equal(calls,1);
 const id=generated.data.reading.id;assert.equal((await request('/readings','POST',input)).data.reading.status,'ready');assert.equal(calls,1);assert.equal((await request('/readings')).data.readings.length,1);
 assert.equal((await request(`/readings/${id}`,'GET',undefined,other)).status,404);await request(`/readings/${id}`,'DELETE',undefined,other);assert.equal((await request(`/readings/${id}`)).status,200);
 fail=true;const fallback=await request('/readings','POST',{...input,clientReadingId:randomUUID()});assert.equal(fallback.data.reading.status,'fallback');assert.equal(calls,2);
 assert.equal((await request('/readings','POST',{...input,clientReadingId:randomUUID()})).data.reason,'daily_limit');assert.equal(calls,2);
 await request(`/readings/${id}`,'DELETE');assert.equal((await request(`/readings/${id}`)).status,404);assert.equal((await request('/readings','POST',input)).status,410);assert.equal(calls,2);
 const safety=await request('/readings','POST',{...input,clientReadingId:randomUUID(),question:'I cannot breathe'});assert.equal(safety.data.reading.status,'safety');assert.equal(calls,2);
 console.log('PASS real Telegram HMAC middleware, authenticated API, PostgREST/isolated PG, ownership, cache, fallback, quotas, deletion and safety; external paid calls: 0');
}finally{if(server)await new Promise(done=>server.close(done));await db.end();rest.kill('SIGTERM');globalThis.fetch=nativeFetch;}
