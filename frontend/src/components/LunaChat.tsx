import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, Plus, RotateCcw, Send, Trash2 } from 'lucide-react';
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

function localizedError(error: unknown, language: AppLanguage) {
  let code = '';
  if (error instanceof ApiRequestError && error.responseBody) {
    try { code = (JSON.parse(error.responseBody) as { code?: string }).code ?? ''; } catch { code = ''; }
  }
  if (code === 'daily_limit') return language === 'ru' ? 'Лимит сообщений на сегодня достигнут. Возвращайся завтра или открой Luna Premium.' : 'Your Luna messages for today are used. Return tomorrow or explore Luna Premium.';
  if (code === 'chat_disabled' || code === 'missing_api_key') return language === 'ru' ? 'Разговоры с Luna пока недоступны. Попробуй немного позже.' : 'Luna conversations are unavailable right now. Please try again later.';
  if (code === 'timeout') return language === 'ru' ? 'Luna не успела ответить. Попробуй ещё раз.' : 'Luna took too long to respond. Please try again.';
  if (error instanceof ApiRequestError && error.status === 401) return language === 'ru' ? 'Открой Luna внутри Telegram, чтобы продолжить разговор.' : 'Open Luna inside Telegram to continue your conversation.';
  return language === 'ru' ? 'Luna сейчас не смогла ответить. Попробуй ещё раз через минуту.' : 'Luna could not respond just now. Please try again in a moment.';
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

function dailyThought(language: AppLanguage) {
  const thoughts = language === 'ru'
    ? ['Отдых не нужно заслуживать. Иногда его просто можно себе позволить.', 'Мягкий выдох тоже считается возвращением к себе.', 'Тебе не нужно решать всё сразу. Начни с одного спокойного момента.', 'Иногда забота о себе звучит очень тихо: я здесь.']
    : ["Rest isn't something you earn. Sometimes it's simply something you allow yourself.", 'A softer breath still counts as returning to yourself.', "You don't have to solve everything at once. Begin with one calm moment.", "Sometimes self-care sounds very quiet: I'm here."];
  return thoughts[Math.floor(Date.now() / 86_400_000) % thoughts.length];
}

export function LunaChat({ firstName, language, meditations, hasPremium, initData, onOpenMeditation }: LunaChatProps) {
  const [conversations, setConversations] = useState<LunaConversationSummary[]>([]);
  const [activeId, setActiveId] = useState('');
  const [messages, setMessages] = useState<LunaMessage[]>([]);
  const [screen, setScreen] = useState<'overview' | 'chat'>('overview');
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState('');
  const [retryText, setRetryText] = useState('');
  const [awayFromBottom, setAwayFromBottom] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const nearBottomRef = useRef(true);

  const prompts = language === 'ru'
    ? ['🌙 Не могу уснуть', '🧠 Мысли не останавливаются', '💼 Я перегружен(а)', '❤️ Мне нужно поговорить', '✨ Подбери медитацию']
    : ["🌙 I can't sleep", "🧠 My thoughts won't stop", "💼 I'm overwhelmed", '❤️ I need someone to talk to', '✨ Recommend a meditation'];

  const refreshConversations = useCallback(async () => {
    try {
      const next = await getLunaConversations(initData);
      setConversations(next);
      return next;
    } catch (loadError) {
      setError(localizedError(loadError, language));
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
      setError(localizedError(loadError, language));
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
      else setLoading(false);
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
    setRetryText('');
    setScreen('chat');
    window.localStorage.removeItem(activeConversationKey);
  };

  const submit = async (text: string) => {
    const clean = text.trim();
    if (!clean || thinking || clean.length > 2000) return;
    const optimistic: LunaMessage = { id: requestId(), role: 'user', content: clean, created_at: new Date().toISOString() };
    if (screen !== 'chat') {
      setActiveId('');
      setMessages([]);
      setScreen('chat');
      window.localStorage.removeItem(activeConversationKey);
    }
    setDraft('');
    setError('');
    setRetryText('');
    setMessages((current) => [...current, optimistic]);
    setThinking(true);
    nearBottomRef.current = true;
    try {
      const result = await sendLunaMessage({ conversationId: activeId || undefined, message: clean, language, requestId: requestId() }, initData);
      setActiveId(result.conversationId);
      window.localStorage.setItem(activeConversationKey, result.conversationId);
      setMessages((current) => [...current, result.message]);
      await refreshConversations();
    } catch (sendError) {
      setMessages((current) => current.filter((message) => message.id !== optimistic.id));
      setError(localizedError(sendError, language));
      setRetryText(clean);
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
      setScreen('overview');
      await refreshConversations();
    } catch (removeError) {
      setError(localizedError(removeError, language));
    }
  };

  const activeTitle = conversations.find((conversation) => conversation.id === activeId)?.title || (language === 'ru' ? 'Новый разговор' : 'New conversation');
  const visibleMessages = useMemo(() => messages.filter((message) => message.role === 'user' || message.role === 'assistant'), [messages]);

  if (screen === 'overview') {
    return (
      <div className="luna-ai-overview">
        <div className="luna-ai-overview-header">
          <div><h2>Luna</h2><p>{language === 'ru' ? 'Твой тихий компаньон' : 'Your quiet companion'}</p></div>
          <button type="button" onClick={() => beginConversation()} aria-label={language === 'ru' ? 'Новый разговор' : 'New conversation'}><Plus size={20} /></button>
        </div>
        <section className="luna-ai-welcome">
          <div className="luna-breathing-orb" aria-hidden="true" />
          <h3>{language === 'ru' ? `Привет, ${firstName || 'друг'}.` : `Hello, ${firstName || 'friend'}.`}</h3>
          <p>{language === 'ru' ? 'Напиши в своём темпе. Я рядом и слушаю.' : "Write at your own pace. I'm here and listening."}</p>
        </section>
        <form className="luna-live-composer luna-overview-composer" onSubmit={(event) => { event.preventDefault(); void submit(draft); }}>
          <textarea
            value={draft}
            rows={1}
            maxLength={2000}
            disabled={thinking}
            onChange={(event) => setDraft(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void submit(draft);
              }
            }}
            placeholder={language === 'ru' ? 'Напишите Luna...' : 'Message Luna...'}
          />
          <button type="submit" disabled={!draft.trim() || thinking} aria-label={language === 'ru' ? 'Отправить' : 'Send'}><Send size={17} /></button>
        </form>
        <div className="luna-ai-prompts">
          {prompts.map((prompt) => <button key={prompt} type="button" onClick={() => setDraft(prompt.replace(/^[^\p{L}\p{N}]+/u, '').trim())}>{prompt}</button>)}
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
        <section className="luna-thought-card"><p className="luna-ai-kicker">{language === 'ru' ? 'Мысль дня' : "Today's Thought"}</p><p>{dailyThought(language)}</p></section>
        {error ? <p className="luna-ai-error">{error}</p> : null}
      </div>
    );
  }

  return (
    <section className="luna-live-chat" aria-busy={thinking}>
      <header className="luna-live-chat-header">
        <button type="button" onClick={() => { setScreen('overview'); setError(''); }} aria-label={language === 'ru' ? 'Назад' : 'Back'}><ArrowLeft size={19} /></button>
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
        {!visibleMessages.length ? (
          <div className="luna-live-empty">
            <div className="luna-breathing-orb" aria-hidden="true" />
            <h3>{language === 'ru' ? `Я рядом, ${firstName || 'друг'}.` : `I'm here, ${firstName || 'friend'}.`}</h3>
            <p>{language === 'ru' ? 'Расскажи, что у тебя на душе. Я выслушаю без осуждения.' : "Tell me what's on your mind. I'll listen without judgment."}</p>
            <div>{prompts.slice(0, 4).map((prompt) => <button key={prompt} type="button" onClick={() => setDraft(prompt.replace(/^[^\p{L}\p{N}]+/u, '').trim())}>{prompt}</button>)}</div>
          </div>
        ) : visibleMessages.map((message) => {
          const recommendationId = message.metadata?.recommendedMeditationId;
          const recommendation = recommendationId ? meditations.find((item) => item.id === recommendationId) : undefined;
          const localized = recommendation ? localizeMeditation(recommendation, language) : null;
          return (
            <div key={message.id} className={`luna-live-message-row luna-live-message-${message.role}`}>
              {message.role === 'assistant' ? <span className="luna-message-orb" aria-hidden="true" /> : null}
              <div className="luna-live-message-content">
                <div className="luna-message-bubble"><p>{message.content}</p></div>
                {recommendation && localized ? (
                  <button type="button" className="luna-recommendation-message" onClick={() => onOpenMeditation(recommendation)}>
                    <img src={recommendation.cover_image} alt="" />
                    <span><strong>{localized.title}</strong><small>{localized.subtitle} · {Math.ceil(recommendation.duration / 60)} min</small></span>
                    <b>{recommendation.premium && !hasPremium ? (language === 'ru' ? 'Premium' : 'Premium') : (language === 'ru' ? 'Открыть' : 'Open')}</b>
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
        {thinking ? <div className="luna-thinking-indicator"><span className="luna-message-orb luna-message-orb-thinking" /><span>{language === 'ru' ? 'Luna рядом...' : 'Luna is here...'}</span></div> : null}
        {error ? <div className="luna-live-error"><p>{error}</p>{retryText ? <button type="button" onClick={() => void submit(retryText)}><RotateCcw size={14} />{language === 'ru' ? 'Повторить' : 'Retry'}</button> : null}</div> : null}
      </div>

      {awayFromBottom ? <button type="button" className="luna-scroll-latest" onClick={() => scrollToLatest()} aria-label={language === 'ru' ? 'К последнему сообщению' : 'Scroll to latest'}><ArrowDown size={17} /></button> : null}

      <form className="luna-live-composer" onSubmit={(event) => { event.preventDefault(); void submit(draft); }}>
        <textarea
          value={draft}
          rows={1}
          maxLength={2000}
          disabled={thinking}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void submit(draft);
            }
          }}
          placeholder={language === 'ru' ? 'Напишите Luna...' : 'Message Luna...'}
        />
        <button type="submit" disabled={!draft.trim() || thinking} aria-label={language === 'ru' ? 'Отправить' : 'Send'}><Send size={17} /></button>
      </form>
    </section>
  );
}
