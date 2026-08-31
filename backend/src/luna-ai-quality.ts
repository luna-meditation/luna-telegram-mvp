import { assistantQuestionHash, type LunaConversationState } from './luna-ai-state.js';

export type LunaResponseReview = { accepted: boolean; issues: string[] };

function normalizedSentences(message: string) {
  return message
    .split(/(?<=[.!?])\s+|\n+/u)
    .map((sentence) => sentence.trim().toLowerCase())
    .filter(Boolean);
}

export function reviewLunaResponse(input: {
  message: string;
  language: 'en' | 'ru';
  state: LunaConversationState;
  clarificationAllowed: boolean;
  userRequestedDepth?: boolean;
  completionRequired?: boolean;
}): LunaResponseReview {
  const issues: string[] = [];
  const message = input.message.trim();
  const sentences = normalizedSentences(message);
  const unique = new Set(sentences);
  const questionCount = (message.match(/\?/g) ?? []).length;

  if (!message) issues.push('empty_response');
  if (!input.userRequestedDepth && !input.completionRequired && (sentences.length > 5 || message.length > 700)) issues.push('too_long_for_mobile_conversation');
  if (unique.size < sentences.length) issues.push('repeated_sentence');
  if (/\b(?:the application|the system|my functionality|the algorithm)\b|(?:приложение|система|моя функциональность|алгоритм)/i.test(message)) {
    issues.push('software_language');
  }
  if (questionCount > 1) issues.push('too_many_questions');
  if (questionCount && !input.clarificationAllowed && input.state.assistant_messages_since_question < 3) {
    issues.push('question_too_soon');
  }
  if (questionCount && input.state.previous_assistant_question_hash === assistantQuestionHash(message)) {
    issues.push('repeated_clarification');
  }
  if (input.language === 'ru' && /\b(?:would you like|do you want|i can assist)\b/i.test(message)) issues.push('mixed_language');
  if (input.language === 'en' && /(?:хочешь ли|я могу помочь|тебе нужно)/i.test(message)) issues.push('mixed_language');
  if (input.completionRequired) {
    const startsBreathingCycle = /\b(?:inhale|breathe in)\b|(?:^|[\s.!?])вдох(?:ни|ните)?(?=$|[\s,.!?])/i.test(message);
    const completesExhale = /\b(?:exhale|breathe out)\b|(?:^|[\s.!?])выдох(?:ни|ните)?(?=$|[\s,.!?])/i.test(message);
    const includesRepetition = /\b(?:repeat|cycle|round)\b|(?:повтори|повторяй|цикл|круг)/i.test(message);
    if (startsBreathingCycle && (!completesExhale || !includesRepetition)) issues.push('incomplete_guided_breathing_cycle');
  }

  return { accepted: issues.length === 0, issues };
}

export function isLongFormRequest(message: string) {
  return /\b(?:explain in detail|deep dive|step by step|long answer|tell me everything)\b|(?:подробно|детально|по шагам|длинный ответ|расскажи всё)/i.test(message);
}

export function isGuidedPracticeRequest(message: string) {
  return /\b(?:guide me|walk me through|do it with me|let's do an? (?:breathing |grounding )?exercise|breathing exercise|grounding exercise|mini meditation)\b/i.test(message) ||
    /(?:проведи\s+меня|сделай\s+со\s+мной|давай\s+(?:сделаем\s+)?(?:дыхательное\s+|заземляющее\s+)?упражнение|дыхательное\s+упражнение|мини[- ]?медитац)/i.test(message);
}

export function completeGuidedPracticeFallback(language: 'en' | 'ru') {
  return language === 'ru'
    ? '60-секундная перезагрузка\n\n1. Мягко вдохни через нос на 4 счёта.\n2. Сделай комфортную паузу на 2 счёта — без усилия.\n3. Медленно выдохни на 6 счётов.\n4. Повтори полный цикл 4–6 раз в удобном темпе.\n5. После последнего выдоха вернись к обычному дыханию и спокойно заметь опору под телом.'
    : '60-second reset\n\n1. Inhale gently through your nose for 4.\n2. Pause for 2 if that feels comfortable—never force it.\n3. Exhale slowly for 6.\n4. Repeat the complete cycle 4–6 times at an easy pace.\n5. After the final exhale, return to natural breathing and notice the support beneath you.';
}

export function constrainLunaResponse(input: {
  message: string;
  language: 'en' | 'ru';
  clarificationAllowed: boolean;
  completionRequired?: boolean;
}) {
  const seen = new Set<string>();
  const sentences = input.message
    .split(/(?<=[.!?])\s+|\n+/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => {
      if (!sentence) return false;
      if (!input.clarificationAllowed && sentence.includes('?')) return false;
      const key = sentence.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  const result = (input.completionRequired ? sentences : sentences.slice(0, 5)).join(input.completionRequired ? '\n' : ' ').trim();
  if (result) return result;
  return input.language === 'ru' ? 'Я рядом.' : "I'm here.";
}
