import{test}from'node:test';import assert from'node:assert/strict';import{lunaModeSchema,buildModeInstructions,boundedModeContext,unifiedLunaPersonality}from'./luna/modes.js';
test('all Luna modes, Tarot and legacy companion preserve an explicit name without invented pet names',async()=>{const {nameAddressPolicy,personalityPrompt}=await import('./luna/prompts/personality.js');assert.match(nameAddressPolicy,/explicitly chosen name exactly/);assert.match(nameAddressPolicy,/Never invent nicknames, diminutives/);assert.ok(personalityPrompt.includes(nameAddressPolicy));assert.ok(unifiedLunaPersonality.includes(nameAddressPolicy));for(const mode of ['companion','tarot','wellbeing','meditation','astrology'] as const)assert.ok(buildModeInstructions(mode,'ru',{}).includes(nameAddressPolicy));});
test('modular Luna modes share explicit safety boundaries and do not simulate astrology',()=>{
 for(const mode of ['companion','tarot','wellbeing','meditation','astrology'] as const){assert.equal(lunaModeSchema.parse(mode),mode);assert.ok(buildModeInstructions(mode,'ru',{}).includes('Russian'));}
 for(const mode of ['companion','tarot','wellbeing','meditation'] as const)assert.match(buildModeInstructions(mode,'en',{}),/Oracle, Companion and Guide.*same/);
 assert.match(buildModeInstructions('tarot','en',{}),/not scientifically reliable prediction/);
 assert.match(buildModeInstructions('wellbeing','en',{}),/without diagnosing/);
 assert.match(buildModeInstructions('astrology','en',{}),/Do not invent charts/);
});
test('new mode context is bounded before reaching the model',()=>{
 const bounded=boundedModeContext({preferences:'x'.repeat(10000),rows:Array.from({length:100},()=>({question:'y'.repeat(1000)}))});assert.ok(JSON.stringify(bounded).length<=6000);
});
test('new mode request uses bounded conversation context without legacy personal memory leakage',async()=>{
 Object.assign(process.env,{BOT_TOKEN:'test',BOT_USERNAME:'test',MINI_APP_URL:'https://example.com',SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-only',FEATURE_AI_MODES:'true'});
 const {buildLunaOpenAiRequest}=await import('./luna-ai.js');
 const request=buildLunaOpenAiRequest({language:'ru',catalog:Array.from({length:30},(_,i)=>({id:String(i)})),context:{memories:[{memory_value:'PRIVATE-LEGACY-DATA'}],profile:{birth_date:'PRIVATE-BIRTH-DATE'},modeContext:{mode:'companion',personalContext:null}},recent:Array.from({length:20},()=>({role:'user',content:'x'.repeat(10000)}))});
 assert.equal(request.input.length,8);assert.ok(request.input.every(item=>item.content.length<=2000));assert.doesNotMatch(request.instructions,/PRIVATE-LEGACY-DATA|PRIVATE-BIRTH-DATE/);assert.match(request.instructions,/General Companion/);assert.equal(request.store,false);
});
