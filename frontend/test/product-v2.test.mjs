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
test('Settings and wallet keep a contextual route back to My Cosmos; legacy navigation is preserved',()=>{
 let state={current:'cosmos',trail:[]};
 for(const page of ['profile','wallet'])state=nav.reduceRouteState(state,{type:'navigate',page},true);
 for(const page of ['profile','cosmos']){state=nav.reduceRouteState(state,{type:'back'},true);assert.equal(state.current,page);}
 assert.equal(nav.pageFromStartParam('cosmos',true),'cosmos');
 assert.equal(nav.initialRouteState('profile',true).trail[0],'cosmos');
 assert.equal(nav.primaryParent('profile',true),'cosmos');
 assert.equal(nav.fallbackPage('cosmos',false),'profile');
 assert.equal(nav.primaryNavigation(false).length,5);
});
