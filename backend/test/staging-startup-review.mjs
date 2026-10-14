// Actual server startup contract, with synthetic QA credentials and NO cloud access.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createHmac} from 'node:crypto';
import https from 'node:https';
assert.equal(process.versions.node.split('.')[0],'22');
if(process.argv.includes('--child')){
 https.request=()=>{throw new Error('External HTTPS is forbidden in the staging startup test');};
 globalThis.fetch=()=>{throw new Error('External API access is forbidden in the staging startup test');};
 await import('../dist/server.js');
}else{
 const password='local-qa-private-stage-password-not-production';
 const token='local-qa-stage-bot-token-not-production';
 const child=spawn(process.execPath,[import.meta.filename,'--child'],{cwd:process.cwd(),env:{...process.env,
  NODE_ENV:'production',PORT:'55467',STAGING_MODE:'true',STAGING_SUPABASE_PROJECT_REF:'abcdefghijklmnopqrst',
  STAGING_ACCESS_PASSWORD:password,STAGING_TELEGRAM_IDS:'880030005',
  SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'synthetic-qa-not-real',
  BOT_TOKEN:token,BOT_USERNAME:'synthetic_qa',MINI_APP_URL:'https://stage.example.com',
  RUN_MIGRATIONS:'false',ALLOW_UNVERIFIED_TELEGRAM_WEBAPP:'false',REMINDER_SCHEDULER_ENABLED:'false',
  WEBHOOK_URL:undefined,DATABASE_URL:undefined,OPENAI_API_KEY:undefined},stdio:['ignore','pipe','pipe']});
 let logs='';child.stdout.on('data',chunk=>{logs+=chunk;});child.stderr.on('data',chunk=>{logs+=chunk;});
 const url='http://127.0.0.1:55467';
 const headers={authorization:`Basic ${Buffer.from(`luna:${password}`).toString('base64')}`};
 function auth(id){const p=new URLSearchParams({user:JSON.stringify({id,first_name:'Synthetic QA'}),auth_date:String(Math.floor(Date.now()/1000))});
  const data=[...p].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n');
  const secret=createHmac('sha256','WebAppData').update(token).digest();p.set('hash',createHmac('sha256',secret).update(data).digest('hex'));return p.toString();}
 try{
  for(let i=0;i<100&&!logs.includes('Private staging:');i++){if(child.exitCode!==null)throw new Error(logs);await new Promise(done=>setTimeout(done,50));}
  assert.match(logs,/Private staging:/);assert.doesNotMatch(logs,/webhook configured|polling|migrations applied|Scheduler/);
  assert.equal((await fetch(url+'/')).status,401);
  const frontend=await fetch(url+'/',{headers});assert.equal(frontend.status,200);
  assert.match(await frontend.text(),/telegram.org\/js\/telegram-web-app.js/);
  assert.equal(frontend.headers.get('cache-control'),'private, no-store');
  assert.equal((await fetch(url+'/health',{headers})).status,200);
  for(const path of ['/api/payments/invoice-link','/api/admin/me','/telegram/webhook']){
   assert.equal((await fetch(url+path,{method:'POST',headers:{...headers,'content-type':'application/json'},body:'{}'})).status,403);
  }
  assert.equal((await fetch(url+'/api/plans',{headers})).status,401);
  assert.equal((await fetch(url+'/api/plans',{headers:{...headers,'x-telegram-init-data':auth(880030006)}})).status,403);
  assert.equal((await fetch(url+'/api/plans',{headers:{...headers,'x-telegram-init-data':auth(880030005)}})).status,200);
  console.log('PASS actual staging server: private frontend/API, signed QA allowlist, payments/admin/webhooks off, bot/reminders/migrations off; external requests: 0');
 }finally{child.kill('SIGTERM');if(child.exitCode===null)await once(child,'exit');}
}
