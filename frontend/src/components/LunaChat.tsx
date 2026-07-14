import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, History, Plus, RotateCcw, Send, Trash2 } from 'lucide-react';
import {
  ApiRequestError,
  deleteLunaConversation,
  getLunaConversation,
  getLunaConversations,
  sendLunaMessage,
  type AppLanguage,
  type LunaConversationSummary,
  type LunaMessage,
  type Meditation
} from '../api';
import { useChatViewport } from '../hooks/useChatViewport';
import { formatMeditationDuration } from '../utils/duration';

type LunaChatProps = {
  firstName: string;
  language: AppLanguage;
  meditations: Meditation[];
  hasPremium: boolean;
  initData?: string;
  onOpenMeditation: (meditation: Meditation) => void;
};

const activeConversationKey = 'luna.ai.activeConversation.v1';

function requestId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `luna-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

type FailedTurn = {
  clientRequestId: string;
  text: string;
  optimisticMessageId: string;
  message: string;
  retryable: boolean;
  state: 'failed_retryable' | 'failed_non_retryable' | 'quota_exhausted' | 'processing';
  resetAt?: string | null;
};

function errorDetails(error: unknown, language: AppLanguage): Omit<FailedTurn, 'clientRequestId' | 'text' | 'optimisticMessageId'> {
  let code = '';
  let retryable = false;
  let state: FailedTurn['state'] = 'failed_retryable';
  let resetAt: string | null = null;
  if (error instanceof ApiRequestError && error.responseBody) {
    try {
      const body = JSON.parse(error.responseBody) as { code?: string; retryable?: boolean; requestState?: FailedTurn['state']; resetAt?: string | null };
      code = body.code ?? '';
      retryable = Boolean(body.retryable);
      state = body.requestState ?? state;
      resetAt = body.resetAt ?? null;
    } catch { code = ''; }
  }
  if (code === 'quota_exhausted' || code === 'daily_limit') return {
    message: language === 'ru' ? 'Сообщения Luna на сегодня закончились. Лимит обновится завтра.' : 'Your Luna messages for today are used. The limit resets tomorrow.',
    retryable: false, state: 'quota_exhausted', resetAt
  };
  if (code === 'chat_disabled' || code === 'missing_api_key') return {
    message: language === 'ru' ? 'Разговоры с Luna сейчас недоступны.' : 'Luna conversations are unavailable right now.',
    retryable: false, state: 'failed_non_retryable', resetAt
  };
  if (code === 'timeout') return {
    message: language === 'ru' ? 'Luna не успела ответить. Можно повторить этот запрос.' : 'Luna took too long to respond. You can retry this message.',
    retryable: true, state: 'failed_retryable', resetAt
  };
  if (code === 'request_in_progress') return {
    message: language === 'ru' ? 'Luna ещё отвечает на это сообщение.' : 'Luna is still responding to this message.',
    retryable: true, state: 'processing', resetAt
  };
  if (error instanceof ApiRequestError && error.status === 401) return {
    message: language === 'ru' ? 'Открой Luna внутри Telegram, чтобы продолжить разговор.' : 'Open Luna inside Telegram to continue your conversation.',
    retryable: false, state: 'failed_non_retryable', resetAt
  };
  return {
    message: language === 'ru' ? 'Luna сейчас не смогла ответить. Можно повторить этот запрос.' : 'Luna could not respond just now. You can retry this message.',
    retryable: retryable || !(error instanceof ApiRequestError && error.status !== null && error.status < 500),
    state: retryable ? state : 'failed_retryable', resetAt
  };
}

function localizeMeditation(meditation: Meditation, language: AppLanguage) {
  const translation = meditation.translations?.[language];
  return { title: translation?.title || meditation.title, subtitle: translation?.subtitle || meditation.subtitle };
}

function dateLabel(value: string, language: AppLanguage) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return language === 'ru' ? 'Сегодня' : 'Today';
  return new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', { month: 'short', day: 'numeric' }).format(date);
}

export function LunaChat({ firstName, language, meditations, hasPremium, initData, onOpenMeditation }: LunaChatProps) {
  const [conversations, setConversations] = useState<LunaConversationSummary[]>([]);
  const [activeId, setActiveId] = useState('');
  const [messages, setMessages] = useState<LunaMessage[]>([]);
  const [screen, setScreen] = useState<'overview' | 'chat'>('chat');
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState('');
  const [failedTurn, setFailedTurn] = useState<FailedTurn | null>(null);
  const [quotaExhausted, setQuotaExhausted] = useState(false);
  const [awayFromBottom, setAwayFromBottom] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const nearBottomRef = useRef(true);
  useChatViewport(true);

  const prompts = language === 'ru'
    ? ['🌙 Не могу уснуть', '🧠 Мысли не останавливаются', '💼 Я перегружен(а)', '❤️ Мне нужно поговорить', '✨ Подбери медитацию']
    : ["🌙 I can't sleep", "🧠 My thoughts won't stop", "💼 I'm overwhelmed", '❤️ I need someone to talk to', '✨ Recommend a meditation'];

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = '0px';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 112)}px`;
  }, [draft]);

  const refreshConversations = useCallback(async () => {
    try {
      const next = await getLunaConversations(initData);
      setConversations(next);
      setError('');
      return next;
    } catch (loadError) {
      console.info('[Luna conversation history load failed]', loadError instanceof Error ? loadError.name : 'unknown');
      setError(language === 'ru' ? 'Не удалось загрузить историю разговоров. Можно начать новый разговор или обновить историю.' : 'Conversation history could not load. You can start a new conversation or reload the history.');
      return [];
    }
  }, [initData, language]);

  const openConversation = useCallback(async (conversationId: string) => {
    setLoading(true);
    setError('');
    try {
      const result = await getLunaConversation(conversationId, initData);
      setActiveId(conversationId);
      setMessages(result.messages);
      setScreen('chat');
      window.localStorage.setItem(activeConversationKey, conversationId);
      requestAnimationFrame(() => {
        const list = listRef.current;
        if (list) list.scrollTop = list.scrollHeight;
      });
    } catch (loadError) {
      console.info('[Luna conversation load failed]', loadError instanceof Error ? loadError.name : 'unknown');
      setError(language === 'ru' ? 'Не удалось открыть этот разговор. Обнови историю и попробуй снова.' : 'This conversation could not open. Reload the history and try again.');
    } finally {
      setLoading(false);
    }
  }, [initData, language]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const next = await refreshConversations();
      if (!alive) return;
      const stored = window.localStorage.getItem(activeConversationKey);
      if (stored && next.some((conversation) => conversation.id === stored)) await openConversation(stored);
      else {
        setScreen('chat');
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [openConversation, refreshConversations]);

  const scrollToLatest = useCallback((smooth = true) => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    nearBottomRef.current = true;
    setAwayFromBottom(false);
  }, []);

  useEffect(() => {
    if (screen !== 'chat' || !nearBottomRef.current) return;
    requestAnimationFrame(() => scrollToLatest(messages.length > 1));
  }, [messages.length, screen, scrollToLatest, thinking]);

  useEffect(() => {
    if (screen !== 'chat') return;
    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
    };
  }, [screen]);

  const beginConversation = (seed = '') => {
    setActiveId('');
    setMessages([]);
    setDraft(seed.replace(/^[^\p{L}\p{N}]+/u, '').trim());
    setError('');
    setFailedTurn(null);
    setScreen('chat');
    window.localStorage.removeItem(activeConversationKey);
  };

  const submit = async (text: string, retry?: FailedTurn) => {
    const clean = text.trim();
    if (!clean || thinking || quotaExhausted || clean.length > 2000) return;
    const clientRequestId = retry?.clientRequestId ?? requestId();
    const optimistic: LunaMessage = retry
      ? { id: retry.optimisticMessageId, request_id: clientRequestId, role: 'user', content: clean, created_at: new Date().toISOString() }
      : { id: requestId(), request_id: clientRequestId, role: 'user', content: clean, created_at: new Date().toISOString() };
    if (screen !== 'chat') {
      setActiveId('');
      setMessages([]);
      setScreen('chat');
      window.localStorage.removeItem(activeConversationKey);
    }
    setDraft('');
    setError('');
    setFailedTurn(null);
    if (!retry) setMessages((current) => [...current, optimistic]);
    setThinking(true);
    nearBottomRef.current = true;
    try {
      const result = await sendLunaMessage({ conversationId: activeId || undefined, message: clean, language, requestId: clientRequestId }, initData);
      setActiveId(result.conversationId);
      window.localStorage.setItem(activeConversationKey, result.conversationId);
      setMessages((current) => [...current, result.message]);
      await refreshConversations();
    } catch (sendError) {
      const details = errorDetails(sendError, language);
      setQuotaExhausted(details.state === 'quota_exhausted');
      setFailedTurn({ ...details, clientRequestId, text: clean, optimisticMessageId: optimistic.id });
    } finally {
      setThinking(false);
    }
  };

  const removeConversation = async () => {
    if (!activeId) return;
    try {
      await deleteLunaConversation(activeId, initData);
      window.localStorage.removeItem(activeConversationKey);
      setActiveId('');
      setMessages([]);
      setScreen('chat');
      await refreshConversations();
    } catch (removeError) {
      setError(errorDetails(removeError, language).message);
    }
  };

  const activeTitle = conversations.find((conversation) => conversation.id === activeId)?.title || 'Luna';
  const visibleMessages = useMemo(() => messages.filter((message) => message.role === 'user' || message.role === 'assistant'), [messages]);

  if (screen === 'overview') {
    return (
      <div className="luna-ai-overview">
        <div className="luna-ai-overview-header">
          <div><h2>Luna</h2><p>{language === 'ru' ? 'Твой тихий компаньон' : 'Your quiet companion'}</p></div>
          <button type="button" onClick={() => beginConversation()} aria-label={language === 'ru' ? 'Новый разговор' : 'New conversation'}><Plus size={20} /></button>
        </div>
        <section className="luna-ai-recent">
          <h3>{language === 'ru' ? 'Недавние разговоры' : 'Recent Conversations'}</h3>
          {loading ? <div className="luna-ai-loading-line" /> : conversations.length ? conversations.slice(0, 6).map((conversation) => (
            <button key={conversation.id} type="button" onClick={() => void openConversation(conversation.id)}>
              <span><strong>{conversation.title || (language === 'ru' ? 'Разговор с Luna' : 'Conversation with Luna')}</strong><small>{conversation.latestMessage}</small></span>
              <time>{dateLabel(conversation.last_message_at, language)}</time>
            </button>
          )) : <p className="luna-ai-empty-history">{language === 'ru' ? 'Первый разговор начнётся, когда ты будешь готов(а).' : 'Your first conversation can begin whenever you are ready.'}</p>}
        </section>
        {error ? <p className="luna-ai-error">{error}</p> : null}
      </div>
    );
  }

  return (
    <section className="luna-live-chat" aria-busy={thinking}>
      <header className="luna-live-chat-header">
        <button type="button" onClick={() => { setScreen('overview'); setError(''); }} aria-label={language === 'ru' ? 'История разговоров' : 'Conversation history'}><History size={19} /></button>
        <div><h2>{activeTitle}</h2><p>{thinking ? (language === 'ru' ? 'Luna думает...' : 'Luna is reflecting...') : (language === 'ru' ? 'Рядом и слушает' : 'Here and listening')}</p></div>
        <button type="button" onClick={() => void removeConversation()} disabled={!activeId} aria-label={language === 'ru' ? 'Удалить разговор' : 'Delete conversation'}><Trash2 size={17} /></button>
      </header>

      <div
        ref={listRef}
        className="luna-live-message-list"
        onScroll={(event) => {
          const target = event.currentTarget;
          const nearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 72;
          nearBottomRef.current = nearBottom;
          setAwayFromBottom(!nearBottom);
        }}
      >
        {loading ? (
          <div className="space-y-3 px-2" aria-label={language === 'ru' ? 'Загрузка разговора' : 'Loading conversation'}>
            <div className="luna-ai-loading-line" />
            <div className="luna-ai-loading-line ml-auto max-w-[76%]" />
            <div className="luna-ai-loading-line max-w-[86%]" />
          </div>
        ) : !visibleMessages.length ? (
          <div className="luna-live-empty">
            <div className="luna-breathing-orb" aria-hidden="true" />
            <h3>{language === 'ru' ? `Я рядом, ${firstName || 'друг'}.` : `I'm here, ${firstName || 'friend'}.`}</h3>
            <p>{language === 'ru' ? 'Расскажи, что у тебя на душе. Я выслушаю без осуждения.' : "Tell me what's on your mind. I'll listen without judgment."}</p>
            <div>{prompts.slice(0, 4).map((prompt) => <button key={prompt} type="button" onClick={() => setDraft(prompt.replace(/^[^\p{L}\p{N}]+/u, '').trim())}>{prompt}</button>)}</div>
          </div>
        ) : visibleMessages.map((message) => {
          const recommendationId = message.metadata?.recommendedMeditationId;
          const recommendation = recommendationId
            ? meditations.find((item) => item.id === recommendationId) ?? message.metadata?.recommendedMeditation ?? undefined
            : undefined;
          const localized = recommendation ? localizeMeditation(recommendation, language) : null;
          return (
            <div key={message.id} className={`luna-live-message-row luna-live-message-${message.role}`}>
              {message.role === 'assistant' ? <span className="luna-message-orb" aria-hidden="true" /> : null}
              <div className="luna-live-message-content">
                <div className="luna-message-bubble"><p>{message.content}</p></div>
                {recommendation && localized ? (
                  <button type="button" className="luna-recommendation-message" onClick={() => onOpenMeditation(recommendation)}>
                    <img src={recommendation.cover_image} alt="" />
                    <span><strong>{localized.title}</strong><small>{localized.subtitle} · {formatMeditationDuration(recommendation.duration, language)}</small></span>
                    <b>{recommendation.premium && !hasPremium ? (language === 'ru' ? 'Premium' : 'Premium') : (language === 'ru' ? 'Открыть' : 'Open')}</b>
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
        {thinking ? <div className="luna-thinking-indicator"><span className="luna-message-orb luna-message-orb-thinking" /><span>{language === 'ru' ? 'Luna рядом...' : 'Luna is here...'}</span></div> : null}
        {failedTurn ? <div className={`luna-live-error luna-live-error-${failedTurn.state}`} role="status">
          <p>{failedTurn.message}</p>
          {failedTurn.retryable && failedTurn.state !== 'quota_exhausted' ? <button type="button" disabled={thinking} onClick={() => void submit(failedTurn.text, failedTurn)}><RotateCcw size={14} />{language === 'ru' ? 'Повторить' : 'Retry'}</button> : null}
        </div> : null}
        {error ? <div className="luna-live-error" role="status">
          <p>{error}</p>
          <button type="button" disabled={loading} onClick={() => void refreshConversations()}>
            <RotateCcw size={14} />{language === 'ru' ? 'Обновить историю' : 'Reload history'}
          </button>
        </div> : null}
      </div>

      {awayFromBottom ? <button type="button" className="luna-scroll-latest" onClick={() => scrollToLatest()} aria-label={language === 'ru' ? 'К последнему сообщению' : 'Scroll to latest'}><ArrowDown size={17} /></button> : null}

      <form className="luna-live-composer" onSubmit={(event) => { event.preventDefault(); void submit(draft); }}>
        <textarea ref={textareaRef}
          value={draft}
          rows={1}
          maxLength={2000}
          disabled={thinking || quotaExhausted}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onFocus={() => requestAnimationFrame(() => scrollToLatest(false))}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void submit(draft);
            }
          }}
          placeholder={quotaExhausted ? (language === 'ru' ? 'Лимит обновится завтра' : 'Limit resets tomorrow') : (language === 'ru' ? 'Напишите Luna...' : 'Message Luna...')}
        />
        <button type="submit" disabled={!draft.trim() || thinking || quotaExhausted} aria-label={language === 'ru' ? 'Отправить' : 'Send'}><Send size={17} /></button>
      </form>
    </section>
  );
}
