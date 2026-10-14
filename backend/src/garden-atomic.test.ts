import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';
const sql=readFileSync('../supabase/migrations/20261014034527_luna_garden_atomic_mutations.sql','utf8');
test('atomic garden mutation preserves real prices and closes public RPC access',()=>{
 assert.match(sql,/for update/);assert.match(sql,/security invoker set search_path=''/);assert.match(sql,/cost=10/);assert.match(sql,/p_amount:=40/);assert.match(sql,/unique\(telegram_id,element_id\)/);assert.match(sql,/from public,anon,authenticated/);assert.match(sql,/force row level security/);
});
test('garden hardening is an explicit opt-in, including every existing balance writer',()=>{
 const db=readFileSync('src/db.ts','utf8');assert.equal((db.match(/if\s*\(env.FEATURE_GARDEN_ATOMIC\)/g)??[]).length,4);assert.match(db,/gardenAtomicReady: env.FEATURE_GARDEN_ATOMIC/);
 assert.match(readFileSync('src/config.ts','utf8'),/FEATURE_GARDEN_ATOMIC: envBoolean.default\(false\)/);
 assert.match(sql,/legacy_seen/);assert.match(sql,/status','owned'/);assert.match(sql,/Rollback: first disable/);
});
