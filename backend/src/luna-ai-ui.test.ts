import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const componentPath = resolve(process.cwd(), '../frontend/src/components/LunaChat.tsx');

test('Luna opens directly as chat and renders a message input immediately', () => {
  const source = readFileSync(componentPath, 'utf8');
  assert.match(source, /useState<'overview' \| 'chat'>\('chat'\)/);
  assert.match(source, /className="luna-live-composer"/);
  assert.match(source, /placeholder=\{language === 'ru' \? 'Напишите Luna\.\.\.' : 'Message Luna\.\.\.'\}/);
});

test('suggestion chips fill the input instead of hiding typing behind a start step', () => {
  const source = readFileSync(componentPath, 'utf8');
  assert.match(source, /setDraft\(prompt\.replace/);
  assert.doesNotMatch(source, /prompts\.map\(\(prompt\) => <button key=\{prompt\} type="button" onClick=\{\(\) => beginConversation\(prompt\)/);
});

test('Luna initial chat has no dashboard thought block and uses iOS-safe viewport architecture', () => {
  const source = readFileSync(componentPath, 'utf8');
  assert.doesNotMatch(source, /Today.?s Thought|Мысль дня|dailyThought/);
  assert.match(source, /useChatViewport\(true\)/);
  assert.match(source, /ref=\{textareaRef\}/);
});
