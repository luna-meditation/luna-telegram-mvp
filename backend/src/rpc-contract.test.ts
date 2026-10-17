import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : entry.name.endsWith('.ts') ? [path] : [];
  });
}

const backendSource = sourceFiles(resolve(process.cwd(), 'src'))
  .map((path) => readFileSync(path, 'utf8'))
  .join('\n');
const schema = readFileSync(resolve(process.cwd(), '../database/schema.sql'), 'utf8');
const additiveMigrations = readdirSync(resolve(process.cwd(), '../supabase/migrations')).filter(name=>name.endsWith('.sql')).map(name=>readFileSync(resolve(process.cwd(),'../supabase/migrations',name),'utf8')).join('\n');
const rpcMigration = readFileSync(resolve(process.cwd(), '../database/migrations/006_luna_ai_rpc_sync.sql'), 'utf8');
const schemaSyncMigration = readFileSync(resolve(process.cwd(), '../database/migrations/007_backend_schema_sync.sql'), 'utf8');
const ambiguityFixMigration = readFileSync(resolve(process.cwd(), '../database/migrations/008_fix_luna_rpc_ambiguous_quota.sql'), 'utf8');
const dbSource = readFileSync(resolve(process.cwd(), 'src/db.ts'), 'utf8');

test('every backend RPC call has a canonical SQL function definition', () => {
  const rpcNames = [...backendSource.matchAll(/\.rpc\(\s*['"]([^'"]+)['"]/g)].map((match) => match[1]);
  assert.deepEqual([...new Set(rpcNames)].sort(), ['increment_meditation_play_count','luna21_analytics','luna21_buy_seed_reading','luna21_claim_stars_checkout','luna21_fulfill_existing_stars','luna21_fulfill_stars_reading','luna21_prepare_stars_reading','luna30_accept_order','luna30_attribute_referral','luna30_claim_astrology_report','luna30_clear_personal_profile','luna30_commercial_metrics','luna30_finish_astrology_report','luna30_fulfill_order','luna30_prepare_order','luna30_qualify_referral','luna30_record_refund','luna32_ai_used','luna32_finish_ai_operation','luna32_reserve_ai_attempt','luna32_settle_ai_attempt','luna34_accept_order','luna34_acknowledge_achievements','luna34_allowance_status','luna34_attribute_referral','luna34_breath_heartbeat','luna34_claim_due_allocations','luna34_finish_breath','luna34_fulfill_order','luna34_operating_metrics','luna34_prepare_order','luna34_qualify_referral','luna34_record_refund','luna34_reserve_allowance','luna34_settle_allowance','luna34_start_breath','luna34_sync_achievements','luna35_claim_pending_action','luna35_finish_pending_action','luna35_funnel_stats','luna35_save_commerce_turn','luna35_save_pending_action','luna40_acknowledge_ui','luna40_admin_operation','luna40_admin_operational_report','luna40_admin_overview','luna40_admin_users','luna40_finish_quota','luna40_quota_available','luna40_reserve_ai_attempt','luna40_set_language_preference','luna41_acknowledge_navigation','luna_mutate_garden','reserve_luna24_qa_ai_call','reserve_luna_chat_request','reserve_luna_daily_card','reserve_luna_tarot_reading','reserve_luna_tarot_spread','settle_luna24_qa_ai_call','settle_luna_tarot_spread']);

  for (const rpcName of new Set(rpcNames)) {
    assert.match(schema + additiveMigrations, new RegExp(`create (?:or replace )?function public\\.${rpcName}\\s*\\(`));
    assert.match(rpcMigration + additiveMigrations, new RegExp(`create or replace function public\\.${rpcName}\\s*\\(`));
  }
});

test('Luna reservation migration matches the deployed backend contract and is server-only', () => {
  assert.match(rpcMigration, /p_telegram_id\s+bigint/);
  assert.match(rpcMigration, /p_client_request_id\s+text/);
  assert.match(rpcMigration, /p_daily_limit\s+integer/);
  assert.match(rpcMigration, /p_conversation_id\s+uuid/);
  assert.match(rpcMigration, /returns table\(status text, quota_charged boolean, remaining integer, attempt_count integer, acquired boolean\)/);
  assert.match(rpcMigration, /where id = p_conversation_id and telegram_id = p_telegram_id/);
  assert.match(rpcMigration, /grant execute on function public\.reserve_luna_chat_request\(bigint, text, integer, uuid\) to service_role/);
  assert.match(rpcMigration, /revoke all on function public\.reserve_luna_chat_request\(bigint, text, integer, uuid\) from public/);
  assert.match(rpcMigration, /notify pgrst, 'reload schema'/);
});

test('schema sync covers the production drift fields and legacy check-in fallback', () => {
  assert.match(schemaSyncMigration, /alter table public\.history[\s\S]*add column if not exists listened_seconds integer/);
  assert.match(schemaSyncMigration, /add column if not exists listened_ranges jsonb/);
  assert.match(schemaSyncMigration, /alter table public\.daily_checkins[\s\S]*alter column sleep_range set default '6_8'/);
  assert.match(schemaSyncMigration, /alter column sleep_range drop not null/);
  assert.match(schemaSyncMigration, /alter column available_minutes drop not null/);
  assert.match(schemaSyncMigration, /alter table public\.playback_sessions/);
  assert.match(schemaSyncMigration, /create or replace function public\.reserve_luna_chat_request/);
  assert.match(schemaSyncMigration, /notify pgrst, 'reload schema'/);
  assert.match(dbSource, /sleep_range: input\.sleep_range \?\? existing\?\.sleep_range \?\? '6_8'/);
});

test('ambiguity fix qualifies every quota usage and preserves the RPC result contract', () => {
  assert.match(ambiguityFixMigration, /v_request public\.ai_chat_requests%rowtype/);
  assert.match(ambiguityFixMigration, /v_used_count integer/);
  assert.match(ambiguityFixMigration, /usage_row\.quota_charged/);
  assert.doesNotMatch(ambiguityFixMigration, /where[^;]*\band quota_charged\b/);
  assert.match(ambiguityFixMigration, /returns table\(status text, quota_charged boolean, remaining integer, attempt_count integer, acquired boolean\)/);
  assert.match(ambiguityFixMigration, /notify pgrst, 'reload schema'/);
});
