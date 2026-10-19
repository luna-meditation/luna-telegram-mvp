import assert from 'node:assert/strict';
import test from 'node:test';

Object.assign(process.env, {
  BOT_TOKEN: 'test-bot-token',
  BOT_USERNAME: 'luna_test_bot',
  MINI_APP_URL: 'https://example.com',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  FEATURE_AI_MODES: 'true',
  FEATURE_PERSONAL_MEMORY: 'true',
  AI_PROMPT_VERSION: 'meet-luna4'
});

const {buildLunaOpenAiRequest} = await import('./luna-ai.js');
const {env} = await import('./config.js');
const first = {
  subject: {label: 'Synthetic A', kind: 'self'},
  precision: 'exact',
  placements: {mercury: 'Capricorn 12.25°', moon: 'Scorpio 11.50°'},
  ascendant: null,
  aspects: []
};
const second = {
  subject: {label: 'Synthetic B', kind: 'other'},
  precision: 'unknown_time',
  placements: {mercury: 'Leo', saturn: 'Aquarius'},
  ascendant: null,
  aspects: []
};
const pair = {
  reference: {type: 'compatibility_report', chartId: 'synthetic-chart-a', secondChartId: 'synthetic-chart-b'},
  first,
  second,
  relationship: 'business',
  synastry: {aspects: [{from: 'moon', to: 'saturn', type: 'square', orb: 0.5}]}
};

function build(language: 'ru' | 'en', chartContext?: unknown) {
  return buildLunaOpenAiRequest({
    language,
    intelligence: true,
    catalog: [],
    context: {
      profile: {birth_date: 'UNPERMITTED_LEGACY_BIRTH'},
      memories: [{memory_value: 'UNPERMITTED_LEGACY_MEMORY'}],
      personalContext: {displayName: 'Alex', confirmedMemories: []},
      ...(chartContext ? {modeContext: {mode: 'astrology', chartContext}} : {})
    },
    recent: [
      {role: 'user', content: 'Old Tarot question'},
      {role: 'assistant', content: 'An old symbolic Tarot answer.'},
      {role: 'user', content: language === 'ru'
        ? 'Как нам лучше выстроить деловое общение? Коротко, по этим двум картам.'
        : 'Explain communication in these exact calculated birth charts.'}
    ]
  });
}

test('the actual Responses request keeps both selected charts, relationship and exact synastry explicit in RU/EN', () => {
  for (const language of ['ru', 'en'] as const) {
    const request = build(language, pair);
    assert.match(request.instructions, /MEET_LUNA_PERSONAL_COMPANION_4/);
    assert.match(request.instructions, /THIS_TURN_ACTIVE_SYSTEM=ASTROLOGY_COMPATIBILITY/);
    assert.ok(request.instructions.includes('SELECTED_CALCULATED_EVIDENCE=' + JSON.stringify(pair)));
    assert.match(request.instructions, /NOT Tarot cards/);
    assert.match(request.instructions, /COMPATIBILITY_EVIDENCE_BOUNDARY/);
    assert.match(request.instructions, new RegExp('CURRENT_RESPONSE_LANGUAGE=' + language));
    assert.doesNotMatch(request.instructions, /UNPERMITTED_LEGACY_BIRTH|UNPERMITTED_LEGACY_MEMORY/);
    assert.equal(request.input.at(-1)?.role, 'user');
    assert.match(request.input.at(-1)!.content, language === 'ru' ? /деловое общение/ : /calculated birth charts/);
    assert.equal(request.store, false);
  }
});

test('a single selected natal chart cannot be labelled as a comparison or lose its calculated Mercury', () => {
  const chart = {first, reference: {type: 'natal_chart', chartId: 'synthetic-chart-a'}};
  const request = build('en', chart);
  assert.match(request.instructions, /THIS_TURN_ACTIVE_SYSTEM=ASTROLOGY_NATAL/);
  assert.ok(request.instructions.includes('SELECTED_CALCULATED_EVIDENCE=' + JSON.stringify(chart)));
  assert.doesNotMatch(request.instructions, /THIS_TURN_ACTIVE_SYSTEM=ASTROLOGY_COMPATIBILITY|COMPATIBILITY_EVIDENCE_BOUNDARY/);
  assert.match(request.instructions, /Capricorn 12\.25°/);
});

test('ordinary chat does not claim that a chart was selected or disclose removed legacy context', () => {
  const request = build('ru');
  assert.doesNotMatch(request.instructions, /THIS_TURN_ACTIVE_SYSTEM=ASTROLOGY_|SELECTED_CALCULATED_EVIDENCE=/);
  assert.doesNotMatch(request.instructions, /UNPERMITTED_LEGACY_BIRTH|UNPERMITTED_LEGACY_MEMORY/);
});

test('verified chart evidence does not depend on the optional display-mode feature flag', () => {
  const before = env.FEATURE_AI_MODES;
  try {
    env.FEATURE_AI_MODES = false;
    const request = build('en', pair);
    assert.match(request.instructions, /THIS_TURN_ACTIVE_SYSTEM=ASTROLOGY_COMPATIBILITY/);
    assert.ok(request.instructions.includes('SELECTED_CALCULATED_EVIDENCE=' + JSON.stringify(pair)));
    assert.doesNotMatch(request.instructions, /UNPERMITTED_LEGACY_BIRTH|UNPERMITTED_LEGACY_MEMORY/);
  } finally {
    env.FEATURE_AI_MODES = before;
  }
});
