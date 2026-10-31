import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {importTypescript} from './import-typescript.mjs';
const {viewportGeometry}=await importTypescript(resolve('src/hooks/viewportPolicy.ts'));
const nav=await importTypescript(resolve('src/navigation/navigationModel.ts'));
const dimensions={visualHeight:640,innerHeight:844,telegramHeight:640,stableHeight:844,offsetTop:0,scale:1,editableFocused:false};
test('Telegram expansion without an editable focus preserves navigation; an actual keyboard reserves space',()=>{
 assert.equal(viewportGeometry(dimensions).keyboardOpen,false);
 assert.equal(viewportGeometry(dimensions).keyboardInset,0);
 assert.equal(viewportGeometry({...dimensions,editableFocused:true}).keyboardInset,204);
 assert.equal(viewportGeometry({...dimensions,editableFocused:true,scale:1.4}).keyboardOpen,false);
 assert.equal(viewportGeometry({...dimensions,editableFocused:true,visualHeight:800,telegramHeight:800}).keyboardOpen,false);
});
test('Profile is primary; My Cosmos and account pages return to it without duplicating a primary destination',()=>{
 assert.deepEqual(nav.primaryNavigation(true).map(item=>item.page),['home','luna','profile']);
 let state=nav.initialRouteState('profile',true);
 assert.deepEqual(state.trail,[]);
 state=nav.reduceRouteState(state,{type:'navigate',page:'cosmos'},true);
 assert.deepEqual(state,{current:'cosmos',trail:['profile']});
 assert.equal(nav.primaryParent('cosmos',true),'profile');
 state=nav.reduceRouteState(state,{type:'back'},true);assert.equal(state.current,'profile');
 state=nav.reduceRouteState(state,{type:'navigate',page:'wallet'},true);
 state=nav.reduceRouteState(state,{type:'back'},true);assert.equal(state.current,'profile');
 assert.equal(nav.pageFromStartParam('cosmos',true),'cosmos');
 assert.deepEqual(nav.initialRouteState('cosmos',true).trail,['profile']);
 assert.equal(nav.fallbackPage('cosmos',false),'profile');
 assert.equal(nav.primaryNavigation(false).length,5);
});
