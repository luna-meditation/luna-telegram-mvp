import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import {assertStagingIsolation, isFiniteAiMutation, privateStagingGate, stagingQaOnly, stagingTelegramIds, stagingUserRecord, type StagingConfig} from './staging-policy.js';

test('finite provider window blocks every public generation path, but permits reading saved data', () => {
  for (const path of ['/api/luna/messages','/api/luna/tools/tarot/reveal','/api/luna43/reports',
    '/api/tarot/readings/interpret','/api/astrology/charts/abc/interpret','/api/luna/voice/abc']) {
    assert.equal(isFiniteAiMutation('POST',path),true,path);
    assert.equal(isFiniteAiMutation('GET',path),false,path);
  }
  for (const path of ['/health','/api/user','/api/garden','/api/luna-malicious']) {
    assert.equal(isFiniteAiMutation('POST',path),false,path);
  }
});

const config: StagingConfig = {
  STAGING_MODE:true, STAGING_SUPABASE_PROJECT_REF:'abcdefghijklmnopqrst',
  STAGING_ACCESS_PASSWORD:'local-test-password-not-a-real-secret', STAGING_TELEGRAM_IDS:'880030005',
  SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co', MINI_APP_URL:'https://stage.example.com',
  RUN_MIGRATIONS:false, ALLOW_UNVERIFIED_TELEGRAM_WEBAPP:false, REMINDER_SCHEDULER_ENABLED:false
};

test('staging stores QA aliases, not Telegram names or handles; production is unchanged', () => {
  const user = {telegram_id:880040002,first_name:'Synthetic First',last_name:'Synthetic Last',username:'synthetic_qa',language_code:'ru'};
  assert.equal(stagingUserRecord(user,false),user);
  assert.deepEqual(stagingUserRecord(user,true),{telegram_id:880040002,first_name:'Luna QA',last_name:null,username:null,language_code:'ru'});
  assert.equal(stagingUserRecord({...user,language_code:'de'},true).language_code,'en');
});

test('staging is opt-in and requires isolated database, private access and explicit QA IDs', () => {
  assert.doesNotThrow(() => assertStagingIsolation({...config, STAGING_MODE:false, SUPABASE_URL:'https://vkcdtasbdoeilgfucoax.supabase.co'}));
  assert.doesNotThrow(() => assertStagingIsolation(config));
  for (const patch of [
    {STAGING_SUPABASE_PROJECT_REF:'vkcdtasbdoeilgfucoax',SUPABASE_URL:'https://vkcdtasbdoeilgfucoax.supabase.co'},
    {STAGING_SUPABASE_PROJECT_REF:'nwpkfjotvpdnlgrovctf',SUPABASE_URL:'https://nwpkfjotvpdnlgrovctf.supabase.co'},
    {SUPABASE_URL:'https://different.supabase.co'}, {SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co/other'},
    {DATABASE_URL:'postgresql://postgres.vkcdtasbdoeilgfucoax:ignored@example.com/postgres'},
    {STAGING_ACCESS_PASSWORD:'short'}, {STAGING_TELEGRAM_IDS:''}, {STAGING_TELEGRAM_IDS:'NaN'},
    {MINI_APP_URL:'http://stage.example.com'}, {RUN_MIGRATIONS:true},
    {ALLOW_UNVERIFIED_TELEGRAM_WEBAPP:true}, {REMINDER_SCHEDULER_ENABLED:true}, {WEBHOOK_URL:'https://example.com'}
  ]) assert.throws(() => assertStagingIsolation({...config,...patch}));
});

test('Netlify hosting is staging-only and bound to the reviewed private site', () => {
  const netlify = {...config,STAGING_HOST:'netlify' as const,STAGING_ACCESS_PASSWORD:undefined,MINI_APP_URL:'https://luna-staging-itfl.netlify.app'};
  assert.doesNotThrow(() => assertStagingIsolation(netlify));
  assert.throws(() => assertStagingIsolation({...netlify,STAGING_MODE:false}));
  assert.throws(() => assertStagingIsolation({...netlify,MINI_APP_URL:'https://luna-telegram-miniapp.netlify.app'}));
  assert.throws(() => assertStagingIsolation({...netlify,STAGING_TELEGRAM_IDS:undefined}));
});

test('staging access gate and QA allowlist reject public and non-QA access', async () => {
  const app = express();
  app.use(privateStagingGate(config.STAGING_ACCESS_PASSWORD!));
  // A test-only identity fixture, never installed in the application server.
  app.use((req,_res,next) => {
    Object.assign(req,{telegramUser:{telegram_id:Number(req.header('x-test-qa-id'))}});next();
  });
  app.use(stagingQaOnly(stagingTelegramIds(config.STAGING_TELEGRAM_IDS)));
  app.get('/',(_req,res)=>res.json({ok:true}));
  const server = app.listen(0,'127.0.0.1');
  await new Promise<void>(done => server.once('listening',done));
  const address = server.address();assert.ok(address&&typeof address==='object');
  const url = `http://127.0.0.1:${address.port}/`;
  const authorization = `Basic ${Buffer.from(`luna:${config.STAGING_ACCESS_PASSWORD}`).toString('base64')}`;
  try {
    const denied = await fetch(url);assert.equal(denied.status,401);
    assert.equal(denied.headers.get('cache-control'),'private, no-store');
    assert.match(denied.headers.get('x-robots-tag')!,/noindex/);
    assert.equal((await fetch(url,{headers:{authorization}})).status,403);
    assert.equal((await fetch(url,{headers:{authorization,'x-test-qa-id':'880030006'}})).status,403);
    assert.equal((await fetch(url,{headers:{authorization,'x-test-qa-id':'880030005'}})).status,200);
    assert.equal((await fetch(url,{headers:{authorization:'Basic broken','x-test-qa-id':'880030005'}})).status,401);
  } finally {await new Promise<void>(done => server.close(()=>done()));}
});
