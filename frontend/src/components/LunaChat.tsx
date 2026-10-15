import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, History, Plus, RotateCcw, Send, Trash2, Pencil, X, MoreHorizontal } from 'lucide-react';
import {
  ApiRequestError,
  deleteLunaConversation,
  getLunaConversation,
  getLunaConversations,
  sendLunaMessage,
  renameLunaConversation,openLunaTarot,
  type AppLanguage,
  type LunaConversationSummary,
  type LunaMessage,
  type Meditation
} from '../api';
import { BrandLogo } from '../design-system/components/BrandLogo';
import { ChatMeditationCard } from '../design-system/components/ChatMeditationCard';
import { recordLunaStage } from '../runtime-diagnostics';
import { LunaQuickActions } from '../luna2/LunaQuickActions';
import { luna2Copy } from '../luna2/copy';
import {featureFlags} from '../config/featureFlags';
import {MessageText} from './MessageText';
import {MemorySaveAction,UniverseInvitation} from '../luna2/PersonalMemoryEditor';
import {ChatTarotReading} from '../features/tarot/ChatTarotReading';
import {TarotCardBack} from '../features/tarot/TarotCard';
import {tarotCopy} from '../features/tarot/copy';
import './luna24-chat.css';

type LunaChatProps = {
  firstName: string;
  language: AppLanguage;
  meditations: Meditation[];
  hasPremium: boolean;
  initData?: string;
  onOpenMeditation: (meditation: Meditation) => void;
  onTarot?:()=>void;
  redesigned?: boolean;
  readingContextId?:string;
  onClearReadingContext?:()=>void;
  registerBackHandler?:(handler:(()=>void)|null)=>void;
};

const activeConversationKey = 'luna.ai.activeConversation.v1';

function requestId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `luna-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

type FailedTurn = {
  readingId?:string;
  mode?:'companion'|'tarot'|'wellbeing'|'meditation';
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

export function recommendationIdForMessage(message: LunaMessage) {
  const metadata = message.metadata;
  if (!metadata) return null;
  if (Object.prototype.hasOwnProperty.call(metadata, 'meditationAction')) {
    return metadata.meditationAction?.meditationId ?? null;
  }
  return metadata.recommendedMeditationId ?? null;
}

export function displayConversationTitle(title: string | null | undefined, language: AppLanguage) {
  const clean = title?.replace(/\s+/g, ' ').trim() ?? '';
  if (clean && clean.length <= 48 && clean.split(' ').length <= 7 && !/[.!?]{2,}/.test(clean)) return clean;
  return language === 'ru' ? 'Luna' : 'Luna';
}

function dateLabel(value: string, language: AppLanguage) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return language === 'ru' ? 'Сегодня' : 'Today';
  return new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', { month: 'short', day: 'numeric' }).format(date);
}

export function LunaChat({ firstName, language, meditations, hasPremium, initData, onOpenMeditation, onTarot, redesigned = false,readingContextId,onClearReadingContext,registerBackHandler }: LunaChatProps) {
  const central=featureFlags.ai_central_experience,en=language==='en';
  const [mode,setMode]=useState<NonNullable<FailedTurn['mode']>|''>(featureFlags.ai_modes?(readingContextId?'tarot':'companion'):'');
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
  const [ideasOpen, setIdeasOpen] = useState(false);
  const [toolsOpen,setToolsOpen]=useState(false);
  const [moreHistory,setMoreHistory]=useState(false);
  const [tarotComposer,setTarotComposer]=useState(false),[tarotKind,setTarotKind]=useState<'single'|'three'|'five'>('single'),[tarotIntention,setTarotIntention]=useState<'general'|'love'|'career'|'growth'>('general'),[tarotQuestion,setTarotQuestion]=useState('');
  const [renaming,setRenaming]=useState<string|null>(null),[renameTitle,setRenameTitle]=useState('');
  const [attachedReadingId,setAttachedReadingId]=useState<string|undefined>();
  const tarotPending=useRef(false),tarotClientId=useRef(''),autoDiscuss=useRef(new Set<string>());
  useEffect(()=>{if(!central)return;const handler=renaming?()=>setRenaming(null):tarotComposer?()=>setTarotComposer(false):toolsOpen?()=>setToolsOpen(false):screen==='overview'?()=>setScreen('chat'):null;registerBackHandler?.(handler);return()=>registerBackHandler?.(null);},[central,renaming,tarotComposer,toolsOpen,screen,registerBackHandler]);
  const listRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const nearBottomRef = useRef(true);
  const renderedCardsRef = useRef(new Set<string>());
  const prompts = language === 'ru'
    ? ['Не могу уснуть', 'Мысли не останавливаются', 'Я перегружен(а)', 'Мне нужно поговорить', 'Подбери медитацию']
    : ["I can't sleep", "My thoughts won't stop", "I'm overwhelmed", 'I need someone to talk to', 'Recommend a meditation'];

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
      setMoreHistory(next.length===20);
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
      onClearReadingContext?.();
      setActiveId(conversationId);
      setMessages(result.messages);
      const savedReading=result.messages.slice().reverse().find(m=>m.metadata?.tarot)?.metadata?.tarot?.readingId;setAttachedReadingId(savedReading);if(savedReading)setMode('tarot');
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
      if (!readingContextId&&stored && next.some((conversation) => conversation.id === stored)) await openConversation(stored);
      else {
        setScreen('chat');
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [openConversation, refreshConversations,readingContextId]);

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
    onClearReadingContext?.();setMode('');
    setActiveId('');
    setMessages([]);
    setDraft(seed.replace(/^[^\p{L}\p{N}]+/u, '').trim());
    setError('');
    setFailedTurn(null);
    setAttachedReadingId(undefined);setTarotComposer(false);setRenaming(null);setToolsOpen(false);
    setScreen('chat');
    window.localStorage.removeItem(activeConversationKey);
  };

  const submit = async (text: string, retry?: FailedTurn,discussionId?:string,targetConversationId?:string) => {
    const clean = text.trim();
    if (!clean || thinking || quotaExhausted || clean.length > 2000) return;
    const clientRequestId = retry?.clientRequestId ?? (discussionId?`discuss-${discussionId}-v1`:requestId());
    const optimistic: LunaMessage = retry
      ? { id: retry.optimisticMessageId, request_id: clientRequestId, role: 'user', content: clean, created_at: new Date().toISOString() }
      : { id: requestId(), request_id: clientRequestId, role: 'user', content: clean, created_at: new Date().toISOString() };
    if (screen !== 'chat'||discussionId&&!targetConversationId) {
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
    recordLunaStage('luna_message_sent', { requestId: clientRequestId }, initData);
    recordLunaStage('model_request_started', { requestId: clientRequestId }, initData);
    try {
      const selectedMode=discussionId?'tarot':retry?retry.mode:mode||undefined;
      const readingId=discussionId??(retry?retry.readingId:selectedMode==='tarot'?readingContextId??attachedReadingId:undefined);
      const result = await sendLunaMessage({ conversationId: discussionId?targetConversationId:activeId || undefined, message: clean, language, requestId: clientRequestId,...(selectedMode?{mode:selectedMode}:{}),...(readingId?{readingId}:{}) }, initData);
      const recommendationId = recommendationIdForMessage(result.message);
      const pendingState = result.message.metadata?.pending_state;
      recordLunaStage('model_result_received', { requestId: clientRequestId, hasAssistantMessage: Boolean(result.message.content) }, initData);
      recordLunaStage('pending_state_loaded', { requestId: clientRequestId, pendingStatePresent: Boolean(pendingState || result.message.metadata?.pending_action) }, initData);
      recordLunaStage('pending_state_value', {
        requestId: clientRequestId,
        pendingIntent: pendingState?.pending_intent ?? null,
        pendingMeditationId: pendingState?.pending_meditation_id ?? null,
        pendingAction: result.message.metadata?.pending_action ?? pendingState?.pending_action ?? null
      }, initData);
      recordLunaStage('resolved_intent', { requestId: clientRequestId, intent: result.message.metadata?.resolvedIntent ?? null }, initData);
      if (recommendationId) recordLunaStage('resolved_meditation_id', { requestId: clientRequestId, meditationId: recommendationId }, initData);
      if (result.message.metadata?.meditationAction) recordLunaStage('card_action_generated', { requestId: clientRequestId, meditationId: recommendationId }, initData);
      if (result.message.metadata?.duplicateClarificationBlocked) recordLunaStage('duplicate_reply_blocked', { requestId: clientRequestId }, initData);
      setActiveId(result.conversationId);
      window.localStorage.setItem(activeConversationKey, result.conversationId);
      if(discussionId){const saved=await getLunaConversation(result.conversationId,initData);setMessages(saved.messages);setAttachedReadingId(discussionId);setMode('tarot');onClearReadingContext?.();}
      else setMessages((current) => current.some(m=>m.id===result.message.id)?current:[...current, result.message]);
      await refreshConversations();
    } catch (sendError) {
      const details = errorDetails(sendError, language);
      setQuotaExhausted(details.state === 'quota_exhausted');
      setFailedTurn({ ...details, clientRequestId, text: clean, optimisticMessageId: optimistic.id,mode:discussionId?'tarot':retry?retry.mode:mode||undefined,readingId:discussionId??(retry?retry.readingId:mode==='tarot'?readingContextId??attachedReadingId:undefined) });
    } finally {
      setThinking(false);
    }
  };

  useEffect(()=>{if(!central||loading||thinking||!readingContextId||autoDiscuss.current.has(readingContextId))return;autoDiscuss.current.add(readingContextId);setMode('tarot');setAttachedReadingId(readingContextId);void submit(en?'Let’s discuss this reading. What stands out in relation to my question?':'Давай обсудим этот расклад. Что в нём главное для моего вопроса?',undefined,readingContextId);},[central,loading,readingContextId]);

  async function startChatTarot(){if(tarotPending.current||thinking)return;tarotPending.current=true;setThinking(true);setError('');tarotClientId.current||=crypto.randomUUID();const clientReadingId=tarotClientId.current;try{const result=await openLunaTarot({clientReadingId,...(activeId?{conversationId:activeId}:{}),kind:tarotKind,intention:tarotIntention,question:tarotQuestion,language},initData);setActiveId(result.conversationId);window.localStorage.setItem(activeConversationKey,result.conversationId);setMessages(current=>current.some(m=>m.id===result.message.id)?current:[...current,result.message]);setAttachedReadingId(result.message.metadata?.tarot?.readingId);setMode('tarot');setTarotComposer(false);setTarotQuestion('');tarotClientId.current='';await refreshConversations();}catch{setError(en?'Could not open the reading. Your history is unchanged; retry the same request.':'Не удалось открыть расклад. История не изменена — можно повторить запрос.');}finally{tarotPending.current=false;setThinking(false);}}
  async function rename(){if(!renaming||thinking)return;setThinking(true);setError('');try{await renameLunaConversation(renaming,renameTitle,initData);setRenaming(null);await refreshConversations();}catch{setError(en?'Could not rename this conversation.':'Не удалось переименовать разговор.');}finally{setThinking(false);}}

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

  const activeTitle = displayConversationTitle(conversations.find((conversation) => conversation.id === activeId)?.title, language);
  const visibleMessages = useMemo(() => messages.filter((message) => message.role === 'user' || message.role === 'assistant'), [messages]);

  useEffect(() => {
    visibleMessages.forEach((message) => {
      if (message.role !== 'assistant' || renderedCardsRef.current.has(message.id)) return;
      const recommendationId = recommendationIdForMessage(message);
      if (!recommendationId) return;
      renderedCardsRef.current.add(message.id);
      recordLunaStage('card_render_attempted', { requestId: message.request_id ?? null, meditationId: recommendationId }, initData);
      const recommendation = meditations.find((item) => item.id === recommendationId);
      recordLunaStage(recommendation ? 'card_render_success' : 'card_render_failed', {
        requestId: message.request_id ?? null,
        meditationId: recommendationId,
        reason: recommendation ? null : 'published meditation was not present in the frontend catalog'
      }, initData);
    });
  }, [initData, meditations, visibleMessages]);

  if (screen === 'overview') {
    return (
      <div className="luna-ai-overview">
        <div className="luna-ai-overview-header">
          <div><h2>Luna</h2><p>{language === 'ru' ? 'Твой тихий компаньон' : 'Your quiet companion'}</p></div>
          <button type="button" onClick={() => beginConversation()} aria-label={language === 'ru' ? 'Новый разговор' : 'New conversation'}><Plus size={20} />{central&&(en?'New conversation':'Новый разговор')}</button>
        </div>
        {featureFlags.personal_memory&&<UniverseInvitation language={language}/>}
        <section className="luna-ai-recent">
          <h3>{language === 'ru' ? 'Недавние разговоры' : 'Recent Conversations'}</h3>
          {loading ? <div className="luna-ai-loading-line" /> : conversations.length ? (central?conversations:conversations.slice(0, 6)).map((conversation) => (
            <article key={conversation.id} data-conversation-id={conversation.id} className="luna24-history-entry"><button type="button" onClick={() => void openConversation(conversation.id)}>
              <span><strong>{conversation.title || (language === 'ru' ? 'Разговор с Luna' : 'Conversation with Luna')}</strong><small>{conversation.latestMessage}</small></span>
              <time>{dateLabel(conversation.last_message_at, language)}</time>
            </button>{central&&<button type="button" aria-label={en?'Rename conversation':'Переименовать разговор'} onClick={()=>{setRenaming(conversation.id);setRenameTitle(conversation.title);}}><Pencil size={17}/></button>}</article>
          )) : <p className="luna-ai-empty-history">{language === 'ru' ? 'Первый разговор начнётся, когда ты будешь готов(а).' : 'Your first conversation can begin whenever you are ready.'}</p>}
        </section>
        {central&&moreHistory&&<button className="luna-button-primary" type="button" disabled={loading} onClick={async()=>{setLoading(true);try{const next=await getLunaConversations(initData,conversations.length);setConversations(current=>[...current,...next.filter(n=>!current.some(c=>c.id===n.id))]);setMoreHistory(next.length===20);}catch{setError(en?'Could not load older conversations.':'Не удалось загрузить прежние разговоры.');}finally{setLoading(false);}}}>{en?'Older conversations':'Прежние разговоры'}</button>}
        {central&&renaming&&<form className="luna24-rename" onSubmit={e=>{e.preventDefault();void rename();}}><label>{en?'Conversation name':'Название разговора'}<input required maxLength={60} value={renameTitle} onChange={e=>setRenameTitle(e.target.value)} autoFocus/></label><button type="submit" disabled={thinking}>{en?'Save':'Сохранить'}</button><button type="button" onClick={()=>setRenaming(null)}>{en?'Cancel':'Отмена'}</button></form>}
        {error ? <p className="luna-ai-error">{error}</p> : null}
      </div>
    );
  }

  return (
    <section className={`luna-live-chat ${redesigned ? 'luna2-chat' : ''} ${central?'luna24-chat':''}`} aria-busy={thinking}>
      <header className="luna-live-chat-header">
        <button type="button" onClick={() => { setScreen('overview'); setError(''); }} aria-label={language === 'ru' ? 'История разговоров' : 'Conversation history'}><History size={19} /></button>
        <div><BrandLogo size={28} eager /><span><h2>{activeTitle}</h2><p>{thinking ? (language === 'ru' ? 'Luna думает...' : 'Luna is reflecting...') : (language === 'ru' ? 'Рядом и слушает' : 'Here and listening')}</p></span></div>
        {central?<><button type="button" onClick={()=>beginConversation()} disabled={thinking} aria-label={en?'New conversation':'Новый разговор'}><Plus size={19}/></button><button type="button" onClick={()=>setToolsOpen(v=>!v)} aria-expanded={toolsOpen} aria-label={en?'More conversation tools':'Другие действия'}><MoreHorizontal size={20}/></button></>:<button type="button" onClick={() => void removeConversation()} disabled={!activeId} aria-label={language === 'ru' ? 'Удалить разговор' : 'Delete conversation'}><Trash2 size={17} /></button>}
      </header>
      {central&&<nav className="luna24-chat-toolbar" aria-label={en?'Conversation tools':'Управление разговором'}><button type="button" onClick={()=>setToolsOpen(v=>!v)}>{mode==='tarot'&&(readingContextId||attachedReadingId)?(en?'Tarot · reading attached':'Таро · расклад прикреплён'):({tarot:en?'Tarot reflection':'Размышление с Таро',wellbeing:en?'Emotional support':'Эмоциональная поддержка',meditation:en?'Meditation guide':'Гид по медитации',companion:en?'Self-discovery':'Самопознание','':en?'General conversation':'Общий разговор'})[mode]}</button><button type="button" disabled={thinking} onClick={()=>{setTarotComposer(v=>!v);setToolsOpen(false);}}>{en?'Tarot':'Таро'} ✧</button></nav>}
      {central&&tarotComposer&&<form className="luna24-tarot-composer" onSubmit={e=>{e.preventDefault();void startChatTarot();}}><header><strong>{en?'A question for the cards':'Вопрос к картам'}</strong><button type="button" aria-label={en?'Close':'Закрыть'} onClick={()=>setTarotComposer(false)}><X size={18}/></button></header><label>{en?'Reading':'Расклад'}<select disabled={thinking} value={tarotKind} onChange={e=>{setTarotKind(e.target.value as typeof tarotKind);tarotClientId.current='';}}><option value="single">{en?'One card':'Одна карта'}</option><option value="three" disabled={!featureFlags.tarot_spreads}>{en?'Three cards':'Три карты'}</option><option value="five" disabled={!featureFlags.tarot_spreads}>{en?'Five cards':'Пять карт'}</option></select></label><label>{en?'Intention':'Тема'}<select disabled={thinking} value={tarotIntention} onChange={e=>{setTarotIntention(e.target.value as typeof tarotIntention);tarotClientId.current='';}}>{(['general','love','career','growth'] as const).map(k=><option key={k} value={k}>{tarotCopy[language].intentions[k].title}</option>)}</select></label><label>{en?'Your question · optional':'Твой вопрос · необязательно'}<textarea disabled={thinking} maxLength={240} rows={2} value={tarotQuestion} onChange={e=>{setTarotQuestion(e.target.value);tarotClientId.current='';}}/></label>{thinking&&<div className="luna24-shuffling" aria-label={en?'Shuffling the deck':'Перемешиваем колоду'}>{[0,1,2].map(i=><span key={i}><TarotCardBack/></span>)}</div>}<button className="luna-button-primary" type="submit" disabled={thinking}>{thinking?(en?'Preparing…':'Готовим…'):(en?'Shuffle and open in chat':'Перемешать и открыть в чате')}</button></form>}

      {featureFlags.ai_modes&&(!central||toolsOpen)&&<label className="luna-mode-select">{central?(en?'Mode':'Режим'):language==='en'?'Conversation mode':'Режим разговора'}<select disabled={thinking||Boolean(failedTurn)} value={mode} onChange={event=>{setMode(event.target.value as typeof mode);if(event.target.value!=='tarot')onClearReadingContext?.();}}>
        <option value="">{central?(en?'General conversation':'Общий разговор'):language==='en'?'Current Luna':'Прежняя Luna'}</option><option value="companion">{language==='en'?'Self-discovery':'Самопознание'}</option><option value="tarot">{language==='en'?'Tarot reflection':'Размышление с Таро'}</option><option value="wellbeing">{language==='en'?'Emotional support':'Эмоциональная поддержка'}</option><option value="meditation">{language==='en'?'Meditation guide':'Гид по медитации'}</option><option value="astrology" disabled>{language==='en'?'Astrology · awaiting chart engine':'Астрология · нужен расчётный модуль'}</option>
      </select></label>}
      {featureFlags.ai_modes&&(!central||toolsOpen)&&mode==='tarot'&&(readingContextId||attachedReadingId)&&<div className="luna-reading-context"><span>{language==='en'?'Your selected reading is attached':'Выбранный расклад добавлен в контекст'}</span><button type="button" disabled={thinking||Boolean(failedTurn)} onClick={()=>{onClearReadingContext?.();setAttachedReadingId(undefined);}}>{language==='en'?'Remove':'Убрать'}</button></div>}

      {redesigned && (!central||toolsOpen) && visibleMessages.length > 0 && <button type="button" className="luna2-ideas-toggle" aria-expanded={ideasOpen} onClick={() => setIdeasOpen(value => !value)}>{luna2Copy[language].ideas}</button>}
      {redesigned && ideasOpen && visibleMessages.length > 0 && <LunaQuickActions language={language} onTarot={central?()=>setTarotComposer(true):onTarot} disabled={thinking || quotaExhausted} onPrompt={(prompt) => { setDraft(prompt); setIdeasOpen(false); textareaRef.current?.focus(); }} />}

      {central&&toolsOpen&&<div className="luna24-extra-tools"><button type="button" disabled={!activeId||thinking} onClick={()=>{setToolsOpen(false);void removeConversation();}}><Trash2 size={16}/>{en?'Delete conversation':'Удалить разговор'}</button></div>}
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
            <BrandLogo size={48} className="mx-auto" eager />
            <div className="luna-ai-loading-line" />
            <div className="luna-ai-loading-line ml-auto max-w-[76%]" />
            <div className="luna-ai-loading-line max-w-[86%]" />
          </div>
        ) : !visibleMessages.length ? (
          <div className="luna-live-empty">
            {featureFlags.personal_memory&&<UniverseInvitation language={language}/>}
            <BrandLogo size={88} alt={language === 'ru' ? 'Логотип Luna Meditation' : 'Luna Meditation logo'} eager />
            {redesigned && <span className="luna2-ai-kicker">{luna2Copy[language].aiKicker}</span>}
            <h3>{language === 'ru' ? `Я рядом, ${firstName || 'друг'}.` : `I'm here, ${firstName || 'friend'}.`}</h3>
            <p>{redesigned ? luna2Copy[language].aiBody : language === 'ru' ? 'Расскажи, что у тебя на душе. Я выслушаю без осуждения.' : "Tell me what's on your mind. I'll listen without judgment."}</p>
            {redesigned ? <LunaQuickActions language={language} onTarot={central?()=>setTarotComposer(true):onTarot} disabled={thinking || quotaExhausted} onPrompt={(prompt) => { setDraft(prompt); textareaRef.current?.focus(); }} /> : <div className="luna-quick-prompts" aria-label={language === 'ru' ? 'Быстрые темы' : 'Quick prompts'}>{prompts.map((prompt) => <button key={prompt} type="button" onClick={() => setDraft(prompt)}>{prompt}</button>)}</div>}
          </div>
        ) : visibleMessages.map((message) => {
          const recommendationId = recommendationIdForMessage(message);
          const recommendation = recommendationId
            ? meditations.find((item) => item.id === recommendationId) ?? message.metadata?.recommendedMeditation ?? undefined
            : undefined;
          return (
            <div key={message.id} className={`luna-live-message-row luna-live-message-${message.role} ${central&&message.metadata?.tarot?'has-tarot':''}`}>
              {message.role === 'assistant' && !(central&&message.metadata?.tarot) ? <span className="luna-message-orb" aria-hidden="true" /> : null}
              <div className="luna-live-message-content">
                {!(central&&message.metadata?.tarot)&&<div className="luna-message-bubble"><MessageText text={message.content}/></div>}
                {central&&message.role==='assistant'&&message.metadata?.contextualActions?.length? <div className="luna24-context-actions">{message.metadata.contextualActions.map(action=><button type="button" key={action} disabled={thinking} onClick={()=>{if(action==='tarot'){setTarotQuestion(messages.filter(m=>m.role==='user').slice(-1)[0]?.content.slice(0,240)??'');setTarotComposer(true);}else if(action==='journal')window.dispatchEvent(new Event('luna-open-activity'));else if(action==='birth_profile')window.dispatchEvent(new Event(featureFlags.personal_memory?'luna-open-universe':'luna-open-astrology'));else{setMode('meditation');setDraft(luna2Copy[language].recommendPrompt);textareaRef.current?.focus();}}}>{({tarot:en?'Explore with Tarot':'Посмотреть через Таро',journal:en?'Open journal':'Открыть дневник',birth_profile:en?'My birth profile':'Мои данные рождения',meditation:en?'Find a meditation':'Подобрать медитацию'})[action]}</button>)}</div>:null}
                {central&&message.metadata?.tarot&&<ChatTarotReading message={message} language={language} initData={initData} registerBackHandler={registerBackHandler} onContinue={id=>{setAttachedReadingId(id);setMode('tarot');void submit(en?'Let’s discuss this reading. What stands out in relation to my question?':'Давай обсудим этот расклад. Что в нём главное для моего вопроса?',undefined,id,activeId);}} onUpdate={next=>setMessages(current=>current.map(m=>m.id===next.id?next:m))}/>}
                {featureFlags.personal_memory&&!thinking&&(message.id===visibleMessages.filter(m=>m.role===message.role).slice(-1)[0]?.id)&&<MemorySaveAction key={message.id} language={language} initData={initData} message={message}/>}
                {recommendation ? <ChatMeditationCard meditation={recommendation} language={language} hasPremium={hasPremium} onOpen={() => onOpenMeditation(recommendation)} /> : null}
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
