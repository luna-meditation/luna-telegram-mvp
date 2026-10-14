import test from 'node:test';
import assert from 'node:assert/strict';
import {telegramWebhookSecret,validTelegramWebhookHeader} from './telegram-webhook-policy.js';
import {validExistingPlanPayment} from './payment-policy.js';
test('webhook uses domain-separated secret, rejects missing, forged, multibyte and array headers',()=>{
 const secret=telegramWebhookSecret('synthetic-bot-token');
 assert.match(secret,/^[a-f0-9]{64}$/);
 assert.equal(validTelegramWebhookHeader(secret,secret),true);
 for(const h of [undefined,null,'',secret.slice(1),['secret'],'x'.repeat(64),'я'.repeat(64),'synthetic-bot-token'])assert.equal(validTelegramWebhookHeader(h,secret),false);
 assert.notEqual(secret,telegramWebhookSecret('other-synthetic-token'));
});
test('existing Stars conditions remain unchanged, invalid amount/currency/charge cannot grant access',()=>{
 for(const [plan,amount] of [['annual',750],['lifetime',2499],['monthly',499]] as const){
  assert.equal(validExistingPlanPayment(plan,'XTR',amount),true);
  assert.equal(validExistingPlanPayment(plan,'XTR',amount,'test-charge'),true);
  for(const [currency,total,charge] of [['USD',amount,'charge'],['XTR',amount-1,'charge'],['XTR',String(amount),'charge'],['XTR',amount,''],['XTR',amount,null]])assert.equal(validExistingPlanPayment(plan,currency,total,charge),false);
 }
});
