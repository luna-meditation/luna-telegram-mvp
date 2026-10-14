import assert from 'node:assert/strict';
import test from 'node:test';
import {createHmac} from 'node:crypto';
import https from 'node:https';

Object.assign(process.env,{
  STAGING_MODE:'true',STAGING_HOST:'netlify',STAGING_SUPABASE_PROJECT_REF:'abcdefghijklmnopqrst',
  STAGING_TELEGRAM_IDS:'880040002',SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY:'synthetic-test-only',BOT_TOKEN:'synthetic-test-token',BOT_USERNAME:'synthetic_qa',
  MINI_APP_URL:'https://luna-staging-itfl.netlify.app',RUN_MIGRATIONS:'false',
  ALLOW_UNVERIFIED_TELEGRAM_WEBAPP:'false',REMINDER_SCHEDULER_ENABLED:'false'
});
for (const key of ['DATABASE_URL','WEBHOOK_URL','OPENAI_API_KEY','STAGING_ACCESS_PASSWORD']) delete process.env[key];
const {netlifyStagingHandler} = await import('./netlify-staging-handler.js');
const context = {site:{id:'a634a7fc-1ecb-47fa-8b43-edd81a7e3694'},ip:'127.0.0.1'};
function auth(id:number) {
  const params = new URLSearchParams({user:JSON.stringify({id,first_name:'Synthetic QA'}),auth_date:String(Math.floor(Date.now()/1000))});
  const data = [...params].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n');
  const secret = createHmac('sha256','WebAppData').update(process.env.BOT_TOKEN!).digest();
  params.set('hash',createHmac('sha256',secret).update(data).digest('hex'));
  return params.toString();
}
test('modern staging function preserves auth and routes without bot startup or cloud calls',async () => {
  const request = (path:string,headers:Record<string,string>={},method='GET',body?:string) => new Request(`https://luna-staging-itfl.netlify.app${path}`,{method,headers,body});
  const originalFetch = globalThis.fetch;
  const originalRequest = https.request;
  let externalCalls = 0;
  globalThis.fetch = async () => {externalCalls++;throw new Error('Cloud calls forbidden in adapter test');};
  https.request = (()=>{externalCalls++;throw new Error('Telegram startup forbidden in adapter test');}) as typeof https.request;
  try {
    assert.equal((await netlifyStagingHandler(request('/health'),{site:{id:'production-site'}})).status,403);
    process.env.STAGING_MODE='false';
    assert.equal((await netlifyStagingHandler(request('/health'),context)).status,403);
    process.env.STAGING_MODE='true';
    const health = await netlifyStagingHandler(request('/health'),context);
    assert.equal(health.status,200);
    assert.equal(health.headers.get('cache-control'),'private, no-store');
    assert.equal((await netlifyStagingHandler(request('/.netlify/functions/luna-staging/health'),context)).status,200);
    assert.equal((await netlifyStagingHandler(request('/api/plans'),context)).status,401);
    assert.equal((await netlifyStagingHandler(request('/api/plans',{'x-telegram-init-data':'invalid'}),context)).status,401);
    assert.equal((await netlifyStagingHandler(request('/api/plans',{'x-telegram-init-data':auth(880040003)}),context)).status,403);
    const plans = await netlifyStagingHandler(request('/api/plans',{'x-telegram-init-data':auth(880040002)}),context);
    assert.equal(plans.status,200);assert.ok(await plans.json());
    assert.equal((await netlifyStagingHandler(request('/.netlify/functions/luna-staging/api/plans',{'x-telegram-init-data':auth(880040002)}),context)).status,200);
    for (const path of ['/api/payments/invoice-link','/api/admin/me','/telegram/webhook']) {
      assert.equal((await netlifyStagingHandler(request(path,{},'POST','{}'),context)).status,403);
    }
    assert.equal((await netlifyStagingHandler(request('/api/missing',{'x-telegram-init-data':auth(880040002)}),context)).status,404);
    assert.equal((await netlifyStagingHandler(request('/api/plans',{},'POST','x'.repeat(128*1024+1)),context)).status,413);
    assert.equal(externalCalls,0);
  } finally {globalThis.fetch=originalFetch;https.request=originalRequest;}
});
