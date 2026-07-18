import { Markup } from 'telegraf';
import { bot } from './bot.js';
import { env } from './config.js';
import { claimReminderDelivery, finishReminderDelivery, getReminderCandidates } from './db.js';
import { logBackendError } from './error-logging.js';
import { dueReminderTypes, localReminderClock, reminderIdempotencyKey, type ReminderType } from './notification-policy.js';

const goalNudge: Record<string, Record<'en' | 'ru', string>> = {
  sleep: { en: 'A quiet evening practice can support your sleep goal.', ru: 'Спокойная вечерняя практика поддержит твою цель для сна.' },
  anxiety: { en: 'A short grounding practice is ready when you are.', ru: 'Короткая заземляющая практика готова, когда будешь готов или готова.' },
  focus: { en: 'A few mindful minutes can clear space for focus.', ru: 'Несколько осознанных минут помогут освободить место для фокуса.' },
  routine: { en: 'One short return is enough to keep your calm routine growing.', ru: 'Одного короткого возвращения достаточно, чтобы поддержать спокойный ритм.' },
  stress: { en: 'A gentle reset can help the day feel lighter.', ru: 'Мягкая перезагрузка поможет сделать день легче.' }
};

function reminderText(type: ReminderType, language: 'en' | 'ru', goals: string[], currentStreak: number) {
  const personalized = goals.map((goal) => goalNudge[goal]?.[language]).find(Boolean);
  const copy: Record<ReminderType, Record<'en' | 'ru', string>> = {
    daily: {
      en: personalized ?? 'Your daily moment with Luna is ready.',
      ru: personalized ?? 'Твой ежедневный момент с Luna уже ждёт.'
    },
    morning: {
      en: personalized ?? 'Begin gently. A short Luna practice is ready for your morning.',
      ru: personalized ?? 'Начни мягко. Короткая практика Luna уже ждёт этим утром.'
    },
    evening: {
      en: personalized ?? 'The day can soften now. Your evening practice is ready.',
      ru: personalized ?? 'Теперь день может стать мягче. Вечерняя практика уже ждёт.'
    },
    streak_risk: {
      en: `Your ${Math.max(1, currentStreak)}-day streak is still within reach. One short practice is enough.`,
      ru: `Серия в ${Math.max(1, currentStreak)} дн. ещё рядом. Достаточно одной короткой практики.`
    },
    inactivity: {
      en: 'No pressure—Luna is here whenever you want a quiet return.',
      ru: 'Без давления — Luna рядом, когда захочется спокойно вернуться.'
    },
    weekly_summary: {
      en: 'Your weekly Luna reflection is ready in Journey.',
      ru: 'Твоя недельная рефлексия Luna готова в разделе «Путь».'
    }
  };
  return copy[type][language];
}

let sweepRunning = false;

export async function runReminderSweep(now = new Date()) {
  if (sweepRunning) return { candidates: 0, sent: 0, duplicates: 0, failed: 0 };
  sweepRunning = true;
  const totals = { candidates: 0, sent: 0, duplicates: 0, failed: 0 };
  try {
    const candidates = await getReminderCandidates();
    totals.candidates = candidates.length;
    for (const candidate of candidates) {
      const due = dueReminderTypes({
        preferences: candidate.preferences,
        now,
        currentStreak: candidate.currentStreak,
        lastPracticeDate: candidate.lastPracticeDate,
        lastSeenAt: candidate.lastSeenAt
      });
      const localDate = localReminderClock(now, candidate.preferences.timezone).localDate;
      for (const type of due) {
        const idempotencyKey = reminderIdempotencyKey(candidate.telegramId, type, localDate);
        const deliveryId = await claimReminderDelivery({ telegramId: candidate.telegramId, type, localDate, idempotencyKey });
        if (!deliveryId) {
          totals.duplicates += 1;
          continue;
        }
        try {
          await bot.telegram.sendMessage(
            candidate.telegramId,
            reminderText(type, candidate.language, candidate.goals, candidate.currentStreak),
            Markup.inlineKeyboard([[Markup.button.webApp(candidate.language === 'ru' ? 'Открыть Luna' : 'Open Luna', env.MINI_APP_URL)]])
          );
          await finishReminderDelivery(deliveryId, 'sent');
          totals.sent += 1;
          console.info('[Luna reminder sent]', { telegramId: candidate.telegramId, type, localDate, deliveryId });
        } catch (error) {
          totals.failed += 1;
          await finishReminderDelivery(deliveryId, 'failed', error instanceof Error ? error.message : String(error));
          logBackendError(error, { endpoint: 'Telegram reminder delivery', telegramId: candidate.telegramId, reminderType: type, deliveryId });
        }
      }
    }
    return totals;
  } finally {
    sweepRunning = false;
  }
}

export function startReminderScheduler() {
  if (!env.REMINDER_SCHEDULER_ENABLED) {
    console.info('[Luna reminders] Scheduler disabled by configuration.');
    return null;
  }
  const run = () => runReminderSweep().then((result) => {
    if (result.sent || result.failed) console.info('[Luna reminders] Sweep completed', result);
  }).catch((error) => logBackendError(error, { endpoint: 'Reminder scheduler sweep' }));
  void run();
  const timer = setInterval(run, 60_000);
  timer.unref();
  console.info('[Luna reminders] Telegram reminder scheduler active.');
  return timer;
}
