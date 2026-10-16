import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {authorizeLuna32Smoke,luna32StagingSite,qaReadingCards} from './luna32-staging-guard.js';
test('one-shot QA command requires a matching secret, live expiry, POST and the exact staging site',()=>{
 const nonce='a'.repeat(64),now=Date.parse('2026-10-16T00:00:00Z'),options={authSha256:createHash('sha256').update(nonce).digest('hex'),expiresAt:'2026-10-16T01:00:00Z'};
 const request=(token=nonce,method='POST')=>new Request('https://luna-staging-itfl.netlify.app/.netlify/functions/luna32-qa-background',{method,headers:{authorization:'Bearer '+token}});
 assert.equal(authorizeLuna32Smoke(request(),luna32StagingSite,options,now),true);
 assert.equal(authorizeLuna32Smoke(request('b'.repeat(64)),luna32StagingSite,options,now),false);
 assert.equal(authorizeLuna32Smoke(request(nonce,'GET'),luna32StagingSite,options,now),false);
 assert.equal(authorizeLuna32Smoke(request(),'55baedc0-02e4-45ad-a0d5-0bd76ef4ce97',options,now),false);
 assert.equal(authorizeLuna32Smoke(request(),luna32StagingSite,options,Date.parse(options.expiresAt)),false);
 assert.equal(authorizeLuna32Smoke(new Request('https://example.test',{method:'POST'}),luna32StagingSite,options,now),false);
});
test('QA uses canonical single-card fields even when the spread-only cards column is empty',()=>{assert.deepEqual(qaReadingCards('single',{card_id:'the-fool',orientation:'reversed',cards:[]}),[{cardId:'the-fool',orientation:'reversed'}]);assert.equal(qaReadingCards('three',{cards:['the-fool','the-magician','the-star'].map(cardId=>({cardId,orientation:'upright'}))}).length,3);assert.throws(()=>qaReadingCards('three',{cards:[]}),/Invalid canonical/);assert.throws(()=>qaReadingCards('single',{card_id:'the-fool',orientation:'sideways'}),/Invalid canonical/);});
