import assert from 'node:assert/strict';
import test from 'node:test';
import { paymentEligibility } from './payment-policy.js';
import { isValidTelegramInvoiceUrl, payloadPlanFromStoredPayment, plans, storedPlanId } from './plans.js';

test('free users can open both Telegram Stars plans', () => {
  assert.equal(paymentEligibility('Free', 'annual').allowed, true);
  assert.equal(paymentEligibility('Free', 'lifetime').allowed, true);
});

test('legacy monthly users cannot stack a fixed-term plan but can upgrade to lifetime', () => {
  assert.equal(paymentEligibility('Monthly', 'annual').allowed, false);
  assert.equal(paymentEligibility('Monthly', 'lifetime').allowed, true);
});

test('lifetime users cannot repurchase either plan', () => {
  assert.equal(paymentEligibility('Lifetime', 'annual').allowed, false);
  assert.equal(paymentEligibility('Lifetime', 'lifetime').allowed, false);
});

test('Telegram Stars plans keep the production prices', () => {
  assert.equal(plans.annual.amountStars, 750);
  assert.equal(plans.annual.days, 365);
  assert.equal(plans.lifetime.amountStars, 2499);
});

test('invoice response validation accepts Telegram links and rejects arbitrary URLs', () => {
  assert.equal(isValidTelegramInvoiceUrl('https://t.me/$annualInvoiceToken'), true);
  assert.equal(isValidTelegramInvoiceUrl('https://telegram.me/invoice/lifetimeInvoiceToken'), true);
  assert.equal(isValidTelegramInvoiceUrl('https://example.com/payment'), false);
  assert.equal(isValidTelegramInvoiceUrl('javascript:alert(1)'), false);
  assert.equal(isValidTelegramInvoiceUrl('not a url'), false);
});

test('annual purchases use the legacy fixed-term storage key without losing their duration on retry', () => {
  assert.equal(storedPlanId('annual'), 'monthly');
  assert.equal(payloadPlanFromStoredPayment('monthly', 750), 'annual');
  assert.equal(payloadPlanFromStoredPayment('monthly', 499), 'monthly');
});
