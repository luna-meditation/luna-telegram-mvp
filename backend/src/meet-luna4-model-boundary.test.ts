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

test('selected explanations isolate exact evidence from stale app state without losing consented address or current question', () => {
  for (const language of ['ru', 'en'] as const) {
    const request=buildLunaOpenAiRequest({language,intelligence:true,answerFromSelectedEvidence:true,
      catalog:[{id:'UNRELATED_CATALOG_MARKER'}],
      context:{personalContext:{displayName:'Alex',confirmedMemories:[]},modeContext:{mode:'astrology',chartContext:pair},
        pendingResolution:{question:'STALE_MEDITATION_QUESTION'},runtimeDecision:{topic:'STALE_RUNTIME_TOPIC'},
        profile:{birth_date:'UNPERMITTED_LEGACY_BIRTH'},memories:[{value:'UNPERMITTED_LEGACY_MEMORY'}]},
      recent:[{role:'user',content:language==='ru'?'Как нам лучше выстроить деловое общение? Коротко, по этим двум картам.':'Explain these exact two birth charts briefly.'}]});
    const full=JSON.stringify(request);
    assert.doesNotMatch(full,/UNRELATED_CATALOG_MARKER|STALE_MEDITATION_QUESTION|STALE_RUNTIME_TOPIC|UNPERMITTED_LEGACY_/);
    assert.match(request.instructions,/Alex/);
    assert.match(request.instructions,/THIS_TURN_ACTIVE_SYSTEM=ASTROLOGY_COMPATIBILITY/);
    assert.equal(request.input.length,2);
    assert.ok(request.input[0].content.startsWith('APP_VERIFIED_ATTACHMENT_DATA'));
    const evidence=JSON.parse(request.input[0].content.split('\n').slice(1).join('\n'));
    assert.equal(evidence.type,'compatibility_report');assert.deepEqual(evidence.payload,pair);
    assert.equal(evidence.labels.planets.mercury,language==='ru'?'Меркурий':'mercury');
    assert.equal(full.split('synthetic-chart-a').length-1,1);
    assert.match(request.input.at(-1)!.content,language==='ru'?/деловое общение/:/two birth charts/);
    assert.equal(request.reasoning.effort,'low');
    assert.equal(request.max_output_tokens,env.AI_MAX_OUTPUT_TOKENS);
  }
});

test('single natal and already-paid report explanations get their exact typed payload, not a new calculation',()=>{
  const before=env.AI_REASONING_EFFORT;
  try{
    env.AI_REASONING_EFFORT='minimal';
    for(const [type,payload]of [['natal_chart',{first,reference:{type:'natal_chart',chartId:'synthetic-chart-a'}}],['personal_report',{source:'saved_paid_personal_report',summary:'Already saved communication reflection.'}]] as const){
      const request=buildLunaOpenAiRequest({language:'en',intelligence:true,answerFromSelectedEvidence:true,catalog:[],
        context:type==='natal_chart'?{modeContext:{mode:'astrology',chartContext:payload}}:{personalReportContext:payload},
        recent:[{role:'user',content:'Explain the communication insight.'}]});
      const evidence=JSON.parse(request.input[0].content.split('\n').slice(1).join('\n'));
      assert.equal(evidence.type,type);assert.deepEqual(evidence.payload,payload);
      assert.equal(request.reasoning.effort,'minimal');
      assert.doesNotMatch(request.instructions,/COMPATIBILITY_EVIDENCE_BOUNDARY/);
      assert.match(request.instructions,type==='natal_chart'?/THIS_TURN_ACTIVE_SYSTEM=ASTROLOGY_NATAL/:/THIS_TURN_ACTIVE_SYSTEM=SAVED_PERSONAL_REPORT/);
    }
  }finally{env.AI_REASONING_EFFORT=before;}
});

test('valid 14k saved results remain discussable and oversized envelopes fail before a provider request',()=>{
  const build=(size:number)=>buildLunaOpenAiRequest({language:'ru',intelligence:true,answerFromSelectedEvidence:true,catalog:[],context:{personalReportContext:{summary:'S'.repeat(size),source:'saved_paid_personal_report'}},recent:[{role:'user',content:'Как применить вывод?'}]});
  assert.ok(build(14000).input[0].content.includes('S'.repeat(14000)));
  assert.throws(()=>build(17000),/consultation_context_too_large/);
});
test('a reversed-card follow-up receives the exact saved Tarot evidence without drawing a new reading',()=>{
 const reading={id:'saved-reading-only',kind:'three',cards:[{cardId:'the-star',orientation:'reversed',position:'Situation'},{cardId:'strength',orientation:'upright',position:'Direction'}],question:'Which prototype step matters?',interpretation:{summary:'An already saved symbolic reflection.'}};
 const request=buildLunaOpenAiRequest({language:'ru',intelligence:true,answerFromSelectedEvidence:true,catalog:[{id:'STALE_CATALOG'}],context:{modeContext:{mode:'tarot',readingContext:reading},runtimeDecision:{topic:'STALE_BIRTH_TOPIC'}},recent:[{role:'user',content:'Что означает именно перевёрнутая карта в моём раскладе?'}]});
 const data=JSON.parse(request.input[0].content.split('\n').slice(1).join('\n'));
 assert.equal(data.type,'tarot_reading');assert.deepEqual(data.payload,reading);assert.match(request.instructions,/THIS_TURN_ACTIVE_SYSTEM=SAVED_TAROT_READING/);
 assert.doesNotMatch(JSON.stringify(request),/STALE_CATALOG|STALE_BIRTH_TOPIC/);assert.match(request.input.at(-1)!.content,/перевёрнутая карта/);assert.equal(request.store,false);
});

test('the actual Mercury request contains only its calculated neighbours and keeps the original chart unchanged',()=>{
  const chart={first:{...first,placements:{mercury:'Capricorn 1.89°',mars:'Aquarius 27.96°',sun:'Capricorn 10.37°',moon:'Scorpio 13.32°'},aspects:[{from:'mercury',to:'mars',type:'sextile'},{from:'sun',to:'moon',type:'sextile'}]}};
  const request=buildLunaOpenAiRequest({language:'en',intelligence:true,answerFromSelectedEvidence:true,catalog:[],context:{modeContext:{mode:'astrology',chartContext:chart}},recent:[{role:'user',content:'Explain Mercury in this exact calculated chart briefly.'}]});
  const evidence=JSON.parse(request.input[0].content.split('\n').slice(1).join('\n'));
  assert.deepEqual(Object.keys(evidence.payload.first.placements),['mercury','mars']);assert.deepEqual(evidence.payload.first.aspects,[chart.first.aspects[0]]);
  assert.equal(Object.keys(chart.first.placements).length,4);assert.equal(chart.first.aspects.length,2);
});

test('a selection hint cannot manufacture evidence for ordinary chat or enable the new policy on the legacy prompt',()=>{
  const request=buildLunaOpenAiRequest({language:'en',intelligence:true,answerFromSelectedEvidence:true,catalog:[],context:{},recent:[{role:'user',content:'Help me focus.'}]});
  assert.equal(request.input.length,1);assert.doesNotMatch(JSON.stringify(request),/APP_VERIFIED_ATTACHMENT_DATA/);
  const before=env.AI_PROMPT_VERSION;
  try{env.AI_PROMPT_VERSION='intelligence-v3';const legacy=buildLunaOpenAiRequest({language:'en',intelligence:true,answerFromSelectedEvidence:true,catalog:[],context:{modeContext:{mode:'astrology',chartContext:pair}},recent:[{role:'user',content:'Explain these charts.'}]});assert.doesNotMatch(JSON.stringify(legacy),/APP_VERIFIED_ATTACHMENT_DATA/);}finally{env.AI_PROMPT_VERSION=before;}
});
