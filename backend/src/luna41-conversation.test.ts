import test from 'node:test';import assert from 'node:assert/strict';
import {attachmentMode,automaticConversationInstructions} from './luna41-conversation.js';
import {createLunaTools} from './luna32-tools.js';
import {readFileSync} from 'node:fs';
test('legacy mode metadata cannot establish an attachment scope',()=>{for(const mode of ['tarot','astrology','dream','meditation'])assert.equal(attachmentMode({...{mode}}),undefined);});
test('only actual selected IDs establish a consultation scope',()=>{assert.equal(attachmentMode({readingId:'selected'}),'tarot');assert.equal(attachmentMode({chartId:'selected'}),'astrology');assert.equal(attachmentMode({astrology:{chartId:'selected'}}),'astrology');});
test('one conversation exposes real meditation actions even with a Tarot attachment',()=>{
 const tools=createLunaTools({db:{} as never,owner:1,operationKey:'turn',language:'ru',readingId:'selected',readingContext:{},catalog:[],personalContext:null,access:{},quota:async()=>({remaining:1}),astrologyEnabled:false});
 assert.ok(tools.definitions.some(t=>t.name==='recommend_meditation'));assert.ok(tools.definitions.some(t=>t.name==='get_tarot_reading'));
});
test('ordinary runtime no longer disables tools based on a manual mode',()=>{const source=readFileSync(new URL('./luna-ai.ts',import.meta.url),'utf8');assert.match(source,/const allowMeditationActions = true/);assert.doesNotMatch(source,/input\.mode&&!env\.FEATURE_AI_MODES/);assert.match(automaticConversationInstructions,/never a restriction/);});
