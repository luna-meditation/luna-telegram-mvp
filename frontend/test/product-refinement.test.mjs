import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const app = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');
const api = readFileSync(resolve(process.cwd(), 'src/api.ts'), 'utf8');
const hero = readFileSync(resolve(process.cwd(), 'src/v2/components/V2Hero.tsx'), 'utf8');
const home = readFileSync(resolve(process.cwd(), 'src/v2/pages/HomeV2.tsx'), 'utf8');
const homeStyles = readFileSync(resolve(process.cwd(), 'src/v2/design-system/homeV2.css'), 'utf8');

test('completed check-in uses a timed hero toast and a compact editable settled state', () => {
  assert.match(app, /setCheckinConfirmationVisible\(true\)/);
  assert.match(app, /}, 2600\)/);
  assert.match(app, /Checked in today ✓/);
  assert.match(hero, /home-v2-checkin-toast/);
  assert.match(hero, /onCheckinDetails/);
  assert.doesNotMatch(hero, /detailsLabel/);
  assert.match(homeStyles, /background: rgba\(18, 17, 46, 0\.48\)/);
});

test('Home preserves backend personalization order and masks sound chips only on real overflow', () => {
  assert.match(app, /goal\/check-in\/time-aware ranking/);
  assert.match(app, /return stableMeditations\[0\]/);
  assert.match(app, /Chosen for your goal/);
  assert.match(home, /scrollWidth > chooser\.clientWidth/);
  assert.match(home, /home-v2-sound-chooser-overflow/);
});

test('notifications and support are real backend flows rather than decorative settings', () => {
  assert.match(app, /Allow Telegram reminders/);
  assert.match(app, /reminderTypes/);
  assert.match(app, /submitSupportRequest/);
  assert.match(app, /SupportInbox/);
  assert.match(api, /\/api\/support/);
  assert.match(api, /\/api\/admin\/support/);
});

test('Premium prices come from the backend and Restore Access has explicit states', () => {
  assert.match(api, /getPlans/);
  assert.match(app, /plans\.monthly\.amountStars/);
  assert.match(app, /plans\.lifetime\.amountStars/);
  assert.match(app, /No active purchase found\. Your current access is unchanged\./);
  assert.doesNotMatch(app, /const premiumPrices/);
});

test('Home Screen success is only set by a confirmed runtime state or event', () => {
  assert.match(app, /display-mode: standalone/);
  assert.match(app, /homeScreenAdded/);
  const addFlow = app.slice(app.indexOf('const addLunaToHomeScreen'), app.indexOf('const openLunaAssistant'));
  assert.match(addFlow, /Complete the Telegram prompt/);
  assert.doesNotMatch(addFlow, /telegram\.addToHomeScreen\(\);\s*setHomeScreenStatus\('added'\)/);
});
