import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const source = resolve(root, 'src');
const app = readFileSync(resolve(source, 'App.tsx'), 'utf8');
const theme = readFileSync(resolve(source, 'hooks/useTheme.ts'), 'utf8');
const tokens = readFileSync(resolve(source, 'design-system/tokens.css'), 'utf8');
const styles = readFileSync(resolve(source, 'styles.css'), 'utf8');
const homeStyles = readFileSync(resolve(source, 'v2/design-system/homeV2.css'), 'utf8');
const journeyStyles = readFileSync(resolve(source, 'components/journey/journeyHub.css'), 'utf8');
const index = readFileSync(resolve(root, 'index.html'), 'utf8');

test('Light and Dark share semantic tokens instead of inversion', () => {
  assert.match(tokens, /:root\[data-theme="light"\]/);
  assert.match(tokens, /:root\[data-theme="dark"\]/);
  for (const token of ['--bg-primary', '--surface-primary', '--surface-elevated', '--text-primary', '--text-secondary', '--border-subtle', '--accent-gold', '--accent-violet', '--nav-bg', '--overlay-bg']) {
    assert.ok((tokens.match(new RegExp(token, 'g')) ?? []).length >= 2, `${token} must exist in both themes`);
  }
  assert.doesNotMatch(tokens, /filter:\s*invert/);
});

test('Dark-only ignores device preferences and changes only the legacy theme key', () => {
  assert.match(theme, /luna\.theme\.preference\.v1/);
  assert.doesNotMatch(theme, /matchMedia|localStorage.clear/);
  assert.match(theme, /window\.localStorage\.setItem\(THEME_STORAGE_KEY,'dark'\)/);
  assert.match(app, /key !== THEME_STORAGE_KEY/);
});

test('theme is applied before React and updates browser and Telegram chrome', () => {
  const bootstrapPosition = index.indexOf("luna.theme.preference.v1");
  const appPosition = index.indexOf('/src/main.tsx');
  assert.ok(bootstrapPosition > 0 && bootstrapPosition < appPosition);
  assert.match(index, /document\.documentElement\.dataset\.theme = resolved/);
  assert.match(app, /setHeaderColor\?\./);
  assert.match(app, /setBackgroundColor\?\./);
  assert.match(app, /setBottomBarColor\?\./);
});

test('Profile no longer exposes obsolete Light and System controls; old artwork is retained', () => {
  assert.doesNotMatch(app, /onThemePreferenceChange|setView\('appearance'\)|Use device setting|Как на устройстве/);
  assert.match(styles, /\.appearance-theme-grid/);
});

test('major interface areas and overlays consume the theme while artwork remains uncropped', () => {
  assert.match(homeStyles, /:root\[data-theme="light"\] \.home-v2-recommendation/);
  assert.match(styles, /:root\[data-theme="light"\] \.luna-live-composer/);
  assert.match(styles, /:root\[data-theme="light"\] \.progress-v5-status/);
  assert.match(styles, /\.theme-overlay/);
  assert.match(journeyStyles, /background:\s*var\(--overlay-bg\)/);
  assert.match(journeyStyles, /object-fit:\s*contain/);
  assert.doesNotMatch(journeyStyles, /object-fit:\s*cover/);
});
