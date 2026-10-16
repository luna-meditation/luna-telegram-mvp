import test from 'node:test';import assert from 'node:assert/strict';
import {constrainLunaResponse,reviewLunaResponse} from './luna-ai-quality.js';
test('deep consultation repair preserves full structure and the final practical step',()=>{
 const message=['## Three perspectives','1. The Star is a symbolic point of hope.','2. The Moon reversed invites clarity.','3. The Sun concerns joy and energy.','','## A small step','Notice one habit.','Keep it gentle.','What would you like to try?'].join('\n');
 assert.equal(constrainLunaResponse({message,language:'en',clarificationAllowed:true,preserveStructure:true}),message);
});
test('quoting the user question does not count as another clarification',()=>{
 const review=reviewLunaResponse({message:'Your question is “How can I begin?”\nA small experiment may help.\nWhat would feel manageable?',language:'en',state:{} as Parameters<typeof reviewLunaResponse>[0]['state'],clarificationAllowed:true,userRequestedDepth:true});
 assert.ok(!review.issues.includes('too_many_questions'));
});
