import assert from 'node:assert/strict';
import test from 'node:test';
import { logBackendError } from './error-logging.js';

test('backend error logs preserve the exception and production context', () => {
  const originalConsoleError = console.error;
  let payload: Record<string, unknown> | undefined;
  console.error = (_label: unknown, loggedPayload: Record<string, unknown>) => {
    payload = loggedPayload;
  };

  try {
    const exception = new Error('database connection failed');
    logBackendError(exception, {
      endpoint: 'GET /api/profile/me',
      requestId: 'request-123',
      telegramId: 42
    });

    assert.equal(payload?.errorMessage, 'database connection failed');
    assert.equal(payload?.stack, exception.stack);
    assert.equal(payload?.endpoint, 'GET /api/profile/me');
    assert.equal(payload?.requestId, 'request-123');
    assert.equal(payload?.telegramId, 42);
    assert.equal(payload?.originalException, exception);
  } finally {
    console.error = originalConsoleError;
  }
});

