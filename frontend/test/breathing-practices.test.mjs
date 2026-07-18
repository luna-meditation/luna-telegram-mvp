import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = readFileSync(resolve(process.cwd(), 'src/features/breathing/practices.ts'), 'utf8');
const app = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');
const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

test('all nine real breathing practices live in one timing configuration', () => {
  for (const id of ['calm', 'box', '478', 'coherent', 'triangle', 'sigh', 'anxiety_reset', 'sleep', 'morning_energy']) {
    assert.match(source, new RegExp(`id: '${id}'`));
  }
  assert.match(source, /inhale_top/);
  assert.match(source, /breathPhaseAt/);
  assert.match(source, /remaining:/);
});

test('Breath Circle consumes shared timing and exposes active controls', () => {
  assert.match(app, /breathPractices/);
  assert.match(app, /breathPhaseAt/);
  for (const label of ['Pause', 'Resume', 'Restart']) assert.match(app, new RegExp(label));
  assert.match(styles, /prefers-reduced-motion/);
});
