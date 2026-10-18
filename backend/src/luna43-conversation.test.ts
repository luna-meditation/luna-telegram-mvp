import test from 'node:test';import assert from 'node:assert/strict';
import {usesConsultation,luna43ConversationInstructions} from './luna43-conversation.js';
import {artifactScopedIntent} from './luna31-consultation.js';
import {constrainLunaResponse} from './luna-ai-quality.js';
import {readFileSync} from 'node:fs';
import {resolveLunaIntent} from './luna-ai-intent.js';
import {normalizeConversationState} from './luna-ai-state.js';
test('new topics do not inherit saved Tarot or astrology; genuine follow-ups still do',()=>{
 for(const kind of ['tarot','astrology'] as const){for(const text of ['Help me plan my week','Как поменять язык?','Buy more Moon Seeds','Что приготовить на ужин?','Recommend a focus meditation'])assert.equal(usesConsultation(text,kind),false,text);for(const text of ['Tell me more','А как это связано с работой?','Расскажи подробнее'])assert.equal(usesConsultation(text,kind),true,text);assert.equal(usesConsultation('What would this mean for my work?',kind,true),true);}
 assert.equal(usesConsultation('Explain Mercury in my chart','tarot'),false);assert.equal(usesConsultation('Что означает перевёрнутая карта?','tarot'),true);assert.equal(usesConsultation('Let’s do another Tarot spread','astrology'),false);
});
test('an independent meditation or commercial command is unscoped before legacy artifact policy runs',()=>{const action={intent:'recommend_meditation',goal:'focus',topic:'focus',action:'recommend_meditation',meditationId:null,confidence:1,continuation:false,reason:'explicit'} as const;assert.deepEqual(artifactScopedIntent(action,usesConsultation('Recommend a meditation for focus','tarot')?'tarot':undefined),action);const commercial={...action,intent:'premium',action:'none'} as const;assert.deepEqual(artifactScopedIntent(commercial,usesConsultation('Buy more Moon Seeds','astrology')?'astrology':undefined),commercial);});
test('mobile quality processing preserves a complete answer instead of chopping off the conclusion',()=>{const text='First observation. Second observation. Third observation. Fourth observation. Fifth observation. This is the actual conclusion.';assert.match(constrainLunaResponse({message:text,language:'en',clarificationAllowed:true}),/actual conclusion/);assert.match(luna43ConversationInstructions,/80-150 words/);assert.match(luna43ConversationInstructions,/not permanent modes/);});
test('spread reservation uses the shared successful-answer quota rather than an obsolete second two-reading cap',()=>{
 const spread=readFileSync('src/tarot-spreads.ts','utf8');
 assert.match(spread,/p_daily_limit:env\.LUNA32_ENABLED\?500:/);
 assert.match(spread,/return withAiOperation\(supabase,telegramId,'tarot:'/);
 assert.match(spread,/p_global_limit:env\.TAROT_AI_GLOBAL_DAILY_LIMIT/);
});
test('planning a day is not a Premium purchase; explicit subscription language still is',()=>{
 const classify=(message:string)=>resolveLunaIntent({message,state:normalizeConversationState(null),pendingState:null,catalog:[]}).intent;
 for(const text of ['Help me plan tomorrow','I need a plan for my prototype','План на завтра','How can I plan my week?'])assert.equal(classify(text),'general_chat',text);
 for(const text of ['Premium plan prices','subscription plan','Which paid plan costs less?','Какой тариф Premium?'])assert.equal(classify(text),'premium',text);
 const source=readFileSync('src/luna-ai.ts','utf8');assert.match(source,/contextualActions:chartContext\?\['birth_profile'\]:readingContext\?\['tarot'\]/);
});
