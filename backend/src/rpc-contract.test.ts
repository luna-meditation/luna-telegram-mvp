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
const rpcMigration = readFileSync(resolve(process.cwd(), '../database/migrations/006_luna_ai_rpc_sync.sql'), 'utf8');

test('every backend RPC call has a canonical SQL function definition', () => {
  const rpcNames = [...backendSource.matchAll(/\.rpc\(\s*['"]([^'"]+)['"]/g)].map((match) => match[1]);
  assert.deepEqual([...new Set(rpcNames)].sort(), ['increment_meditation_play_count', 'reserve_luna_chat_request']);

  for (const rpcName of new Set(rpcNames)) {
    assert.match(schema, new RegExp(`create (?:or replace )?function public\\.${rpcName}\\s*\\(`));
    assert.match(rpcMigration, new RegExp(`create or replace function public\\.${rpcName}\\s*\\(`));
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
