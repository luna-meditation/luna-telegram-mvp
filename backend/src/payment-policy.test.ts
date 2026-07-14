import assert from 'node:assert/strict';
import test from 'node:test';
import { paymentEligibility } from './payment-policy.js';
import { isValidTelegramInvoiceUrl, plans } from './plans.js';

test('free users can open both Telegram Stars plans', () => {
  assert.equal(paymentEligibility('Free', 'monthly').allowed, true);
  assert.equal(paymentEligibility('Free', 'lifetime').allowed, true);
});

test('monthly users cannot repurchase monthly but can upgrade to lifetime', () => {
  assert.equal(paymentEligibility('Monthly', 'monthly').allowed, false);
  assert.equal(paymentEligibility('Monthly', 'lifetime').allowed, true);
});

test('lifetime users cannot repurchase either plan', () => {
  assert.equal(paymentEligibility('Lifetime', 'monthly').allowed, false);
  assert.equal(paymentEligibility('Lifetime', 'lifetime').allowed, false);
});

test('Telegram Stars plans keep the production prices', () => {
  assert.equal(plans.monthly.amountStars, 499);
  assert.equal(plans.lifetime.amountStars, 2499);
});

test('invoice response validation accepts Telegram links and rejects arbitrary URLs', () => {
  assert.equal(isValidTelegramInvoiceUrl('https://t.me/$monthlyInvoiceToken'), true);
  assert.equal(isValidTelegramInvoiceUrl('https://telegram.me/invoice/lifetimeInvoiceToken'), true);
  assert.equal(isValidTelegramInvoiceUrl('https://example.com/payment'), false);
  assert.equal(isValidTelegramInvoiceUrl('javascript:alert(1)'), false);
  assert.equal(isValidTelegramInvoiceUrl('not a url'), false);
});
