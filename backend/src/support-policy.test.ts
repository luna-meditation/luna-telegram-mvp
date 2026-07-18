import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { supportRequestInputSchema, supportStatusInputSchema } from './support-policy.js';

const migration = readFileSync(new URL('../../supabase/migrations/20260718110614_premium_product_refinement.sql', import.meta.url), 'utf8');

test('support requests accept real categories and reject empty decorative submissions', () => {
  assert.equal(supportRequestInputSchema.parse({ category: 'payment', message: 'My Stars payment is not reflected.' }).category, 'payment');
  assert.equal(supportRequestInputSchema.safeParse({ category: 'feedback', message: 'short' }).success, false);
  assert.equal(supportRequestInputSchema.safeParse({ category: 'unknown', message: 'A sufficiently detailed message.' }).success, false);
});

test('admin support status is constrained', () => {
  assert.equal(supportStatusInputSchema.parse({ status: 'resolved' }).status, 'resolved');
  assert.equal(supportStatusInputSchema.safeParse({ status: 'deleted' }).success, false);
});

test('support storage is RLS-protected and only reachable through the Telegram-authenticated service backend', () => {
  assert.match(migration, /alter table public\.support_requests enable row level security/i);
  assert.match(migration, /revoke all on table public\.support_requests from anon, authenticated/i);
  assert.match(migration, /grant select, insert, update, delete on table public\.support_requests to service_role/i);
  assert.match(migration, /telegram_id bigint not null/);
});
