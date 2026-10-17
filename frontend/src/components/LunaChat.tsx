import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, History, Plus, RotateCcw, Send, Trash2, Pencil, MoreHorizontal } from 'lucide-react';
import {
  ApiRequestError,
  acknowledgeLunaAction,
  deleteLunaConversation,
  getLunaConversation,
  getLunaConversations,
  getLunaUsage,
  sendLunaMessage,
  renameLunaConversation,openLunaTarot,attachSavedLunaTarot,savePendingCommerceAction,getPendingCommerceActions,
  resetLunaContext,openLunaAstrology,
  type AppLanguage,
  type AstrologyChatAttachment,
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
import {MemorySaveAction} from '../luna2/PersonalMemoryEditor';
import {MemoryProposalCard} from '../luna2/MemoryProposalCard';
import {ChatTarotReading} from '../features/tarot/ChatTarotReading';
import {ConversationalTarotSetup, type TarotSetupStep} from '../features/tarot/ConversationalTarotSetup';
import {DreamExplorer} from '../features/dreams/DreamExplorer';
import {ChatAstrology} from './ChatAstrology';
import {ChatBreathing} from './ChatBreathing';
import {availableConsultationAttachments} from '../../../backend/src/luna34-conversation';
import {resolveLunaDestination} from '../../../backend/src/luna41-navigation';
import './luna34-chat.css';
import {ChatCommerce} from '../features/membership/ChatCommerce';
import {commerceIntent} from '../../../backend/src/luna35-commerce-policy';
import './luna24-chat.css';
import './luna33-workflows.css';
import {LunaVoiceInput} from './LunaVoiceInput';
import {cosmosAreas} from '../../../backend/src/luna41-cosmos-policy';

type LunaChatProps = {
  ambientSound?:{title:string;playing:boolean;onToggle:()=>void;onStop:()=>void};
  firstName: string;
  language: AppLanguage;
  meditations: Meditation[];
  hasPremium: boolean;
  initData?: string;
  onOpenMeditation: (meditation: Meditation,origin?:import('../api').MeditationActionOrigin) => void;
  onTarot?:()=>void;
  redesigned?: boolean;
  readingContextId?:string;
  chartContextId?:string|AstrologyChatAttachment;
  cosmosDiscussion?:{area:string;key:string};
  conversationEntry?:string;
  tarotSetupKey?:number;
  onClearReadingContext?:()=>void;
  registerBackHandler?:(handler:(()=>void)|null)=>void;
};

const activeConversationKey = 'luna.ai.activeConversation.v1';
// Session memory only: no private messages or Telegram credentials in browser
// storage. Exact signed-session keys prevent restoring another account's UI.
const sessionChatCache=new Map<string,{activeId:string;messages:LunaMessage[];conversations:LunaConversationSummary[];draft?:string;handledContext?:string}>();

function requestId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `luna-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

type FailedTurn = {
  astrologyConsent?:true;
  contextReset?:boolean;
  readingId?:string;
  chartId?:string;
  astrology?:AstrologyChatAttachment;
  mode?:'companion'|'tarot'|'wellbeing'|'meditation'|'astrology'|'dream';
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
  let serverRetryable:boolean|undefined;
  let state: FailedTurn['state'] = 'failed_retryable';
  let resetAt: string | null = null;
  if (error instanceof ApiRequestError && error.responseBody) {
    try {
      const body = JSON.parse(error.responseBody) as { code?: string; retryable?: boolean; requestState?: FailedTurn['state']; resetAt?: string | null };
      code = body.code ?? '';
      retryable = Boolean(body.retryable);
      serverRetryable=typeof body.retryable==='boolean'?body.retryable:undefined;
      state = body.requestState ?? state;
      resetAt = body.resetAt ?? null;
    } catch { code = ''; }
  }
  if (code === 'quota_exhausted' || code === 'daily_limit') return {
    message: language === 'ru' ? 'Квота AI исчерпана. Ниже — проверенные данные аккаунта и доступные действия.' : 'Your AI allowance is used. Verified account details and available actions are below.',
    retryable: false, state: 'quota_exhausted', resetAt
  };
  if (code === 'chat_disabled' || code === 'missing_api_key') return {
    message: language === 'ru' ? 'Разговоры с Luna сейчас недоступны.' : 'Luna conversations are unavailable right now.',
    retryable: false, state: 'failed_non_retryable', resetAt
  };
  if(['ai_global_budget','ai_budget_unconfigured','ai_accounting_failed','ai_result_already_saved','ai_attempt_limit'].includes(code))return {message:language==='ru'?'Новые AI-ответы временно приостановлены. Сохранённая история и остальные практики доступны. Повторного списания нет.':'New AI answers are temporarily paused. Saved history and other practices are available. No duplicate charge was made.',retryable:false,state:'failed_non_retryable',resetAt};
  if(['openai_auth','openai_model','openai_quota','openai_validation','permanent_validation'].includes(code))return {message:language==='ru'?'Сервис AI сейчас недоступен для этого запроса. История сохранена; автоматического повтора нет.':'The AI service cannot complete this request right now. Your history is saved; no automatic retry was made.',retryable:false,state:'failed_non_retryable',resetAt};
  if (code === 'timeout') return {
    message: language === 'ru' ? 'Luna не успела ответить. Можно повторить этот запрос.' : 'Luna took too long to respond. You can retry this message.',
    retryable: true, state: 'failed_retryable', resetAt
  };
  if(code==='context_changed')return {message:language==='ru'?'Настройки памяти изменились во время ответа. Старый контекст не сохранён — отправьте новое сообщение.':'Your memory settings changed during this answer. The old context was not saved; send a new message.',retryable:false,state:'failed_non_retryable',resetAt};
  if (code === 'request_in_progress') return {
    message: language === 'ru' ? 'Luna ещё отвечает на это сообщение.' : 'Luna is still responding to this message.',
    retryable: true, state: 'processing', resetAt
  };
  if(['chart_not_found','report_not_found','reading_not_found','reading_context_unavailable','astrology_unavailable','context_unavailable'].includes(code))return {message:language==='ru'?'Контекст недоступен. Откройте сохранённый расклад или карту ещё раз — история разговора сохранена.':'This context is unavailable. Reopen your saved reading or chart; the conversation is saved.',retryable:code==='context_unavailable',state:code==='context_unavailable'?'failed_retryable':'failed_non_retryable',resetAt};
  if(error instanceof ApiRequestError&&error.status===403)return {message:language==='ru'?'Нет доступа к этому действию. Данные другого аккаунта недоступны.':'This action is not permitted. Another account’s data are private.',retryable:false,state:'failed_non_retryable',resetAt};
  if(['upstream_rate_limit','openai_rate_limit','temporary_upstream','rate_limit'].includes(code)||error instanceof ApiRequestError&&error.status===429)return {message:language==='ru'?'Сервис AI временно занят. Повторите это сообщение чуть позже.':'The AI service is temporarily busy. Retry this message shortly.',retryable:true,state:'failed_retryable',resetAt};
  if (error instanceof ApiRequestError && error.status === 401) return {
    message: language === 'ru' ? 'Открой Luna внутри Telegram, чтобы продолжить разговор.' : 'Open Luna inside Telegram to continue your conversation.',
    retryable: false, state: 'failed_non_retryable', resetAt
  };
  return {
    message: language === 'ru' ? 'Luna сейчас не смогла ответить. Можно повторить этот запрос.' : 'Luna could not respond just now. You can retry this message.',
    retryable: serverRetryable ?? !(error instanceof ApiRequestError && error.status !== null && error.status < 500),
    state: serverRetryable===false?'failed_non_retryable':retryable ? state : 'failed_retryable', resetAt
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

export function LunaChat({ firstName, language, meditations, hasPremium, initData, onOpenMeditation, onTarot, redesigned = false,readingContextId,chartContextId,cosmosDiscussion,conversationEntry,tarotSetupKey,onClearReadingContext,registerBackHandler,ambientSound }: LunaChatProps) {
  const central=featureFlags.ai_central_experience,en=language==='en';
  const cached=useMemo(()=>initData?sessionChatCache.get(initData):undefined,[initData]);
  const cachedContext=cached?.messages.slice().reverse().find(m=>m.metadata?.contextReset||m.metadata?.astrology||m.metadata?.tarot||m.metadata?.readingId)?.metadata;
  const initialChart=typeof chartContextId==='string'?{chartId:chartContextId}:chartContextId??cachedContext?.astrology;
  const initialReading=readingContextId??cachedContext?.tarot?.readingId??cachedContext?.readingId;
  const [mode,setMode]=useState<NonNullable<FailedTurn['mode']>|''>(featureFlags.ai_modes?(initialChart?'astrology':initialReading?'tarot':'companion'):'');
  const [attachedChartId,setAttachedChartId]=useState<string|undefined>(initialChart?.chartId);
  const [attachedAstrology,setAttachedAstrology]=useState<AstrologyChatAttachment|undefined>(initialChart);
  const [contextDetached,setContextDetached]=useState(Boolean(cachedContext?.contextReset));
  const [contextBusy,setContextBusy]=useState(false);
  useEffect(()=>{if(!chartContextId)return;const context=typeof chartContextId==='string'?{chartId:chartContextId}:chartContextId;const signature=JSON.stringify(context);if(handledContext.current===signature)return;handledContext.current=signature;setAttachedChartId(context.chartId);setAttachedAstrology(context);setAttachedReadingId(undefined);setContextDetached(false);setMode('astrology');setScreen('chat');setSuggestedPrompt(context.secondChartId?(language==='en'?'Help me reflect on these two calculated charts and their comparison.':'Помоги осмыслить эти две рассчитанные карты и их сопоставление.'):context.aspect?(language==='en'?'Explain the selected calculated aspect in this exact chart.':'Объясни выбранный рассчитанный аспект именно этой карты.'):context.planet?(language==='en'?`Explain ${context.planet} in this calculated chart.`:'Объясни выбранную планету в этой рассчитанной карте.'):(language==='en'?'Help me reflect on my calculated birth chart.':'Помоги осмыслить мою рассчитанную натальную карту.'));},[chartContextId]);
  const [draft, setDraft] = useState(cached?.draft??'');
  const [suggestedPrompt,setSuggestedPrompt]=useState('');
  const [voiceBusy,setVoiceBusy]=useState(false);
  const [pendingAstrology,setPendingAstrology]=useState<{text:string;retry?:FailedTurn;readingId?:string;mode?:FailedTurn['mode'];context:AstrologyChatAttachment}|null>(null);
  const [permissionChecked,setPermissionChecked]=useState(false);
  const handledContext=useRef(cached?.handledContext??'');
  const [conversations, setConversations] = useState<LunaConversationSummary[]>(cached?.conversations??[]);
  const [activeId, setActiveId] = useState(cached?.activeId??'');
  const [messages, setMessages] = useState<LunaMessage[]>(cached?.messages??[]);
  const availableAttachments=useMemo(()=>availableConsultationAttachments(messages),[messages]);
  useEffect(()=>{if(!initData)return;sessionChatCache.set(initData,{activeId,messages:messages.slice(-80),conversations:conversations.slice(0,20),draft,handledContext:handledContext.current});if(sessionChatCache.size>4)sessionChatCache.delete(sessionChatCache.keys().next().value!);},[initData,activeId,messages,conversations,draft]);
  const [screen, setScreen] = useState<'overview' | 'chat'>('chat');
  const [loading, setLoading] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState('');
  const [failedTurn, setFailedTurn] = useState<FailedTurn | null>(null);
  const [quotaExhausted, setQuotaExhausted] = useState(false);
  const [pendingCommerce,setPendingCommerce]=useState(false);
  useEffect(()=>{let alive=true;setPendingCommerce(false);if(activeId)void getPendingCommerceActions(activeId,initData).then(r=>{if(alive)setPendingCommerce(r.actions.length>0);}).catch(()=>undefined);return()=>{alive=false;};},[activeId,initData]);
  const [usageRemaining,setUsageRemaining]=useState<number|null>(null),[usageResetAt,setUsageResetAt]=useState<string|null>(null);
  useEffect(()=>{const reset=failedTurn?.resetAt??usageResetAt;if(!reset)return;const delay=Date.parse(reset)-Date.now();const timer=window.setTimeout(()=>{setQuotaExhausted(false);setUsageRemaining(null);setUsageResetAt(null);setFailedTurn(current=>current?.state==='quota_exhausted'?null:current);},Math.max(0,Math.min(delay+100,2147483647)));return()=>window.clearTimeout(timer);},[failedTurn?.resetAt,usageResetAt]);
  const [awayFromBottom, setAwayFromBottom] = useState(false);
  const [ideasOpen, setIdeasOpen] = useState(false);
  const handledCosmos=useRef('');
  useEffect(()=>{const area=cosmosAreas.find(item=>item.id===cosmosDiscussion?.area);if(!area||!cosmosDiscussion||handledCosmos.current===cosmosDiscussion.key)return;handledCosmos.current=cosmosDiscussion.key;setAttachedReadingId(undefined);setAttachedChartId(undefined);setAttachedAstrology(undefined);setContextDetached(true);setPendingAstrology(null);setPermissionChecked(false);setMode('companion');setScreen('chat');setDraft(en?`Let’s explore my ${area.en.toLowerCase()}. Help me find one useful next step.`:`Хочу обсудить сферу «${area.ru}». Помоги найти один полезный следующий шаг.`);setSuggestedPrompt('');onClearReadingContext?.();},[cosmosDiscussion?.key]);
  const [toolsOpen,setToolsOpen]=useState(false);
  const [dreamOpen,setDreamOpen]=useState(false);
  const [moreHistory,setMoreHistory]=useState(false);
  const [tarotComposer,setTarotComposer]=useState(false),[tarotKind,setTarotKind]=useState<'single'|'three'|'five'>('single'),[tarotIntention,setTarotIntention]=useState<'general'|'love'|'career'|'growth'>('general'),[tarotQuestion,setTarotQuestion]=useState('');
  const [tarotStep,setTarotStep]=useState<TarotSetupStep>('kind');
  const beginTarotSetup=()=>{setSuggestedPrompt('');setPendingAstrology(null);setDreamOpen(false);setTarotStep('kind');setTarotComposer(true);setToolsOpen(false);};
  useEffect(()=>{if(central&&tarotSetupKey){setTarotStep('kind');setTarotComposer(true);setToolsOpen(false);}},[central,tarotSetupKey]);
  const [renaming,setRenaming]=useState<string|null>(null),[renameTitle,setRenameTitle]=useState('');
  const [attachedReadingId,setAttachedReadingId]=useState<string|undefined>(initialReading);
  const tarotPending=useRef(false),turnPending=useRef(false),tarotClientId=useRef(''),autoDiscuss=useRef(new Set<string>());
  const uiEpoch=useRef(0);
  useEffect(()=>{if(!central)return;const handler=dreamOpen?()=>setDreamOpen(false):renaming?()=>setRenaming(null):tarotComposer?()=>tarotStep==='question'?setTarotStep('intention'):tarotStep==='intention'?setTarotStep('kind'):setTarotComposer(false):toolsOpen?()=>setToolsOpen(false):screen==='overview'?()=>setScreen('chat'):null;registerBackHandler?.(handler);return()=>registerBackHandler?.(null);},[central,dreamOpen,renaming,tarotComposer,tarotStep,toolsOpen,screen,registerBackHandler]);
  const listRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const nearBottomRef = useRef(true);
  const renderedCardsRef = useRef(new Set<string>());
  useEffect(()=>{if(tarotComposer)requestAnimationFrame(()=>listRef.current?.scrollTo({top:listRef.current.scrollHeight,behavior:'instant'}));},[tarotComposer,tarotStep]);
  useEffect(()=>{if(dreamOpen)requestAnimationFrame(()=>listRef.current?.scrollTo({top:0,behavior:'instant'}));},[dreamOpen]);
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
      getLunaUsage(initData).then(usage=>{setUsageRemaining(usage.remaining);setUsageResetAt(usage.resetAt);setQuotaExhausted(usage.remaining===0);}).catch(()=>{});
      setConversations(next);
      setMoreHistory(next.length===20);
      setError('');
      return next;
    } catch (loadError) {
      console.info('[Luna conversation history load failed]', loadError instanceof Error ? loadError.name : 'unknown');
      setError(language === 'ru' ? 'Не удалось загрузить историю разговоров. Можно начать новый разговор или обновить историю.' : 'Conversation history could not load. You can start a new conversation or reload the history.');
      return null;
    }
  }, [initData, language]);

  const openConversation = useCallback(async (conversationId: string,silent=false) => {
    const epoch=++uiEpoch.current;
    if(!silent)setLoading(true);
    setError('');
    try {
      const result = await getLunaConversation(conversationId, initData);
      if(epoch!==uiEpoch.current)return;
      onClearReadingContext?.();
      setActiveId(conversationId);
      setMessages(result.messages);
      const latestContext=result.messages.slice().reverse().find(m=>m.metadata?.contextReset||m.metadata?.astrology||m.metadata?.tarot||m.metadata?.readingId)?.metadata;
      setContextDetached(Boolean(latestContext?.contextReset));
      const savedChart=latestContext?.astrology;setAttachedChartId(savedChart?.chartId);setAttachedAstrology(savedChart);
      const savedReading=latestContext?.tarot?.readingId??latestContext?.readingId;setAttachedReadingId(savedReading);setMode(savedChart?'astrology':savedReading?'tarot':featureFlags.ai_modes?'companion':'');
      setScreen('chat');
      setSuggestedPrompt('');
      window.localStorage.setItem(activeConversationKey, conversationId);
      requestAnimationFrame(() => {
        const list = listRef.current;
        if (list) list.scrollTop = list.scrollHeight;
      });
    } catch (loadError) {
      if(epoch!==uiEpoch.current)return;
      console.info('[Luna conversation load failed]', loadError instanceof Error ? loadError.name : 'unknown');
      // Only an explicit ownership/deletion denial invalidates cached content.
      // A paginated list or a transient network failure is not such evidence.
      if(loadError instanceof ApiRequestError&&[401,403,404].includes(loadError.status??0)){
        setActiveId('');setMessages([]);setAttachedReadingId(undefined);setAttachedChartId(undefined);setAttachedAstrology(undefined);setContextDetached(true);
        if(window.localStorage.getItem(activeConversationKey)===conversationId)window.localStorage.removeItem(activeConversationKey);
      }
      setError(language === 'ru' ? 'Не удалось открыть этот разговор. Обнови историю и попробуй снова.' : 'This conversation could not open. Reload the history and try again.');
    } finally {
      if(epoch===uiEpoch.current)setLoading(false);
    }
  }, [initData, language]);

  useEffect(() => {
    let alive = true;
    const epoch=uiEpoch.current;
    void (async () => {
      const next = await refreshConversations();
      if (!alive||epoch!==uiEpoch.current) return;
      if(!next){setLoading(false);return;}
      if(conversationEntry&&!turnPending.current){await openConversation(conversationEntry);return;}
      const stored = window.localStorage.getItem(activeConversationKey);
      if(!turnPending.current&&activeId&&!readingContextId&&!chartContextId){await openConversation(activeId,true);return;}
      if (!turnPending.current&&!activeId&&!messages.length&&!readingContextId&&!chartContextId&&stored&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(stored)) await openConversation(stored);
      else {
        setScreen('chat');
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [openConversation, refreshConversations,readingContextId,chartContextId,conversationEntry]);

  const scrollToLatest = useCallback((smooth = true) => {
    const list = listRef.current;
    if (!list) return;
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    list.scrollTo({ top: list.scrollHeight, behavior: smooth&&!reduced ? 'smooth' : 'instant' });
    nearBottomRef.current = true;
    setAwayFromBottom(false);
  }, []);

  useEffect(() => {
    if (screen !== 'chat' || !nearBottomRef.current) return;
    if(!messages.length){listRef.current?.scrollTo({top:0,behavior:'instant'});return;}
    requestAnimationFrame(() => scrollToLatest(messages.length > 1));
  }, [messages.length, screen, scrollToLatest, thinking]);

  useEffect(()=>{
    const viewport=window.visualViewport;
    const resized=()=>{if(nearBottomRef.current)requestAnimationFrame(()=>scrollToLatest(false));};
    viewport?.addEventListener('resize',resized);
    return()=>viewport?.removeEventListener('resize',resized);
  },[scrollToLatest]);

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
    uiEpoch.current++;setLoading(false);
    setContextDetached(false);
    setDreamOpen(false);
    onClearReadingContext?.();setMode(featureFlags.ai_modes?'companion':'');setAttachedChartId(undefined);setAttachedAstrology(undefined);
    setActiveId('');
    setMessages([]);
    setDraft(seed.replace(/^[^\p{L}\p{N}]+/u, '').trim());
    setSuggestedPrompt('');
    setError('');
    setFailedTurn(null);
    setAttachedReadingId(undefined);setTarotComposer(false);setRenaming(null);setToolsOpen(false);
    setScreen('chat');
    window.localStorage.removeItem(activeConversationKey);
  };

  const detachContext=async()=>{if(thinking||contextBusy)return;setContextBusy(true);turnPending.current=true;const resetId=requestId();try{if(activeId){const result=await resetLunaContext(activeId,resetId,language,initData);setMessages(current=>current.some(m=>m.id===result.message.id)?current:[...current,result.message]);}onClearReadingContext?.();setAttachedReadingId(undefined);setAttachedChartId(undefined);setAttachedAstrology(undefined);setMode('companion');setContextDetached(true);setSuggestedPrompt('');setPendingAstrology(null);setFailedTurn(null);}catch{setError(en?'Could not remove the context. Your saved conversation is unchanged.':'Не удалось убрать контекст. Сохранённый разговор не изменён.');}finally{setContextBusy(false);turnPending.current=false;}};

  const submit = async (text: string, retry?: FailedTurn,contextReadingId?:string,modeOverride?:FailedTurn['mode'],contextAstrology?:AstrologyChatAttachment,grantAstrologyConsent?:true) => {
    const clean = text.trim();
    const commercial=commerceIntent(clean);
    if (!clean || thinking || turnPending.current || quotaExhausted&&!commercial || clean.length > 2000) return;
    const targetMode=modeOverride??(contextReadingId?'tarot':retry?retry.mode:mode||undefined);
    const targetContext=retry?retry.astrology??(retry.chartId?{chartId:retry.chartId}:undefined):targetMode==='astrology'?contextAstrology??attachedAstrology??(attachedChartId?{chartId:attachedChartId}:undefined):undefined;
    const lastReset=messages.reduce((last,m,index)=>m.metadata?.contextReset?index:last,-1);
    const permission=targetContext&&messages.slice(Math.max(0,lastReset)).some(m=>{const c=m.metadata?.astrologyConsent;return c?.version===1&&c.chartId===targetContext.chartId&&(c.secondChartId??null)===(targetContext.secondChartId??null);});
    const astrologyConsent=grantAstrologyConsent??retry?.astrologyConsent;
    const selectorCommand=/compatibility|совместим/i.test(clean)&&/check|calculate|compare|explore|show|проверь|рассчита|сравни|посмотр|совместимость с/i.test(clean);
    const practiceCommand=/meditat|медитац|breathing practice|дыхательн|не могу уснуть|can.t sleep/i.test(clean)&&!/tarot|chart|card|таро|карт|расклад/i.test(clean);
    const requestsChartFacts=Boolean(contextAstrology)||/chart|planet|aspect|ascendant|mercury|venus|mars|натальн|планет|аспект|асцендент|меркур|венер|марс|мо[яейю]+ карт/i.test(clean);
    if(targetContext&&!permission&&!astrologyConsent&&!selectorCommand&&!practiceCommand&&!commercial&&requestsChartFacts){setPermissionChecked(false);setPendingAstrology({text:clean,retry,readingId:contextReadingId,mode:modeOverride,context:targetContext});return;}
    setPendingAstrology(null);
    uiEpoch.current++;
    turnPending.current=true;
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
    if(clean===draft.trim())setDraft('');
    setSuggestedPrompt('');
    setError('');
    setFailedTurn(null);
    if (!retry) setMessages((current) => [...current, optimistic]);
    setThinking(true);
    nearBottomRef.current = true;
    recordLunaStage('luna_message_sent', { requestId: clientRequestId }, initData);
    if(!commercial)recordLunaStage('model_request_started', { requestId: clientRequestId }, initData);
    const selectedMode=modeOverride??(contextReadingId?'tarot':retry?retry.mode:mode||undefined);
    const readingId=contextReadingId??(retry?retry.readingId:selectedMode==='tarot'?readingContextId??attachedReadingId:undefined);
    const chartId=retry?retry.chartId:selectedMode==='astrology'?contextAstrology?.chartId??attachedChartId:undefined;
    const astrology=retry?retry.astrology:selectedMode==='astrology'?contextAstrology??attachedAstrology:undefined;
    const contextReset=retry?.contextReset??(!readingId&&!chartId&&!astrology&&(contextDetached||Boolean(modeOverride)));
    try {
      const result = await sendLunaMessage({ conversationId: activeId || undefined, message: clean, language, requestId: clientRequestId,contextReset,...(astrologyConsent?{astrologyConsent}:{}),...(selectedMode?{mode:selectedMode}:{}),...(readingId?{readingId}:{}),...(chartId?{chartId}:{}),...(astrology?{astrology}:{}) }, initData);
      const recommendationId = recommendationIdForMessage(result.message);
      if(result.message.metadata?.contextReset){onClearReadingContext?.();setAttachedReadingId(undefined);setAttachedChartId(undefined);setAttachedAstrology(undefined);setContextDetached(true);setMode(result.message.metadata.astrologyWorkflow?'companion':result.message.metadata?.resolvedIntent==='breathing'?'wellbeing':'meditation');}
      if(result.message.metadata?.astrologyWorkflow?.state==='ready'&&result.message.metadata.astrology){const context=result.message.metadata.astrology;setAttachedReadingId(undefined);setAttachedChartId(context.chartId);setAttachedAstrology(context);setContextDetached(false);setMode('astrology');}
      const pendingState = result.message.metadata?.pending_state;
      setUsageRemaining(result.remaining);setUsageResetAt(result.resetAt??null);
      if(!result.message.metadata?.commerce)recordLunaStage('model_result_received', { requestId: clientRequestId, hasAssistantMessage: Boolean(result.message.content) }, initData);
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
      setMessages((current) => current.some(m=>m.id===result.message.id)?current:[...current, result.message]);
      await refreshConversations();
    } catch (sendError) {
      const details = errorDetails(sendError, language);
      setQuotaExhausted(details.state === 'quota_exhausted');
      setFailedTurn({ ...details, clientRequestId, text: clean, optimisticMessageId: optimistic.id,mode:selectedMode,readingId,chartId,astrology,contextReset,astrologyConsent });
    } finally {
      turnPending.current=false;
      setThinking(false);
    }
  };

  async function attachReading(id:string){
    if(thinking)return;autoDiscuss.current.add(id);setThinking(true);setError('');
    uiEpoch.current++;setLoading(false);
    try{const result=await attachSavedLunaTarot(id,initData,activeId||undefined);const saved=await getLunaConversation(result.conversationId,initData);setActiveId(result.conversationId);window.localStorage.setItem(activeConversationKey,result.conversationId);setMessages(saved.messages);setAttachedReadingId(id);setAttachedChartId(undefined);setAttachedAstrology(undefined);setContextDetached(false);setMode('tarot');setScreen('chat');onClearReadingContext?.();await refreshConversations();}
    catch{autoDiscuss.current.delete(id);setError(en?'Could not attach the saved reading. No new AI request was sent.':'Не удалось прикрепить сохранённый расклад. Новый AI-запрос не отправлялся.');}
    finally{setThinking(false);}
  }
  useEffect(()=>{if(!central||loading||thinking||!readingContextId||autoDiscuss.current.has(readingContextId))return;void attachReading(readingContextId);},[central,loading,readingContextId]);
  const updateTarotMessage=useCallback((next:LunaMessage)=>setMessages(current=>current.map(m=>m.id===next.id?next:m)),[]);

  async function startChatTarot(){if(tarotPending.current||thinking)return;tarotPending.current=true;setThinking(true);setError('');tarotClientId.current||=crypto.randomUUID();const clientReadingId=tarotClientId.current;try{const result=await openLunaTarot({clientReadingId,...(activeId?{conversationId:activeId}:{}),kind:tarotKind,intention:tarotIntention,question:tarotQuestion,language},initData);setActiveId(result.conversationId);window.localStorage.setItem(activeConversationKey,result.conversationId);setMessages(current=>current.some(m=>m.id===result.message.id)?current:[...current,result.message]);setAttachedReadingId(result.message.metadata?.tarot?.readingId);setMode('tarot');setTarotComposer(false);setTarotQuestion('');setPendingCommerce(false);tarotClientId.current='';await refreshConversations();}catch(error){if(error instanceof ApiRequestError&&error.status===402){try{const conversationId=activeId||clientReadingId;await savePendingCommerceAction({id:clientReadingId,conversationId,language,action:{type:'tarot',kind:tarotKind,intention:tarotIntention,question:tarotQuestion}},initData);setActiveId(conversationId);window.localStorage.setItem(activeConversationKey,conversationId);setTarotComposer(false);setPendingCommerce(true);}catch{setError(en?'Could not save this action. Nothing was charged; retry the same reading.':'Не удалось сохранить действие. Списания не было — повторите тот же расклад.');}}else setError(en?'Could not open the reading. Your history is unchanged; retry the same request.':'Не удалось открыть расклад. История не изменена — можно повторить запрос.');}finally{tarotPending.current=false;setThinking(false);}}
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

  const useAstrologyContext=useCallback((context:AstrologyChatAttachment)=>{setPendingAstrology(null);onClearReadingContext?.();setAttachedReadingId(undefined);setAttachedChartId(context.chartId);setAttachedAstrology(current=>JSON.stringify(current)===JSON.stringify(context)?current:context);setMode('astrology');setContextDetached(false);setSuggestedPrompt('');},[onClearReadingContext]);
  const updateAstrologyMessage=(next:LunaMessage)=>{setMessages(current=>current.map(m=>m.id===next.id?next:m));if(next.metadata?.astrology)useAstrologyContext(next.metadata.astrology);};
  const discussAstrology=(context:AstrologyChatAttachment)=>{useAstrologyContext(context);void submit(en?'Help me understand the most relevant themes in these exact calculations.':'Помоги понять основные темы именно этих расчётов.',undefined,undefined,'astrology',context);};
  async function beginAstrology(kind:'natal'|'compatibility'){
    if(thinking||turnPending.current)return;turnPending.current=true;setThinking(true);setToolsOpen(false);setTarotComposer(false);setDreamOpen(false);setSuggestedPrompt('');setError('');const id=requestId();
    try{const result=await openLunaAstrology({requestId:id,kind,language,...(activeId?{conversationId:activeId}:{})},initData);onClearReadingContext?.();setAttachedReadingId(undefined);setAttachedChartId(undefined);setAttachedAstrology(undefined);setContextDetached(true);setMode('companion');setActiveId(result.conversationId);window.localStorage.setItem(activeConversationKey,result.conversationId);setMessages(current=>current.some(m=>m.id===result.message.id)?current:[...current,result.message]);setScreen('chat');await refreshConversations();}
    catch{setError(en?'Could not open the profile selector. Your history is unchanged; no AI request was sent.':'Не удалось открыть выбор профилей. История не изменена, AI-запрос не отправлялся.');}
    finally{turnPending.current=false;setThinking(false);}
  }
  const practiceMode=()=>{setSuggestedPrompt('');setPendingAstrology(null);onClearReadingContext?.();setAttachedReadingId(undefined);setAttachedChartId(undefined);setAttachedAstrology(undefined);setMode('meditation');setContextDetached(true);};
  const handleAction=(action:string)=>{if(action==='tarot')beginTarotSetup();else if(action==='history')setScreen('overview');else if(action==='journal')window.dispatchEvent(new Event('luna-open-activity'));else if(action==='breathing')window.dispatchEvent(new Event('luna-open-breathing'));else if(action==='natal_chart'||action==='compatibility')void beginAstrology(action==='compatibility'?'compatibility':'natal');else if(action==='meditation'){practiceMode();void submit(luna2Copy[language].recommendPrompt,undefined,undefined,'meditation');}else void submit(action==='alternative'?(en?'Offer another perspective on this exact context.':'Предложи другой взгляд на этот же контекст.'):(en?'Explore the most relevant point in this context more deeply.':'Рассмотрим самый важный момент этого контекста подробнее.'));};
  const activeTitle = displayConversationTitle(conversations.find((conversation) => conversation.id === activeId)?.title, language);
  const visibleMessages = useMemo(() => messages.filter((message) => message.role === 'user' || message.role === 'assistant'), [messages]);

  useEffect(() => {
    visibleMessages.forEach((message) => {
      if (message.role !== 'assistant' || renderedCardsRef.current.has(message.id)) return;
      const recommendationId = recommendationIdForMessage(message);
      if (!recommendationId) return;
      recordLunaStage('card_render_attempted', { requestId: message.request_id ?? null, meditationId: recommendationId }, initData);
      const recommendation = meditations.find((item) => item.id === recommendationId)??message.metadata?.recommendedMeditation;
      if(recommendation)renderedCardsRef.current.add(message.id);
      recordLunaStage(recommendation ? 'card_render_success' : 'card_render_failed', {
        requestId: message.request_id ?? null,
        meditationId: recommendationId,
        reason: recommendation ? null : 'published meditation was not present in the frontend catalog'
      }, initData);
      if(recommendation&&initData)void acknowledgeLunaAction({messageId:message.id,referenceId:recommendation.id,event:'meditation_card_rendered'},initData).catch(()=>undefined);
    });
  }, [initData, meditations, visibleMessages]);

  if (screen === 'overview') {
    return (
      <div className="luna-ai-overview">
        <div className="luna-ai-overview-header">
          <div><h2>Luna</h2><p>{language === 'ru' ? 'Твой тихий компаньон' : 'Your quiet companion'}</p></div>
          <button type="button" onClick={() => beginConversation()} aria-label={language === 'ru' ? 'Новый разговор' : 'New conversation'}><Plus size={20} />{central&&(en?'New conversation':'Новый разговор')}</button>
        </div>
        {featureFlags.personal_memory&&<button type="button" className="luna32-personalize" onClick={()=>window.dispatchEvent(new Event('luna-open-universe'))}>{en?'Personalize Luna · optional':'Познакомиться с Luna · необязательно'} →</button>}
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
      {central&&(attachedChartId||readingContextId||attachedReadingId)&&<div className="luna32-context"><span>{attachedChartId?(attachedAstrology?.secondChartId?(en?'Compatibility · two charts attached':'Совместимость · две карты прикреплены'):(en?'Natal chart attached':'Натальная карта прикреплена')):(en?'Tarot reading attached':'Расклад Таро прикреплён')}</span><button type="button" disabled={thinking||contextBusy} onClick={()=>void detachContext()}>{contextBusy?(en?'Removing…':'Убираем…'):(en?'Remove':'Убрать')}</button></div>}

      {/* The attachment banner above manages context. Legacy mode state is
          retained for saved-session compatibility, never shown as a selector. */}

      {redesigned && (!central||toolsOpen) && visibleMessages.length > 0 && <button type="button" className="luna2-ideas-toggle" aria-expanded={ideasOpen} onClick={() => setIdeasOpen(value => !value)}>{luna2Copy[language].ideas}</button>}
      {redesigned && ideasOpen && visibleMessages.length > 0 && <LunaQuickActions language={language} onAstrology={kind=>void beginAstrology(kind)} onDream={()=>{setSuggestedPrompt('');setDreamOpen(true);setIdeasOpen(false);}} onTarot={central?beginTarotSetup:onTarot} disabled={thinking} onPrompt={prompt=>{setIdeasOpen(false);if(prompt===luna2Copy[language].recommendPrompt)handleAction('meditation');else void submit(prompt);}} />}

      {central&&toolsOpen&&<div className="luna24-extra-tools">{ambientSound&&<><button type="button" onClick={ambientSound.onToggle}>{ambientSound.playing?(en?'Pause background sound':'Приостановить фоновый звук'):(en?'Play background sound':'Включить фоновый звук')} · {ambientSound.title}</button><button type="button" onClick={ambientSound.onStop}>{en?'Stop background sound':'Выключить фоновый звук'}</button></>}<button type="button" disabled={thinking} onClick={()=>{beginTarotSetup();}}><span aria-hidden="true">✧</span>{en?'New Tarot reading':'Новый расклад Таро'}</button><button type="button" disabled={!activeId||thinking} onClick={()=>{setToolsOpen(false);void removeConversation();}}><Trash2 size={16}/>{en?'Delete conversation':'Удалить разговор'}</button></div>}
      {central&&toolsOpen&&(availableAttachments.readings.length>0||availableAttachments.charts.length>0)&&<details className="luna34-attachments"><summary>{en?'Saved context in this conversation':'Сохранённый контекст разговора'}</summary><p>{en?'Choose what to discuss next. Opening context does not generate an AI answer.':'Выберите тему для продолжения. Открытие контекста не вызывает AI.'}</p><div>{availableAttachments.readings.map((id,index)=><button key={id} type="button" disabled={thinking||contextBusy} aria-pressed={id===attachedReadingId&&mode==='tarot'} onClick={()=>{setToolsOpen(false);void attachReading(id);}}>{en?'Tarot reading':'Расклад Таро'} {index+1}</button>)}{availableAttachments.charts.map((context,index)=><button key={context.chartId+context.secondChartId} type="button" disabled={thinking||contextBusy} aria-pressed={context.chartId===attachedChartId&&mode==='astrology'} onClick={()=>{useAstrologyContext(context);setToolsOpen(false);}}>{context.secondChartId?(en?'Compatibility':'Совместимость'):(en?'Natal chart':'Натальная карта')} {index+1}</button>)}</div></details>}
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
        {dreamOpen?<DreamExplorer language={language} initData={initData} onClose={()=>setDreamOpen(false)} onDiscuss={text=>{setDreamOpen(false);setSuggestedPrompt(text);setAttachedChartId(undefined);setAttachedAstrology(undefined);setAttachedReadingId(undefined);onClearReadingContext?.();setMode('dream');setContextDetached(true);textareaRef.current?.focus();}}/>:loading ? (
          <div className="space-y-3 px-2" aria-label={language === 'ru' ? 'Загрузка разговора' : 'Loading conversation'}>
            <BrandLogo size={48} className="mx-auto" eager />
            <div className="luna-ai-loading-line" />
            <div className="luna-ai-loading-line ml-auto max-w-[76%]" />
            <div className="luna-ai-loading-line max-w-[86%]" />
          </div>
        ) : !visibleMessages.length&&!tarotComposer ? (
          <div className="luna-live-empty">
            <BrandLogo size={88} alt={language === 'ru' ? 'Логотип Luna Meditation' : 'Luna Meditation logo'} eager />
            {redesigned && <span className="luna2-ai-kicker">{luna2Copy[language].aiKicker}</span>}
            <h3>{language === 'ru' ? `Я рядом, ${firstName || 'друг'}.` : `I'm here, ${firstName || 'friend'}.`}</h3>
            <p>{redesigned ? luna2Copy[language].aiBody : language === 'ru' ? 'Расскажи, что у тебя на душе. Я выслушаю без осуждения.' : "Tell me what's on your mind. I'll listen without judgment."}</p>
            {featureFlags.personal_memory&&<button type="button" className="luna32-personalize" onClick={()=>window.dispatchEvent(new Event('luna-open-universe'))}>{en?'Personalize Luna · optional':'Познакомиться с Luna · необязательно'} →</button>}
            {redesigned ? <LunaQuickActions language={language} onAstrology={kind=>void beginAstrology(kind)} onDream={()=>{setSuggestedPrompt('');setDreamOpen(true);setIdeasOpen(false);}} onTarot={central?beginTarotSetup:onTarot} disabled={thinking} onPrompt={prompt=>{setIdeasOpen(false);if(prompt===luna2Copy[language].recommendPrompt)handleAction('meditation');else void submit(prompt);}} /> : <div className="luna-quick-prompts" aria-label={language === 'ru' ? 'Быстрые темы' : 'Quick prompts'}>{prompts.map((prompt) => <button key={prompt} type="button" onClick={() => void submit(prompt)}>{prompt}</button>)}</div>}
          </div>
        ) : visibleMessages.map((message) => {
          const recommendationId = recommendationIdForMessage(message);
          const navigation=resolveLunaDestination(message.metadata?.navigation?.destination,featureFlags);
          const executableWorkflow=Boolean(navigation||message.metadata?.tarot||message.metadata?.astrologyWorkflow||message.metadata?.workflowActions?.length||message.metadata?.resolvedIntent==='breathing'||recommendationId);
          const recommendation = recommendationId
            ? meditations.find((item) => item.id === recommendationId) ?? message.metadata?.recommendedMeditation ?? undefined
            : undefined;
          return (
            <div key={message.id} className={`luna-live-message-row luna-live-message-${message.role} ${central&&message.metadata?.tarot?'has-tarot':''}`}>
              {message.role === 'assistant' && !(central&&message.metadata?.tarot) ? <span className="luna-message-orb" aria-hidden="true" /> : null}
              <div className="luna-live-message-content">
                {!(central&&(message.metadata?.tarot||(message.metadata?.commerce&&!message.metadata?.consultation)))&&<div className="luna-message-bubble"><MessageText text={message.content} assistant={message.role==='assistant'} language={language}/></div>}
                {central&&message.metadata?.commerce&&<ChatCommerce view={message.metadata.commerce.view} language={language} initData={initData} conversationId={activeId||undefined} onResult={result=>{setActiveId(result.conversationId);setMessages(current=>current.some(m=>m.id===result.message.id)?current.map(m=>m.id===result.message.id?result.message:m):[...current,result.message]);}}/>}
                {central&&!executableWorkflow&&message.id===visibleMessages[visibleMessages.length-1]?.id&&message.metadata?.consultation&&(message.metadata.consultation.quickReplies?.length||message.metadata.consultation.actions.length)? <div className="luna24-context-actions" aria-label={en?'Continue your consultation':'Продолжить консультацию'}>{message.metadata.consultation.quickReplies?.length?message.metadata.consultation.quickReplies.slice(0,3).map(prompt=><button type="button" key={prompt} disabled={thinking||quotaExhausted||Boolean(failedTurn)} onClick={()=>void submit(prompt)}>{prompt}</button>):message.metadata.consultation.actions.slice(0,3).map(action=><button type="button" key={action} disabled={thinking||quotaExhausted||Boolean(failedTurn)} onClick={()=>handleAction(action)}>{({continue:en?'Explore further':'Разобраться глубже',alternative:en?'Another perspective':'Другой взгляд',tarot:en?'Start a Tarot reading':'Начать расклад',natal_chart:en?'Open astrology':'Открыть астрологию',compatibility:en?'Open compatibility':'Открыть совместимость',meditation:en?'Find a meditation':'Подобрать медитацию',breathing:en?'Start breathing':'Начать дыхание',journal:en?'Open journal':'Открыть дневник',history:en?'Conversation history':'История разговоров'})[action]}</button>)}</div>:null}
                {central&&!executableWorkflow&&message.id===visibleMessages[visibleMessages.length-1]?.id&&!message.metadata?.consultation&&message.role==='assistant'&&message.metadata?.contextualActions?.length? <div className="luna24-context-actions">{message.metadata.contextualActions.slice(0,3).map(action=><button type="button" key={action} disabled={thinking} onClick={()=>{if(action==='tarot'){setTarotQuestion(messages.filter(m=>m.role==='user').slice(-1)[0]?.content.slice(0,240)??'');beginTarotSetup();}else if(action==='journal')window.dispatchEvent(new Event('luna-open-activity'));else if(action==='birth_profile')window.dispatchEvent(new Event(featureFlags.astrology?'luna-open-astrology':featureFlags.personal_memory?'luna-open-universe':'luna-open-astrology'));else{setMode('meditation');practiceMode();void submit(luna2Copy[language].recommendPrompt,undefined,undefined,'meditation');}}}>{({tarot:en?'Explore with Tarot':'Посмотреть через Таро',journal:en?'Open journal':'Открыть дневник',birth_profile:en?'My birth profile':'Мои данные рождения',meditation:en?'Find a meditation':'Подобрать медитацию'})[action]}</button>)}</div>:null}
                {central&&message.metadata?.tarot&&<ChatTarotReading message={message} language={language} initData={initData} registerBackHandler={registerBackHandler} onUpdate={updateTarotMessage}/>}
                {navigation&&<button type="button" className="luna-button-primary" disabled={thinking} onClick={()=>window.dispatchEvent(new CustomEvent('luna-open-destination',{detail:{destination:navigation.id,messageId:message.id,operationId:message.metadata?.navigation?.operationId}}))}>{en?'Open':'Открыть'} · {navigation[language]} →</button>}
                {central&&message.metadata?.astrologyWorkflow&&<ChatAstrology message={message} language={language} initData={initData} disabled={thinking} onUpdate={updateAstrologyMessage} onDiscuss={discussAstrology} onFollowUp={(prompt,context)=>{useAstrologyContext(context);void submit(prompt,undefined,undefined,'astrology',context);}}/>}
                {central&&message.role==='assistant'&&(message.metadata?.workflowActions?.includes('breathing')||message.metadata?.resolvedIntent==='breathing')&&<ChatBreathing language={language} initial={message.metadata?.breathing} registerBackHandler={registerBackHandler}/>}
                {central&&message.metadata?.workflowActions?.some(a=>a!=='breathing')&&<div className="luna24-context-actions">{message.metadata.workflowActions.filter(a=>a!=='breathing').map(action=><button type="button" key={action} disabled={thinking} onClick={()=>handleAction(action)}>{action==='compatibility'?(en?'Choose two profiles':'Выбрать два профиля'):(en?'Choose a birth profile':'Выбрать данные рождения')}</button>)}</div>}
                {central&&message.id===visibleMessages[visibleMessages.length-1]?.id&&message.metadata?.tarot?.reading&&message.metadata.tarot.revealed>=(message.metadata.tarot.reading.cards?.length||1)&&<div className="luna24-context-actions luna251-followups" aria-label={en?'Continue this reflection':'Продолжить размышление'}>{(en?[message.metadata.tarot.kind==='single'?'Explore this card':'How do these cards connect?','What does this mean for my situation?','Help me think through my next step']:[message.metadata.tarot.kind==='single'?'Рассмотрим эту карту подробнее':'Как связаны карты расклада?','Что это может значить в моей ситуации?','Помоги обдумать следующий шаг']).map(prompt=><button type="button" key={prompt} disabled={thinking||quotaExhausted||Boolean(failedTurn)} onClick={()=>void submit(prompt,undefined,message.metadata?.tarot?.readingId)}>{prompt}</button>)}</div>}
                {featureFlags.cosmos_v2&&featureFlags.personal_memory&&message.metadata?.memoryProposal&&<MemoryProposalCard messageId={message.id} proposal={message.metadata.memoryProposal} language={language} initData={initData} disabled={thinking} onUpdate={proposal=>setMessages(current=>current.map(m=>m.id===message.id?{...m,metadata:{...m.metadata,memoryProposal:proposal}}:m))}/>}
                {featureFlags.personal_memory&&!message.metadata?.tarot&&!message.metadata?.memoryProposal&&!thinking&&(message.id===visibleMessages.filter(m=>m.role===message.role).slice(-1)[0]?.id)&&<MemorySaveAction key={message.id} language={language} initData={initData} message={message}/>}
                {recommendation ? <ChatMeditationCard meditation={recommendation} language={language} hasPremium={hasPremium} onOpen={() => onOpenMeditation(recommendation,{messageId:message.id,referenceId:recommendation.id})} /> : null}
              </div>
            </div>
          );
        })}
        {central&&tarotComposer&&<ConversationalTarotSetup language={language} step={tarotStep} onStep={setTarotStep} kind={tarotKind} onKind={kind=>{setTarotKind(kind);tarotClientId.current='';}} intention={tarotIntention} onIntention={intention=>{setTarotIntention(intention);tarotClientId.current='';}} question={tarotQuestion} onQuestion={question=>{setTarotQuestion(question);tarotClientId.current='';}} spreadsEnabled={featureFlags.tarot_spreads} pending={thinking} onSubmit={()=>void startChatTarot()} onClose={()=>setTarotComposer(false)}/>}
        {thinking ? <div className="luna-thinking-indicator"><span className="luna-message-orb luna-message-orb-thinking" /><span>{language === 'ru' ? 'Luna рядом...' : 'Luna is here...'}</span></div> : null}
        {pendingCommerce&&<ChatCommerce view="wallet" language={language} initData={initData} conversationId={activeId||undefined} onResult={result=>{setPendingCommerce(false);setMessages(current=>current.some(m=>m.id===result.message.id)?current:[...current,result.message]);setAttachedReadingId(result.message.metadata?.tarot?.readingId);setMode('tarot');}}/>}
        {quotaExhausted&&<ChatCommerce view="quota" language={language} initData={initData} conversationId={activeId||undefined}/>}
        {failedTurn ? <div className={`luna-live-error luna-live-error-${failedTurn.state}`} role="status">
          <p>{failedTurn.message}</p>
          <small>{en?'Reference: ':'Код обращения: '}{failedTurn.clientRequestId.slice(0,12)}</small>
          {failedTurn.resetAt&&<small>{en?'Resets: ':'Обновится: '}{new Date(failedTurn.resetAt).toLocaleString(en?'en-US':'ru-RU')}</small>}
          {failedTurn.retryable && failedTurn.state !== 'quota_exhausted' ? <button type="button" disabled={thinking} onClick={() => void submit(failedTurn.text, failedTurn)}><RotateCcw size={14} />{language === 'ru' ? 'Повторить' : 'Retry'}</button> : null}
        </div> : null}
        {error ? <div className="luna-live-error" role="status">
          <p>{error}</p>
          <button type="button" disabled={loading||thinking} onClick={() => readingContextId?void attachReading(readingContextId):void refreshConversations()}>
            <RotateCcw size={14} />{language === 'ru' ? 'Обновить историю' : 'Reload history'}
          </button>
        </div> : null}
      </div>

      {awayFromBottom ? <button type="button" className="luna-scroll-latest" onClick={() => scrollToLatest()} aria-label={language === 'ru' ? 'К последнему сообщению' : 'Scroll to latest'}><ArrowDown size={17} /></button> : null}

      {!quotaExhausted&&usageRemaining!==null&&usageRemaining<=2&&<p className="luna31-quota" role="status">{en?`${usageRemaining} AI replies remaining`:`Осталось ответов AI: ${usageRemaining}`}{usageResetAt&&<span> · {en?'Resets':'Обновится'} {new Date(usageResetAt).toLocaleString(en?'en-GB':'ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZoneName:'short'})}</span>}</p>}
      {suggestedPrompt&&<div className="luna33-suggested-prompt"><button type="button" disabled={thinking||quotaExhausted} onClick={()=>void submit(suggestedPrompt)}>{suggestedPrompt} →</button><button type="button" onClick={()=>setSuggestedPrompt('')} aria-label={en?'Dismiss suggestion':'Убрать подсказку'}>×</button></div>}
      {pendingAstrology&&<section className="luna33-chat-permission" aria-label={en?'AI processing permission':'Согласие на обработку AI'}><label><input type="checkbox" checked={permissionChecked} onChange={e=>setPermissionChecked(e.target.checked)}/><span>{en?'Send these calculated chart positions and any selected report to OpenAI for this conversation. No birth date, time or place is sent. Optional personal memory uses its separate permission.':'Передать рассчитанные положения этих карт и выбранный разбор в OpenAI для этого разговора. Дата, время и место рождения не передаются. Для личной памяти действует отдельное согласие.'}</span></label><div><button type="button" disabled={!permissionChecked||thinking} onClick={()=>void submit(pendingAstrology.text,pendingAstrology.retry,pendingAstrology.readingId,pendingAstrology.mode,pendingAstrology.context,true)}>{en?'Allow & ask Luna':'Разрешить и спросить Luna'}</button><button type="button" onClick={()=>setPendingAstrology(null)}>{en?'Cancel':'Отмена'}</button></div></section>}
      <form className="luna-live-composer" onSubmit={(event) => { event.preventDefault(); void submit(draft); }}>
        <textarea ref={textareaRef}
          value={draft}
          rows={1}
          maxLength={2000}
          disabled={thinking || contextBusy || voiceBusy}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onFocus={() => requestAnimationFrame(() => scrollToLatest(false))}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void submit(draft);
            }
          }}
          placeholder={quotaExhausted ? (language === 'ru' ? 'Баланс, покупки и история доступны' : 'Balance, purchases and history are available') : (language === 'ru' ? 'Напишите Luna...' : 'Message Luna...')}
        />
        {featureFlags.ai_voice_input&&<LunaVoiceInput language={language} initData={initData} disabled={thinking||contextBusy||Boolean(draft.trim())} onBusy={setVoiceBusy} onTranscript={text=>{setDraft(text);textareaRef.current?.focus();}}/>}
        <button type="submit" disabled={!draft.trim() || thinking || contextBusy || voiceBusy || quotaExhausted&&!commerceIntent(draft)} aria-label={language === 'ru' ? 'Отправить' : 'Send'}><Send size={17} /></button>
      </form>
    </section>
  );
}
