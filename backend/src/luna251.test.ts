import test from 'node:test';import assert from 'node:assert/strict';
import {resolveResponseLanguage} from './luna-ai-policy.js';
import {conciseTarotInstructions,validateTarotV2} from './tarot-interpretation-v2.js';
test('central chat follows selected language, with only an explicit user language request overriding it',()=>{
 assert.equal(resolveResponseLanguage('Как выбрать приоритеты?','en',[],true),'en');
 assert.equal(resolveResponseLanguage('How can I choose?','ru',[],true),'ru');
 assert.equal(resolveResponseLanguage('Reply in Russian','en',[],true),'ru');
 assert.equal(resolveResponseLanguage('Ответь на английском','ru',[],true),'en');
 assert.equal(resolveResponseLanguage('Как выбрать?','en'),'ru','legacy behavior unchanged');
});
test('short primary interpretation keeps the compatible v2 schema and bounded optional detail',()=>{
 for(const rule of ['100–160 words','summary + actions[0] + question','exactly one grounded perspective','not an obligatory task, mini-experiment','continuation: null','never invent','untrusted data'])assert.ok(conciseTarotInstructions.includes(rule));
 const card={cardId:'the-star',orientation:'reversed',position:'Direction',positionMeaning:'One symbolic possibility.',application:'Observe the decision in question.',detail:'A distinct optional nuance.'};
 const stored={version:2,summary:'Historical answer remains unchanged.',cards:[card],overall:'A different point.',actions:['Make one observation.','Older second action.'],question:'What matters most?',continuation:'An older invitation.'};
 assert.deepEqual(validateTarotV2(stored,[card]),stored);
});
