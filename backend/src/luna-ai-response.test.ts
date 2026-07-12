import assert from 'node:assert/strict';
import test from 'node:test';

process.env.BOT_TOKEN = 'test-bot-token';
process.env.BOT_USERNAME = 'luna_test_bot';
process.env.MINI_APP_URL = 'https://example.com';
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.OPENAI_API_KEY = 'test-openai-key';

const { extractOpenAiText, normalizeOpenAiModelResult } = await import('./luna-ai.js');

test('extracts Responses API output_text', () => {
  assert.deepEqual(extractOpenAiText({ output_text: '{"message":"ok"}' }), {
    text: '{"message":"ok"}',
    refusal: null
  });
});

test('extracts text from output content arrays', () => {
  assert.deepEqual(extractOpenAiText({
    output: [
      {
        type: 'message',
        content: [{ type: 'output_text', text: '{"message":"from content"}' }]
      }
    ]
  }), {
    text: '{"message":"from content"}',
    refusal: null
  });
});

test('extracts structured parsed content', () => {
  assert.deepEqual(extractOpenAiText({
    output: [
      {
        type: 'message',
        content: [{
          type: 'output_text',
          parsed: { message: 'structured', conversationTitle: null, recommendedMeditationId: null, memoryCandidates: [] }
        }]
      }
    ]
  }), {
    text: '{"message":"structured","conversationTitle":null,"recommendedMeditationId":null,"memoryCandidates":[]}',
    refusal: null
  });
});

test('extracts refusals without treating them as missing text', () => {
  assert.deepEqual(extractOpenAiText({
    output: [
      {
        type: 'message',
        content: [{ type: 'refusal', refusal: 'I cannot help with that.' }]
      }
    ]
  }), {
    text: '',
    refusal: 'I cannot help with that.'
  });
});

test('normalizes plain text OpenAI output into an assistant message', () => {
  assert.deepEqual(normalizeOpenAiModelResult({ text: 'Take one quiet breath.', refusal: null }, 'en'), {
    message: 'Take one quiet breath.',
    conversationTitle: null,
    recommendedMeditationId: null,
    memoryCandidates: []
  });
});

test('normalizes partial JSON OpenAI output with defaults', () => {
  assert.deepEqual(normalizeOpenAiModelResult({ text: '{"message":"A soft answer."}', refusal: null }, 'en'), {
    message: 'A soft answer.',
    conversationTitle: null,
    recommendedMeditationId: null,
    memoryCandidates: []
  });
});

test('normalizes fenced JSON OpenAI output', () => {
  assert.deepEqual(normalizeOpenAiModelResult({
    text: '```json\n{"message":"Fenced answer.","conversationTitle":"Evening","recommendedMeditationId":"not-a-real-id"}\n```',
    refusal: null
  }, 'en'), {
    message: 'Fenced answer.',
    conversationTitle: 'Evening',
    recommendedMeditationId: 'not-a-real-id',
    memoryCandidates: []
  });
});
