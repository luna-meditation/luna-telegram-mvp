import test from 'node:test';
import assert from 'node:assert/strict';
import {explicitRussianAddress,neutralRussianAddress,neutralRussianInterpretation,russianAddressInstructions} from './luna/russian-address.js';
test('Russian user gender is never inferred from name, card, or old assistant text',()=>{
 assert.equal(explicitRussianAddress({displayName:'Евгений',gender:'male'}),null);
 assert.equal(explicitRussianAddress(null,'Она готова обсудить карту'),null);
 assert.equal(neutralRussianAddress('Если ты готова, продолжим. Готова обсудить карту? Я рада быть рядом.','ru',null),'Если ты хочешь, продолжим. Хочешь обсудить карту? Я рада быть рядом.');
 assert.equal(neutralRussianAddress('Что ты заметил? Ты мог бы записать.','ru',null),'Что тебе удалось заметить? Ты можешь записать.');
});
test('Only explicit consented grammatical preferences and current requests control address',()=>{
 const confirmed={confirmedMemories:[{key:'pronouns',value:'he/him'}]};
 assert.equal(explicitRussianAddress(confirmed),'masculine');
 assert.equal(explicitRussianAddress(null,'Обращайся ко мне в женском роде.'),'feminine');
 assert.equal(explicitRussianAddress(confirmed,'Обращайся ко мне в женском роде.'),'feminine');
 assert.equal(explicitRussianAddress({preferences:'Не обращайся в женском роде'}),'neutral');
 assert.equal(explicitRussianAddress(null,'Не обращайся ко мне в женском роде.'),'neutral');
 assert.equal(explicitRussianAddress({confirmedMemories:{invalid:true}}),null);
 assert.equal(explicitRussianAddress({preferences:'мужской род',confirmedMemories:[{key:'pronouns',value:'she/her'}]}),null);
 assert.equal(neutralRussianAddress('Ты готов обсудить?','ru',confirmed),'Ты готов обсудить?');
 assert.match(russianAddressInstructions('ru',confirmed),/explicitly requests masculine/);
});
test('Interpretation repair preserves schema, IDs, orientations, English and source context',()=>{
 const value={version:2,summary:'Ты готова продолжить?',cards:[{cardId:'the-empress',orientation:'reversed',application:'Ты выбрала спокойный ритм.'}],question:'Готова попробовать сегодня?',continuation:null};
 const result=neutralRussianInterpretation(value,'ru',null);
 assert.equal(result.cards[0].cardId,value.cards[0].cardId);assert.equal(result.cards[0].orientation,'reversed');
 assert.equal(result.summary,'Ты хочешь продолжить?');assert.equal(result.cards[0].application,'Тебе удалось выбрать спокойный ритм.');
 assert.equal(value.summary,'Ты готова продолжить?');assert.deepEqual(neutralRussianInterpretation(value,'en',null),value);
});
