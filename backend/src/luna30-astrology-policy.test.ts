import test from 'node:test';import assert from 'node:assert/strict';
import {trustedBirthInput} from './luna30-astrology-policy.js';
const valid={subjectKind:'self',label:'Synthetic QA',date:'2000-01-01',time:null,placeId:'geonames:2643743',consent:true};
test('birth data are optional, explicitly consented, server resolved and bounded; another owner cannot be selected',()=>{
 const parsed=trustedBirthInput(valid);assert.equal(parsed.calculation.location.timezone,'Europe/London');assert.equal(parsed.calculation.time,null);
 for(const patch of [{telegram_id:1},{consent:false},{date:'2100-01-01'},{date:'1799-12-31'},{date:'2000-02-31'},{time:'24:00'},{latitude:0},{timezone:'UTC'},{placeId:'unverified'}])assert.throws(()=>trustedBirthInput({...valid,...patch}));
});
