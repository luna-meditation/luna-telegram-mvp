import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const sourceRoot = resolve(process.cwd(), 'src');
const appSource = readFileSync(resolve(sourceRoot, 'App.tsx'), 'utf8');
const styles = readFileSync(resolve(sourceRoot, 'styles.css'), 'utf8');
const tokens = readFileSync(resolve(sourceRoot, 'design-system/tokens.css'), 'utf8');
const typeStyles = readFileSync(resolve(sourceRoot, 'design-system/typography.css'), 'utf8');
const primitives = readFileSync(resolve(sourceRoot, 'design-system/primitives.css'), 'utf8');
const chat = readFileSync(resolve(sourceRoot, 'components/LunaChat.tsx'), 'utf8');
const viewport = readFileSync(resolve(sourceRoot, 'hooks/useChatViewport.ts'), 'utf8');
const home = readFileSync(resolve(sourceRoot, 'v2/pages/HomeV2.tsx'), 'utf8');
const libraryCard = readFileSync(resolve(sourceRoot, 'design-system/components/MeditationCard.tsx'), 'utf8');
const indexHtml = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'public/manifest.webmanifest'), 'utf8'));

test('global tokens own typography, colors, spacing, controls, safe areas, and navigation geometry', () => {
  for (const token of ['--font-sans', '--font-editorial', '--color-bg-base', '--color-surface-primary', '--color-border-card', '--space-4', '--radius-lg', '--shadow-soft', '--target-min', '--button-height', '--safe-area-bottom', '--app-navigation-height', '--page-gutter', '--card-padding', '--motion-base']) {
    assert.match(tokens, new RegExp(token));
  }
  assert.match(styles, /@import "\.\/design-system\/index\.css"/);
  assert.doesNotMatch(styles, /font-family:\s*(Inter|"Playfair Display"|Georgia)/);
  assert.match(typeStyles, /\.type-page-title/);
  assert.match(typeStyles, /\.type-editorial/);
});

test('one canonical shared header, page header, tabs, navigation, and meditation card are in production', () => {
  assert.match(appSource, /<AppHeader/);
  assert.match(appSource, /<PageHeader/);
  assert.match(appSource, /<SegmentedTabs/);
  assert.match(appSource, /<BottomNavigation/);
  assert.match(appSource, /<SharedMeditationCard/);
  assert.match(libraryCard, /variant === 'tile'/);
  assert.equal((appSource.match(/<BottomNavigation/g) ?? []).length, 1);
  assert.doesNotMatch(appSource, /V2BottomNav/);
});

test('official versioned logo powers app surfaces and installation outputs', () => {
  const brandFiles = [
    'luna-logo-original-v2-20260718.png',
    'luna-logo-mark-v2-20260718.png',
    'luna-pwa-192-v2-20260718.png',
    'luna-pwa-512-v2-20260718.png',
    'luna-pwa-1024-v2-20260718.png',
    'luna-apple-touch-v2-20260718.png',
    'luna-favicon-v2-20260718.png'
  ];
  for (const file of brandFiles) {
    const path = resolve(process.cwd(), 'public/assets/brand', file);
    assert.ok(existsSync(path));
    assert.ok(statSync(path).size > 1000);
  }
  assert.match(home, /<BrandLogo/);
  assert.match(chat, /<BrandLogo/);
  assert.match(indexHtml, /luna-favicon-v2-20260718\.png/);
  assert.match(indexHtml, /luna-apple-touch-v2-20260718\.png/);
  assert.deepEqual(manifest.icons.map((icon) => icon.src), [
    '/assets/brand/luna-pwa-192-v2-20260718.png',
    '/assets/brand/luna-pwa-512-v2-20260718.png',
    '/assets/brand/luna-pwa-1024-v2-20260718.png'
  ]);
  assert.equal(manifest.version, '2026.07.18.2');
});

test('chat and Library scrolling share viewport-safe bottom clearance', () => {
  assert.match(primitives, /--app-navigation-clearance/);
  assert.match(primitives, /\.app-shell-chat/);
  assert.match(styles, /\.luna-live-chat\s*\{[^}]*height:\s*100%/s);
  assert.match(styles, /\.luna-live-composer\s*\{[^}]*margin-bottom:\s*0/s);
  assert.match(styles, /\.luna-quick-prompts\s*\{[^}]*overflow-x:\s*auto/s);
  assert.match(primitives, /\.library-filter-scroll[^}]*scroll-snap-type:\s*x proximity/s);
  assert.match(viewport, /window\.visualViewport/);
  assert.match(viewport, /viewportChanged/);
  assert.match(viewport, /--app-keyboard-inset/);
  assert.match(indexHtml, /width=device-width, initial-scale=1, viewport-fit=cover/);
});

test('duration formatting is human-readable in Home and Library in EN and RU', () => {
  const duration = readFileSync(resolve(sourceRoot, 'utils/duration.ts'), 'utf8');
  assert.match(duration, /`\$\{minutes\} min`/);
  assert.match(duration, /`\$\{minutes\} мин`/);
  assert.match(appSource, /formatMeditationDuration\(meditation\.duration, language\)/);
  assert.match(appSource, /durationLabel=\{\(seconds\) => formatMeditationDuration\(seconds, language\)\}/);
});

test('mobile target widths are covered by fluid, no-overflow layout rules', () => {
  const viewports = [[390, 844], [393, 852], [375, 812], [360, 800]];
  assert.equal(viewports.length, 4);
  assert.ok(viewports.every(([width, height]) => width >= 360 && height >= 800));
  assert.match(primitives, /max-width:\s*28rem/);
  assert.match(primitives, /@media \(max-width: 360px\)/);
  assert.match(appSource, /overflow-x-clip/);
});
