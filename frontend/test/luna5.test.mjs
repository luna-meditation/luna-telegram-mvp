import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync('src/features/tarot/deferredInterpretation.ts','utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ES2020}}).outputText;
const {createInterpretationRequestGuard,deferredInterpretationPlan}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
test('deferred generation starts only on persisted final reveal; historical local results do not regenerate',()=>{
 for(const[kind,count]of[['single',1],['three',3],['five',5]]){
  const state={kind,revealed:count,reading:{status:'local'}};assert.equal(deferredInterpretationPlan(state),'none');
  state.interpretationRequested=true;assert.equal(deferredInterpretationPlan(state),'start');
  assert.equal(deferredInterpretationPlan({...state,interpretationAttempted:true,interpretationFinished:true}),'none','Reopening a previously limited local result must not generate when a quota later refills');
  assert.equal(deferredInterpretationPlan({...state,interpretationAttempted:true}),'observe','A lost response or another device may still be finishing the single claimed attempt');
  state.revealed--;assert.equal(deferredInterpretationPlan(state),'none');state.revealed++;
  for(const status of ['ready','fallback','safety'])assert.equal(deferredInterpretationPlan({...state,reading:{status}}),'none');
  assert.equal(deferredInterpretationPlan({...state,reading:{status:'processing'}}),'observe');
 }
});
test('tab remount, retry and lost response never reserve a second interpretation POST in the same document session',()=>{
 const reserve=createInterpretationRequestGuard();assert.equal(reserve('reading-a','session-a'),true);
 assert.equal(reserve('reading-a','session-a'),false);assert.equal(reserve('reading-a','session-a'),false);
 assert.equal(reserve('reading-b','session-a'),true);assert.equal(reserve('reading-a','session-a'),false);
 assert.equal(reserve('reading-a','session-b'),true,'Account/session boundary resets only the in-memory guard');
 const newDocument=createInterpretationRequestGuard();assert.equal(newDocument('reading-a','session-b'),true,'Server idempotency protects restarts');
});
test('celestial center does not rely on the transform overwritten by global press feedback',()=>{
 const css=readFileSync('src/luna2/personal-portrait.css','utf8');assert.match(css,/\.personal-portrait \.celestial-center\{[^}]*left:0;right:0;margin-inline:auto;[^}]*transform:none/);
});
test('all calculated date indicators have selectable explanations through one shared renderer',()=>{
 const s=readFileSync('src/features/astrology/DateNumberExplorer.tsx','utf8');for(const key of ['lifePath','birthday','personalYear','personalMonth','personalDay'])assert.ok(s.includes(key),key);assert.match(s,/aria-pressed=\{selected===key\}/);assert.match(s,/numerologyThemes\[data\[selected\]\]/);assert.match(s,/not a fixed destiny/);
 for(const path of ['src/luna2/PersonalPortraitView.tsx','src/components/ChatPersonalSpace.tsx','src/features/astrology/NumerologyPanel.tsx'])assert.match(readFileSync(path,'utf8'),/<DateNumberExplorer/);
});
