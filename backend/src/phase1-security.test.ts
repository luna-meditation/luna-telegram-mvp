import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(process.cwd(), '..');
const migration = readFileSync(resolve(root, 'supabase/migrations/20261013061155_luna_security_boundary_hardening.sql'), 'utf8');
const rollback = readFileSync(resolve(root, 'docs/phase-1-security-hardening.md'), 'utf8');
const schema = readFileSync(resolve(root, 'database/schema.sql'), 'utf8');
const rpcRuntime = readFileSync(resolve(process.cwd(), 'src/luna-ai-rpc-migration.ts'), 'utf8');
const syncRuntime = readFileSync(resolve(process.cwd(), 'src/backend-schema-sync-migration.ts'), 'utf8');
const config = readFileSync(resolve(process.cwd(), 'src/config.ts'), 'utf8');
const envExample = readFileSync(resolve(process.cwd(), '.env.example'), 'utf8');
const db = readFileSync(resolve(process.cwd(), 'src/db.ts'), 'utf8');
const lunaAi = readFileSync(resolve(process.cwd(), 'src/luna-ai.ts'), 'utf8');

test('security migration is Luna-only, least-privilege, and contains no data mutation', () => {
  assert.match(migration, /alter table public\.playback_sessions enable row level security/);
  assert.match(migration, /revoke all privileges on table public\.playback_sessions from public, anon, authenticated, service_role/);
  assert.match(migration, /grant select, insert, update on table public\.playback_sessions to service_role/);
  assert.doesNotMatch(migration, /grant [^;]*delete[^;]*public\.playback_sessions/i);
  assert.match(migration, /as restrictive[\s\S]*to anon, authenticated[\s\S]*using \(false\)[\s\S]*with check \(false\)/);
  assert.match(migration, /alter function public\.increment_meditation_play_count\(uuid\)[\s\S]*set search_path = ''/);
  assert.match(migration, /alter function public\.reserve_luna_chat_request\(bigint, text, integer, uuid\)[\s\S]*set search_path = ''/);
  assert.match(migration, /from public, anon, authenticated/);
  assert.match(migration, /to service_role/);
  assert.doesNotMatch(migration, /^\s*(insert into|update|delete from|truncate)\s+/gim);
  for (const protectedName of ['payments', 'moon_gardens', 'achievements', 'history', 'favorites', 'ai_conversations', 'ai_messages', 'user_memories']) {
    assert.doesNotMatch(migration, new RegExp(`public\\.${protectedName}\\b`));
  }
});

test('legitimate callers are server-side service-role paths only', () => {
  assert.match(db, /createClient\(env\.SUPABASE_URL, env\.SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(db, /\.from\('playback_sessions'\)/);
  assert.match(db, /\.rpc\('increment_meditation_play_count'/);
  assert.match(lunaAi, /\.rpc\('reserve_luna_chat_request'/);
  assert.match(rollback, /frontend does not create a Supabase client or call either RPC directly/);
});

test('canonical and runtime definitions cannot reopen the audited grants', () => {
  for (const source of [schema, rpcRuntime]) {
    assert.match(source, /set search_path = ''/);
    assert.match(source, /reserve_luna_chat_request[\s\S]*from anon, authenticated/);
    assert.match(source, /increment_meditation_play_count[\s\S]*from anon, authenticated/);
  }
  assert.match(syncRuntime, /alter table public\.playback_sessions enable row level security/);
  assert.match(syncRuntime, /grant select, insert, update on table public\.playback_sessions to service_role/);
});

test('automatic migrations and every Phase 1 backend flag default to disabled', () => {
  assert.match(config, /RUN_MIGRATIONS: envBoolean\.default\(false\)/);
  const server = readFileSync(resolve(process.cwd(), 'src/server.ts'), 'utf8');
  assert.doesNotMatch(server, /runMigrations/);
  for (const key of ['NEW_NAVIGATION', 'TAROT_DAILY', 'TAROT_SPREADS', 'ASTROLOGY', 'MOON_SEEDS_WALLET_V2', 'MOON_SEEDS_PURCHASES', 'BREATHWORK_AUDIO']) {
    assert.match(config, new RegExp(`FEATURE_${key}: envBoolean\\.default\\(false\\)`));
    assert.match(envExample, new RegExp(`^FEATURE_${key}=false$`, 'm'));
  }
});

test('rollback instructions are explicit, data-preserving, and marked emergency-only', () => {
  assert.match(rollback, /Emergency rollback/);
  assert.match(rollback, /alter table public\.playback_sessions disable row level security/);
  assert.match(rollback, /set search_path = public, pg_temp/);
  assert.match(rollback, /No data rollback is required/);
  assert.match(rollback, /deliberately reopens the audited client-role risks/);
  assert.match(rollback, /intentionally leaving generic `PUBLIC` execution revoked/);
});
