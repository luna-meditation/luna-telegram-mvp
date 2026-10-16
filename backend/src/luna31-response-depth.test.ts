import test from 'node:test';import assert from 'node:assert/strict';
import {constrainLunaResponse,reviewLunaResponse} from './luna-ai-quality.js';
import {hasDanglingConsultationPromise} from './luna-ai-quality.js';
import {isCrisisMessage,safetyCategory} from './luna-ai-policy.js';
import {artifactScopedIntent} from './luna31-consultation.js';
test('deep consultation repair preserves full structure and the final practical step',()=>{
 const message=['## Three perspectives','1. The Star is a symbolic point of hope.','2. The Moon reversed invites clarity.','3. The Sun concerns joy and energy.','','## A small step','Notice one habit.','Keep it gentle.','What would you like to try?'].join('\n');
 assert.equal(constrainLunaResponse({message,language:'en',clarificationAllowed:true,preserveStructure:true}),message);
});
test('completed envelopes with an undelivered explanation are rejected',()=>{
 assert.equal(hasDanglingConsultationPromise('Конкретно по приложенному отчёту и картам — наблюдения ниже.'),true);
 assert.equal(hasDanglingConsultationPromise('Ниже — по пунктам, каждый слой даёт разную работу для начала проекта.'),true);
 assert.equal(hasDanglingConsultationPromise('Наблюдения ниже.\n1. Меркурий в Козероге.\n2. Меркурий в Водолее.'),false);
 assert.equal(hasDanglingConsultationPromise('The saved card is below.'),false);
});
test('common self-harm wording reaches the deterministic crisis path',()=>{
 for(const message of ['I want to harm myself.','I am harming myself.','I am hurting myself.','I want to hurt myself.','Я хочу навредить себе.']){assert.equal(isCrisisMessage(message),true);assert.equal(safetyCategory(message),'self_harm');}
});
test('a saved chart or reading cannot inherit meditation actions from legacy keywords',()=>{
 const legacy={intent:'recommend_meditation',goal:'focus',topic:'meditation',action:'recommend_meditation',meditationId:'existing',confidence:.9,continuation:false,reason:'legacy keyword'} as const;
 for(const mode of ['tarot','astrology']){const scoped=artifactScopedIntent(legacy,mode);assert.equal(scoped.action,'none');assert.equal(scoped.meditationId,null);assert.equal(scoped.topic,mode);}
 assert.equal(artifactScopedIntent(legacy,'companion'),legacy);
});
test('quoting the user question does not count as another clarification',()=>{
 const review=reviewLunaResponse({message:'Your question is “How can I begin?”\nA small experiment may help.\nWhat would feel manageable?',language:'en',state:{} as Parameters<typeof reviewLunaResponse>[0]['state'],clarificationAllowed:true,userRequestedDepth:true});
 assert.ok(!review.issues.includes('too_many_questions'));
});
