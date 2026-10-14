import assert from 'node:assert/strict';
import test from 'node:test';
import {configureQaBotMenu} from './staging-bot.js';
const config = {STAGING_MODE:true,STAGING_HOST:'netlify',STAGING_SETUP_QA_BOT:true,BOT_TOKEN:'synthetic-local-only',BOT_USERNAME:'luna_staging_qa_eger_bot',MINI_APP_URL:'https://luna-staging-itfl.netlify.app'};
test('QA bot bootstrap is opt-in and cannot configure a production or different bot',async()=>{
  let calls=0;
  const denied=(async()=>{calls++;throw Error('unexpected request');}) as typeof fetch;
  for(const patch of [{STAGING_MODE:false},{STAGING_SETUP_QA_BOT:false},{STAGING_HOST:'standalone'},{BOT_USERNAME:'production_bot'},{MINI_APP_URL:'https://luna-telegram-miniapp.netlify.app'}]) {
    assert.equal(await configureQaBotMenu({...config,...patch},denied),false);
  }
  assert.equal(calls,0);
  const wrongIdentity=(async()=>{calls++;return Response.json({ok:true,result:{username:'production_bot'}});}) as typeof fetch;
  assert.equal(await configureQaBotMenu(config,wrongIdentity),false);assert.equal(calls,1);
});
test('QA menu setup only publishes the fixed private staging URL, no messages or webhook',async()=>{
  const paths:string[]=[];
  const mock=(async(url:unknown,options?:RequestInit)=>{
    const path=new URL(String(url)).pathname.split('/').pop()!;paths.push(path);
    if(path==='getMe')return Response.json({ok:true,result:{username:'luna_staging_qa_eger_bot'}});
    assert.equal(path,'setChatMenuButton');assert.equal(options?.method,'POST');
    assert.deepEqual(JSON.parse(String(options?.body)),{menu_button:{type:'web_app',text:'Open Luna QA',web_app:{url:config.MINI_APP_URL}}});
    return Response.json({ok:true});
  }) as typeof fetch;
  assert.equal(await configureQaBotMenu(config,mock),true);assert.deepEqual(paths,['getMe','setChatMenuButton']);
});
