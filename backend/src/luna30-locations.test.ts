import test from 'node:test';
import assert from 'node:assert/strict';
import {searchBirthLocations,resolveBirthLocation} from './luna30-locations.js';
test('licensed local city snapshot resolves English and Russian aliases without external personal-data requests',()=>{
 const london=searchBirthLocations('London').find(c=>c.country==='GB');assert.ok(london);const verified=resolveBirthLocation(london.placeId);assert.equal(verified.timezone,'Europe/London');assert.ok(Math.abs(verified.latitude-51.5)<.2);assert.equal(verified.confirmed,true);
 const moscow=searchBirthLocations('Москва').find(c=>c.country==='RU');assert.ok(moscow);assert.equal(resolveBirthLocation(moscow.placeId).timezone,'Europe/Moscow');
 assert.deepEqual(searchBirthLocations('x'),[]);assert.deepEqual(searchBirthLocations('x'.repeat(81)),[]);assert.ok(searchBirthLocations('san').length<=12);
 for(const id of ['Europe/London','geonames:0','geonames:2643743?timezone=UTC','../data/secrets','<script>'])assert.throws(()=>resolveBirthLocation(id));
});
