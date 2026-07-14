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
}): LunaResponseReview {
  const issues: string[] = [];
  const message = input.message.trim();
  const sentences = normalizedSentences(message);
  const unique = new Set(sentences);
  const questionCount = (message.match(/\?/g) ?? []).length;

  if (!message) issues.push('empty_response');
  if (!input.userRequestedDepth && (sentences.length > 5 || message.length > 700)) issues.push('too_long_for_mobile_conversation');
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

  return { accepted: issues.length === 0, issues };
}

export function isLongFormRequest(message: string) {
  return /\b(?:explain in detail|deep dive|step by step|long answer|tell me everything)\b|(?:подробно|детально|по шагам|длинный ответ|расскажи всё)/i.test(message);
}

export function constrainLunaResponse(input: {
  message: string;
  language: 'en' | 'ru';
  clarificationAllowed: boolean;
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
    })
    .slice(0, 5);
  const result = sentences.join(' ').trim().slice(0, 700).trim();
  if (result) return result;
  return input.language === 'ru' ? 'Я рядом.' : "I'm here.";
}
