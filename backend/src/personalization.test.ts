import{test}from'node:test';import assert from'node:assert/strict';import{personalProfileSchema,emptyPersonalProfile,permittedPersonalContext,personalProfileWrite}from'./personalization-policy.js';
test('personal profile is optional, bounded and cannot select another owner',()=>{
 assert.deepEqual(personalProfileSchema.parse(emptyPersonalProfile),emptyPersonalProfile);
 for(const patch of [{telegram_id:1},{display_name:'x'.repeat(61)},{preferences:'x'.repeat(501)},{birth_date:'2024-02-31'},{birth_time:'25:30'},{interests:['unknown']}])assert.equal(personalProfileSchema.safeParse({...emptyPersonalProfile,...patch}).success,false);
 assert.equal(personalProfileSchema.safeParse({...emptyPersonalProfile,birth_date:'2000-02-29',birth_time:'09:30'}).success,true);
});
test('AI consent is explicit and birth details never enter current AI context',()=>{
 assert.equal(permittedPersonalContext({...emptyPersonalProfile,preferences:'personal'}),null);
 const data=permittedPersonalContext({...emptyPersonalProfile,ai_context_consent:true,birth_date:'2000-01-01',birth_place:'Private city',preferences:'short answers',interests:['tarot']});
 assert.deepEqual(data,{displayName:null,interests:['tarot'],preferences:'short answers'});assert.ok(!JSON.stringify(data).includes('Private city'));
});
test('optional name preserves Telegram identity and enters AI only with consent',()=>{
 const legacy=personalProfileSchema.parse({interests:[],preferences:'',birth_date:null,birth_time:null,birth_place:null,ai_context_consent:false});assert.equal(legacy.display_name,null);
 const named=personalProfileSchema.parse({...emptyPersonalProfile,display_name:'  Alex  '});assert.equal(named.display_name,'Alex');assert.equal(permittedPersonalContext(named),null);
 assert.equal(permittedPersonalContext({...named,ai_context_consent:true})?.displayName,'Alex');
});
test('saving preferences cannot overwrite stale canonical birth projections',()=>{const profile={...emptyPersonalProfile,display_name:'Alex',birth_date:'2000-01-01',birth_time:'12:30',birth_place:'Older projection'};const value=personalProfileWrite(profile,true);assert.equal(value.display_name,'Alex');for(const key of ['birth_date','birth_time','birth_place'])assert.equal(key in value,false);assert.deepEqual(personalProfileWrite(profile,false),profile);});
