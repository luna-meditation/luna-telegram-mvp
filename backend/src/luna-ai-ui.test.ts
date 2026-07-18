import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const componentPath = resolve(process.cwd(), '../frontend/src/components/LunaChat.tsx');
const chatCardPath = resolve(process.cwd(), '../frontend/src/design-system/components/ChatMeditationCard.tsx');
const viewportPath = resolve(process.cwd(), '../frontend/src/hooks/useChatViewport.ts');
const appPath = resolve(process.cwd(), '../frontend/src/App.tsx');

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
  assert.match(source, /setDraft\(prompt\)/);
  assert.match(source, /className="luna-quick-prompts"/);
  assert.doesNotMatch(source, /prompts\.slice/);
  assert.doesNotMatch(source, /prompts\.map\(\(prompt\) => <button key=\{prompt\} type="button" onClick=\{\(\) => beginConversation\(prompt\)/);
});

test('Luna initial chat has no dashboard thought block and uses iOS-safe viewport architecture', () => {
  const source = readFileSync(componentPath, 'utf8');
  const viewport = readFileSync(viewportPath, 'utf8');
  const app = readFileSync(appPath, 'utf8');
  assert.doesNotMatch(source, /Today.?s Thought|Мысль дня|dailyThought/);
  assert.match(app, /useAppViewport\(true\)/);
  assert.match(viewport, /window\.visualViewport/);
  assert.match(viewport, /viewportChanged/);
  assert.match(viewport, /--app-keyboard-inset/);
  assert.match(source, /ref=\{textareaRef\}/);
});

test('recommended meditation ids render as one shared in-chat practice card', () => {
  const source = readFileSync(componentPath, 'utf8');
  const card = readFileSync(chatCardPath, 'utf8');
  assert.match(source, /metadata\.recommendedMeditationId/);
  assert.match(source, /metadata\.meditationAction\?\.meditationId/);
  assert.match(source, /hasOwnProperty\.call\(metadata, 'meditationAction'\)/);
  assert.match(source, /meditations\.find\(\(item\) => item\.id === recommendationId\)/);
  assert.match(source, /message\.metadata\?\.recommendedMeditation/);
  assert.match(source, /<ChatMeditationCard/);
  assert.match(source, /onOpen=\{\(\) => onOpenMeditation\(recommendation\)\}/);
  assert.match(card, /language === 'ru' \? 'Начать практику' : 'Start practice'/);
  assert.match(card, /language === 'ru' \? 'Бесплатно' : 'Free'/);
  assert.match(card, /formatMeditationDuration/);
});
