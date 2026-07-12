import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const componentPath = resolve(process.cwd(), '../frontend/src/components/LunaChat.tsx');

test('Luna first screen renders a message input immediately', () => {
  const source = readFileSync(componentPath, 'utf8');
  assert.match(source, /className="luna-live-composer luna-overview-composer"/);
  assert.match(source, /placeholder=\{language === 'ru' \? 'Напишите Luna\.\.\.' : 'Message Luna\.\.\.'\}/);
});

test('Luna overview suggestion chips fill the input instead of hiding typing behind a start step', () => {
  const source = readFileSync(componentPath, 'utf8');
  assert.match(source, /prompts\.map\(\(prompt\) => <button key=\{prompt\} type="button" onClick=\{\(\) => setDraft/);
  assert.doesNotMatch(source, /prompts\.map\(\(prompt\) => <button key=\{prompt\} type="button" onClick=\{\(\) => beginConversation\(prompt\)/);
});
