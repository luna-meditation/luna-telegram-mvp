import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const componentPath = resolve(process.cwd(), '../frontend/src/components/LunaChat.tsx');

test('Luna opens directly as chat and renders a message input immediately', () => {
  const source = readFileSync(componentPath, 'utf8');
  assert.match(source, /useState<'overview' \| 'chat'>\('chat'\)/);
  assert.match(source, /className="luna-live-composer"/);
  assert.match(source, /'Напишите Luna\.\.\.' : 'Message Luna\.\.\.'/);
});

test('retry keeps one user turn and reuses its client request id', () => {
  const source = readFileSync(componentPath, 'utf8');
  assert.match(source, /const clientRequestId = retry\?\.clientRequestId \?\? requestId\(\)/);
  assert.match(source, /if \(!retry\) setMessages/);
  assert.match(source, /requestId: clientRequestId/);
  assert.doesNotMatch(source, /current\.filter\(\(message\) => message\.id !== optimistic\.id\)/);
});

test('quota exhaustion has no Retry and disables the composer', () => {
  const source = readFileSync(componentPath, 'utf8');
  assert.match(source, /failedTurn\.state !== 'quota_exhausted'/);
  assert.match(source, /disabled=\{thinking \|\| quotaExhausted\}/);
  assert.match(source, /Сообщения Luna на сегодня закончились/);
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

test('recommended meditation ids render as an in-chat card with an Open action', () => {
  const source = readFileSync(componentPath, 'utf8');
  assert.match(source, /message\.metadata\?\.recommendedMeditationId/);
  assert.match(source, /meditations\.find\(\(item\) => item\.id === recommendationId\)/);
  assert.match(source, /message\.metadata\?\.recommendedMeditation/);
  assert.match(source, /className="luna-recommendation-message"/);
  assert.match(source, /onClick=\{\(\) => onOpenMeditation\(recommendation\)\}/);
  assert.match(source, /language === 'ru' \? 'Открыть' : 'Open'/);
});
