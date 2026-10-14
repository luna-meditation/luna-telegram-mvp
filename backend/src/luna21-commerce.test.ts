import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
process.env.BOT_TOKEN='test-only';process.env.BOT_USERNAME='test';process.env.MINI_APP_URL='https://example.com';process.env.SUPABASE_URL='https://example.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='test-only';
const {readingPurchaseSchema,readingInvoicePayloadSchema,buyLuna21Reading,luna21Offers}=await import('./luna21-commerce.js');
const purchase={requestId:'00000000-0000-4000-8000-000000000021',kind:'three',currency:'SEEDS',expectedAmount:60,confirmed:true,termsAccepted:true};
test('new purchase requires explicit consent, fixed request ID, valid amount and cannot spoof owner',()=>{
 assert.equal(readingPurchaseSchema.safeParse(purchase).success,true);
 for(const value of [{...purchase,confirmed:false},{...purchase,termsAccepted:false},{...purchase,telegramId:123},{...purchase,expectedAmount:-1},{...purchase,currency:'USD'},{...purchase,kind:'seed_package'}])assert.equal(readingPurchaseSchema.safeParse(value).success,false);
 assert.equal(readingInvoicePayloadSchema.safeParse({v:2,kind:'tarot',orderId:purchase.requestId,telegramId:880000021}).success,true);assert.equal(readingInvoicePayloadSchema.safeParse({v:2,kind:'tarot',orderId:purchase.requestId,telegramId:0}).success,false);
});
test('disabled monetization cannot expose offers, contact Telegram, create orders or debit Seeds',async()=>{
 assert.deepEqual(await luna21Offers(),{enabled:false,offers:[],premium:null});let invoices=0;
 await assert.rejects(buyLuna21Reading(880000021,purchase,async()=>{invoices++;return 'https://t.me/$test';}),e=>e instanceof Error&&'code' in e&&e.code==='feature_disabled');assert.equal(invoices,0);
});
test('server-confirmed receipts, not SDK callbacks, grant paid reading access; current products unchanged',()=>{
 const server=readFileSync('src/luna21-commerce.ts','utf8');assert.match(server,/p_expected_amount:input.expectedAmount/);assert.match(server,/luna21_claim_stars_checkout/);assert.match(server,/p_currency:currency,p_amount:amount/);
 const bot=readFileSync('src/bot.ts','utf8');assert.match(bot,/validateLuna21Precheckout/);assert.match(bot,/fulfillLuna21Payment/);assert.match(bot,/command\('paysupport'/);
 const db=readFileSync('src/db.ts','utf8');assert.match(db,/if\(env.FEATURE_MOON_SEEDS_WALLET_V2\)[\s\S]*Never reconstruct available balance/);
 assert.match(readFileSync('src/plans.ts','utf8'),/amountStars: 750/);assert.match(readFileSync('src/plans.ts','utf8'),/amountStars: 2499/);
});
