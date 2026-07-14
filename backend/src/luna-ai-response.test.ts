import assert from 'node:assert/strict';
import test from 'node:test';

process.env.BOT_TOKEN = 'test-bot-token';
process.env.BOT_USERNAME = 'luna_test_bot';
process.env.MINI_APP_URL = 'https://example.com';
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.OPENAI_API_KEY = 'test-openai-key';

const {
  buildLunaOpenAiRequest,
  classifyLunaFailure,
  extractOpenAiText,
  LunaAiError,
  normalizeOpenAiModelResult,
  resolveMeditationAction,
  retryMaxOutputTokens,
  shouldRetryOpenAiResponse
} = await import('./luna-ai.js');

test('classifies retryable and permanent request failures', () => {
  assert.deepEqual(classifyLunaFailure(new LunaAiError('timeout', 'timeout', 504)), { code: 'timeout', retryable: true });
  assert.deepEqual(classifyLunaFailure(new LunaAiError('openai_auth', 'auth', 502)), { code: 'openai_auth', retryable: false });
  assert.deepEqual(classifyLunaFailure(new LunaAiError('quota_exhausted', 'limit', 429)), { code: 'quota_exhausted', retryable: false });
});

test('extracts Responses API output_text', () => {
  assert.deepEqual(extractOpenAiText({ output_text: '{"message":"ok"}' }), {
    text: '{"message":"ok"}',
    refusal: null,
    path: 'output_text'
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
    refusal: null,
    path: 'output[0].content[0].text'
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
    refusal: null,
    path: 'output[0].content[0].parsed'
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
    refusal: 'I cannot help with that.',
    path: 'output[0].content[0].refusal'
  });
});

test('extracts text.value from Responses content', () => {
  assert.deepEqual(extractOpenAiText({
    output: [
      {
        type: 'message',
        content: [{ type: 'output_text', text: { value: 'Nested text value.' } as never }]
      }
    ]
  }), {
    text: 'Nested text value.',
    refusal: null,
    path: 'output[0].content[0].text.value'
  });
});

test('extracts output_text and input_text content fields', () => {
  assert.deepEqual(extractOpenAiText({
    output: [
      {
        type: 'message',
        content: [{ type: 'output_text', output_text: 'Direct output_text field.' } as never]
      }
    ]
  }), {
    text: 'Direct output_text field.',
    refusal: null,
    path: 'output[0].content[0].output_text'
  });

  assert.deepEqual(extractOpenAiText({
    output: [
      {
        type: 'message',
        content: [{ type: 'output_text', input_text: 'Input text fallback.' } as never]
      }
    ]
  }), {
    text: 'Input text fallback.',
    refusal: null,
    path: 'output[0].content[0].input_text'
  });
});

test('recursively extracts any nested string inside output', () => {
  assert.deepEqual(extractOpenAiText({
    output: [
      {
        type: 'message',
        content: [{ type: 'custom', deeply: { nested: { assistant: 'Found deep assistant text.' } } } as never]
      }
    ]
  }), {
    text: 'Found deep assistant text.',
    refusal: null,
    path: 'output[0].content[0].deeply.nested.assistant'
  });
});

test('does not extract instructions, catalog, schema, ids, or metadata as assistant text', () => {
  assert.throws(() => extractOpenAiText({
    instructions: 'Do not return this prompt text',
    catalog: 'Do not return catalog text',
    schema: { message: 'Do not return schema text' },
    output: [
      {
        type: 'message',
        id: 'msg_123',
        status: 'incomplete',
        metadata: { debug: 'Do not return metadata text' }
      } as never
    ]
  } as never), /no assistant text/);
});

test('detects incomplete max_output_tokens responses for a single retry', () => {
  const incomplete = {
    status: 'incomplete',
    incomplete_details: { reason: 'max_output_tokens' },
    output: []
  };
  assert.equal(shouldRetryOpenAiResponse(incomplete, null), true);
  assert.equal(retryMaxOutputTokens(2000), 4000);
  assert.equal(retryMaxOutputTokens(5000), 8192);
});

test('does not retry when assistant text exists or incomplete reason differs', () => {
  assert.equal(shouldRetryOpenAiResponse({
    status: 'incomplete',
    incomplete_details: { reason: 'max_output_tokens' }
  }, { text: 'Already found', refusal: null, path: 'output_text' }), false);
  assert.equal(shouldRetryOpenAiResponse({
    status: 'incomplete',
    incomplete_details: { reason: 'content_filter' }
  }, null), false);
});

test('handles one successful retry shape and still fails for empty retry output', () => {
  const retryResponse = { output_text: 'Retry found a calm answer.' };
  assert.deepEqual(extractOpenAiText(retryResponse), {
    text: 'Retry found a calm answer.',
    refusal: null,
    path: 'output_text'
  });
  assert.throws(() => extractOpenAiText({ output: [] }), /no assistant text/);
});

test('builds Responses request with larger output budget and minimal reasoning', () => {
  const request = buildLunaOpenAiRequest({
    language: 'en',
    catalog: [{ catalogKey: 'deep-sleep', title: 'Deep Sleep', category: 'sleep', mood: 'calm', language: 'en', premium: false, summary: 'Short' }],
    context: { profile: null },
    recent: [{ role: 'user', content: 'I need rest' }]
  });

  assert.equal(request.store, false);
  assert.equal(request.max_output_tokens, 2000);
  assert.deepEqual(request.reasoning, { effort: 'minimal' });
  assert.equal(request.text.format.type, 'json_schema');
  assert.match(request.instructions, /meditationAction/);
  assert.equal(request.input[0]?.content, 'I need rest');
  assert.ok(request.instructions.includes('"summary":"Short"'));
  assert.equal(request.instructions.includes('audio_url'), false);
  assert.equal(request.instructions.includes('translations'), false);
  assert.match(request.instructions, /Luna is a female mindfulness companion/);
  assert.match(request.instructions, /VERIFIED_PRODUCT_CAPABILITIES/);
  assert.match(request.instructions, /Default to 30-120 words/);
  assert.match(request.instructions, /team behind Luna Meditation created her/);
  assert.match(request.instructions, /Never invent navigation/);
  assert.match(request.instructions, /Never claim that a card was rendered or playback started/);
  assert.match(request.instructions, /Product copy is added by the backend only after validation/);
  assert.match(request.instructions, /guidance is requested directly in chat/);
  assert.match(request.instructions, /docs\/01_LUNA_BRAIN\.md/);
  assert.match(request.instructions, /Act immediately when intent is clear/);
  assert.match(request.instructions, /Never create a confirmation loop/);
  assert.match(request.instructions, /known user identity fields may be used only as provided/i);
  assert.match(request.instructions, /Acknowledge difficult emotion before advice/);
  assert.match(request.instructions, /Do not interrupt vulnerable moments with unrelated Premium/);
  assert.equal(request.instructions.includes('"id":"m1"'), false);
});

test('normalizes plain text OpenAI output into an assistant message', () => {
  assert.deepEqual(normalizeOpenAiModelResult({ text: 'Take one quiet breath.', refusal: null }, 'en'), {
    message: 'Take one quiet breath.',
    detectedIntent: 'chat',
    recommendationIntent: { needed: false, goal: null, preferredCatalogKey: null },
    meditationAction: null,
    conversationTitle: null,
    memoryCandidates: []
  });
});

test('normalizes partial JSON OpenAI output with defaults', () => {
  assert.deepEqual(normalizeOpenAiModelResult({ text: '{"message":"A soft answer."}', refusal: null }, 'en'), {
    message: 'A soft answer.',
    detectedIntent: 'chat',
    recommendationIntent: { needed: false, goal: null, preferredCatalogKey: null },
    meditationAction: null,
    conversationTitle: null,
    memoryCandidates: []
  });
});

test('normalizes fenced JSON OpenAI output', () => {
  assert.deepEqual(normalizeOpenAiModelResult({
    text: '```json\n{"message":"Fenced answer.","conversationTitle":"Evening","recommendedMeditationId":"not-a-real-id"}\n```',
    refusal: null
  }, 'en'), {
    message: 'Fenced answer.',
    detectedIntent: 'chat',
    recommendationIntent: { needed: true, goal: null, preferredCatalogKey: 'not-a-real-id' },
    meditationAction: null,
    conversationTitle: 'Evening',
    memoryCandidates: []
  });
});

test('normalizes a structured meditation action and validates it against published catalog', () => {
  const normalized = normalizeOpenAiModelResult({
    text: JSON.stringify({
      message: 'A focused practice is ready.',
      meditationAction: { type: 'meditation_card', meditationId: 'focused-calm' }
    }),
    refusal: null
  }, 'en');
  assert.deepEqual(normalized.meditationAction, { type: 'meditation_card', meditationId: 'focused-calm' });

  assert.deepEqual(resolveMeditationAction(normalized.meditationAction, [
    { id: 'db-focus', catalogKey: 'focused-calm', title: 'Focused Calm', published: true }
  ]), { type: 'meditation_card', meditationId: 'db-focus' });
  assert.equal(resolveMeditationAction(normalized.meditationAction, [
    { id: 'db-sleep', catalogKey: 'deep-sleep', title: 'Deep Sleep', published: true }
  ]), null);
  assert.equal(resolveMeditationAction({ type: 'meditation_card', meditationId: 'draft-focus' }, [
    { id: 'draft-focus', catalogKey: 'focused-calm', title: 'Focused Calm', published: false }
  ]), null);
});
