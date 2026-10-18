import test from 'node:test';
import assert from 'node:assert/strict';
import {luna43CommercialCatalog,parseLuna43Catalog,seedPurchaseSchema} from './luna43-commerce-policy.js';
import type {DeepSource} from './luna43-seed-products.js';
import {resolveMembership} from './luna34-commercial-catalog.js';
import {paymentPlanDetails} from './plans.js';
Object.assign(process.env,{BOT_TOKEN:'fixture-only',BOT_USERNAME:'luna_fixture_bot',MINI_APP_URL:'https://example.invalid',SUPABASE_URL:'https://example.invalid',SUPABASE_SERVICE_ROLE_KEY:'fixture-only',REMINDER_SCHEDULER_ENABLED:'false'});
const {buildDeepAnalysisRequest,validateDeepAnalysis}=await import('./luna43-seed-products.js');

test('owner-approved new prices, not retrospective changes to legacy invoice receipts',()=>{
 const c=luna43CommercialCatalog;
 assert.deepEqual([c.weekly.stars,c.premium.monthlyStars,c.annual.stars,c.lifetime.stars],[500,1000,5000,10000]);
 assert.equal(c.weekly.recurring,false);assert.equal(c.premium.recurring,false);assert.equal(c.annual.recurring,false);
 assert.equal(paymentPlanDetails('annual').amountStars,750);assert.equal(paymentPlanDetails('lifetime').amountStars,2499);
 assert.equal(c.seedProducts.aiMessages.quantity,20);assert.equal(c.seedProducts.aiMessages.seeds,50);assert.equal(c.seedProducts.deepAnalysis.seeds,100);
 assert.equal(c.seedProducts.aiMessages.enabled,false);assert.equal(c.seedProducts.deepAnalysis.enabled,false);
});
test('Admin seed pricing can vary; unauthorized Stars/terms changes fail closed',()=>{
 const seedProducts={aiMessages:{seeds:60,quantity:25,enabled:true},deepAnalysis:{seeds:120,enabled:true}};
 assert.deepEqual(parseLuna43Catalog({...luna43CommercialCatalog,seedProducts}).seedProducts,seedProducts);
 for(const value of [{...luna43CommercialCatalog,weekly:{stars:1,days:7,recurring:false}},{...luna43CommercialCatalog,seedProducts:{...seedProducts,aiMessages:{...seedProducts.aiMessages,quantity:0}}}])assert.throws(()=>parseLuna43Catalog(value));
 assert.throws(()=>seedPurchaseSchema.parse({requestId:'bad',product:'ai_messages',expectedSeeds:50,catalogRevision:0,confirmed:false,language:'ru'}));
});
test('weekly entitlement expires exactly at its boundary, legacy Lifetime takes precedence',()=>{
 const period={start:'2026-10-18T00:00:00.000Z',end:'2026-10-25T00:00:00.000Z',days:7 as const};
 assert.equal(resolveMembership({lifetime:false,period},new Date('2026-10-24T23:59:59Z')).kind,'weekly');
 assert.equal(resolveMembership({lifetime:false,period},new Date(period.end)).kind,'free');
 assert.equal(resolveMembership({lifetime:true,period},new Date(period.end)).kind,'lifetime');
});
const sources:DeepSource[]=[{id:'confirmed_0',kind:'confirmed',label:'goal',data:{value:'Build a small prototype'}}];
const result={version:1,summary:'Your confirmed goal can become a concrete, bounded experiment.',sections:[{title:'Direction',insight:'Your prototype goal suggests choosing one testable user problem first.',basis:['confirmed_0']},{title:'Next step',insight:'A short interview can test the need before you invest in additional features.',basis:['confirmed_0']}],takeaway:'Choose one small experiment this week.',question:'Which assumption would you test first?',limitations:'This reflection uses only the one goal you confirmed.'};
test('deep analysis requires bounded confirmed/calculated evidence and preserves exact source provenance',()=>{
 const body=buildDeepAnalysisRequest({language:'en',question:'Where should I focus?',personal:null,sources});
 assert.equal(body.store,false);assert.equal(body.model,'gpt-5-mini');assert.equal(body.max_output_tokens,2400);
 assert.match(body.instructions,/symbolic, not scientifically/);assert.deepEqual(validateDeepAnalysis(result,sources),result);
 assert.throws(()=>buildDeepAnalysisRequest({language:'ru',question:'',personal:null,sources:[]}));
 assert.throws(()=>validateDeepAnalysis({...result,sections:[{...result.sections[0],basis:['foreign']},result.sections[1]]},sources));
 assert.throws(()=>validateDeepAnalysis({...result,sections:[result.sections[0],result.sections[0]]},sources));
});
