import assert from 'node:assert/strict';
import test from 'node:test';
import { paymentEligibility } from './payment-policy.js';

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
