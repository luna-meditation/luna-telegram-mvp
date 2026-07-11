import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

process.env.BOT_TOKEN = 'test-bot-token';
process.env.BOT_USERNAME = 'luna_test_bot';
process.env.MINI_APP_URL = 'https://example.com';
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.ALLOW_UNVERIFIED_TELEGRAM_WEBAPP = 'false';

function signedInitData(userId: number) {
  const values = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: 'test-query',
    user: JSON.stringify({ id: userId, first_name: 'Luna Test', language_code: 'en' })
  });
  const check = [...values.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(process.env.BOT_TOKEN ?? '').digest();
  values.set('hash', crypto.createHmac('sha256', secret).update(check).digest('hex'));
  return values.toString();
}

test('validates signed Telegram initData and rejects tampering', async () => {
  const { validateTelegramInitData } = await import('./auth.js');
  const valid = signedInitData(123456);
  assert.equal(validateTelegramInitData(valid).telegram_id, 123456);
  assert.throws(() => validateTelegramInitData(valid.replace('Luna+Test', 'Changed+Name')), /Invalid Telegram WebApp signature/);
});
