import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import test from 'node:test';

const integrationEnabled = process.env.RUN_RPC_INTEGRATION_TESTS === 'true';

test('reserve_luna_chat_request executes a realistic request and is idempotent', { skip: !integrationEnabled }, async () => {
  const databaseUrl = process.env.DATABASE_URL;
  const telegramId = process.env.RPC_TEST_TELEGRAM_ID;
  if (!databaseUrl || !telegramId) {
    throw new Error('RUN_RPC_INTEGRATION_TESTS=true requires DATABASE_URL and RPC_TEST_TELEGRAM_ID.');
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false }
  });
  const requestId = `rpc-regression-${randomUUID()}`;
  const conversationId = process.env.RPC_TEST_CONVERSATION_ID || null;

  await client.connect();
  try {
    await client.query('begin');
    const first = await client.query(
      `select * from public.reserve_luna_chat_request($1::bigint, $2::text, $3::integer, $4::uuid)`,
      [telegramId, requestId, 8, conversationId]
    );
    const retry = await client.query(
      `select * from public.reserve_luna_chat_request($1::bigint, $2::text, $3::integer, $4::uuid)`,
      [telegramId, requestId, 8, conversationId]
    );

    assert.equal(first.rows.length, 1);
    assert.equal(first.rows[0].acquired, true);
    assert.equal(retry.rows.length, 1);
    assert.equal(retry.rows[0].acquired, false);
    assert.equal(retry.rows[0].quota_charged, first.rows[0].quota_charged);
  } finally {
    await client.query('rollback').catch(() => undefined);
    await client.end();
  }
});
