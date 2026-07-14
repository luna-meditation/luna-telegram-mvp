import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');

test('local calendar dates do not use UTC ISO truncation', () => {
  const helper = appSource.slice(appSource.indexOf('function todayLocalDate()'), appSource.indexOf('function optimisticWellnessSummary'));
  assert.match(helper, /getFullYear\(\)/);
  assert.match(helper, /getMonth\(\) \+ 1/);
  assert.match(helper, /getDate\(\)/);
  assert.doesNotMatch(helper, /toISOString\(\)/);
});

test('daily check-in is user initiated and reuses the saved mood record', () => {
  assert.match(appSource, /const \[showCheckin, setShowCheckin\] = useState\(false\)/);
  assert.match(appSource, /onCheckinDetails=\{\(\) => setShowCheckin\(true\)\}/);
  assert.match(appSource, /hideMood=\{Boolean\(wellness\?\.todayCheckin\)\}/);
  assert.match(appSource, /local_date: todayLocalDate\(\)/);
});

test('unverified entitlement cannot expose purchase entry points', () => {
  assert.match(appSource, /if \(!accessVerified\) \{[\s\S]*?Plans will appear after your current access is confirmed/);
  assert.match(appSource, /\{accessVerified && <button onClick=\{onSubscription\}/);
});
