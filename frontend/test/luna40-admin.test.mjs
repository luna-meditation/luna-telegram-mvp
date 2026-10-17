import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const helper=readFileSync(new URL('../src/admin/admin40.ts',import.meta.url),'utf8');
// Pure helpers share this module with one Vite-only compile-time flag.
const source=helper.replace("export const admin40Enabled=String(import.meta.env.VITE_FEATURE_ADMIN_V4??'').toLowerCase()==='true';",'export const admin40Enabled=false;');
const ts=(await import('typescript')).default;const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;const {admin40Navigation,adminPeriod,formatAdminMetric}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
test('admin has exactly nine localized sections, not a scrolling legacy tab strip',()=>{assert.deepEqual(admin40Navigation.map(n=>n.id),['dashboard','users','ai','content','monetization','analytics','referrals','support','settings']);assert.ok(admin40Navigation.every(n=>n.en&&n.ru));});
test('reporting boundaries are UTC days even when input has a different timezone',()=>{assert.deepEqual(adminPeriod(7,new Date('2026-10-17T20:30:00-07:00')),{from:'2026-10-12T00:00:00.000Z',to:'2026-10-19T00:00:00.000Z'});});
test('unknown numbers stay unavailable and are never silently replaced with zero',()=>{assert.equal(formatAdminMetric(null,'ru'),'—');assert.equal(formatAdminMetric(undefined,'en'),'—');assert.equal(formatAdminMetric(0,'en'),'0');});
