const configuredApiUrl = (import.meta.env.VITE_API_URL?.trim() ?? '').replace(/\/+$/, '');
const API_URL = configuredApiUrl || (import.meta.env.DEV ? 'http://localhost:4000' : '');

export const apiDebugConfig = {
  apiBaseUrl: API_URL || window.location.origin,
  configuredApiUrl: configuredApiUrl || null,
  isUsingDevFallback: !configuredApiUrl && import.meta.env.DEV,
  isMissingProductionApiUrl: !configuredApiUrl && !import.meta.env.DEV
};

export class ApiRequestError extends Error {
  status: number | null;
  responseBody: string | null;
  requestUrl: string;
  requestId: string | null;

  constructor(message: string, requestUrl: string, status: number | null = null, responseBody: string | null = null, requestId: string | null = null) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.responseBody = responseBody;
    this.requestUrl = requestUrl;
    this.requestId = requestId;
  }
}

const inFlightRequests = new Map<string, Promise<unknown>>();

export type PersonalProfile={display_name?:string|null;interests:Array<'tarot'|'astrology'|'wellbeing'|'meditation'>;preferences:string;birth_date:string|null;birth_time:string|null;birth_place:string|null;ai_context_consent:boolean};
export type PersonalMemoryCategory='personal_facts'|'preferences'|'goals'|'interests'|'birth_information'|'life_context'|'reflections';
export type PersonalMemory={id:string;category:string;memory_key:string;memory_value:string;confirmation_status:'pending'|'confirmed';memory_kind:'fact'|'symbolic';is_sensitive:boolean;source_type:string;source_message_id:string|null;revision:number;created_at:string;updated_at:string;confirmed_at:string|null};
export type UniverseData={memories:PersonalMemory[];profile:PersonalProfile;identity:{firstName:string;language:string;goals:string[]}|null;memoryEnabled:boolean;contextConsent:boolean};
export type PersonalMemoryInput={category:PersonalMemoryCategory;key:string;value:string;confirmed:boolean;kind:'fact'|'symbolic';sourceMessageId?:string;revision?:number;sensitiveConsent:boolean};
export const getUniverse=(initData?:string)=>request<UniverseData>('/api/universe',undefined,initData);
export const transcribeLunaVoice=(wav:Blob,requestId:string,language:AppLanguage,initData?:string)=>request<{text:string;requestId:string;cached:boolean;costMicrousd:number}>(`/api/luna/voice/${requestId}?language=${language}`,{method:'POST',headers:{'Content-Type':'audio/wav'},body:wav},initData);
export type CosmosOnboardingState={skipped:string[];revision:number;updatedAt:string|null};
export type MeetLunaState={meet:{version?:1;completed?:string[];skipped?:string[];finishedAt?:string;consentVersion?:string;consentedAt?:string};revision:number;updatedAt:string|null};
export const getMeetLuna=(initData?:string)=>request<MeetLunaState>('/api/universe/meet',undefined,initData);
export const saveMeetLuna=(input:{requestId:string;expectedRevision:number;step:string;skip?:boolean;language:AppLanguage;answer?:string|string[]|boolean;sensitiveConsent?:boolean},initData?:string)=>request<MeetLunaState>('/api/universe/meet',{method:'PUT',body:JSON.stringify(input)},initData);
export const getCosmosOnboarding=(initData?:string)=>request<CosmosOnboardingState>('/api/universe/onboarding',undefined,initData);
export const saveCosmosOnboarding=(input:{skipped:string[];expectedRevision:number;requestId:string},initData?:string)=>request<CosmosOnboardingState>('/api/universe/onboarding',{method:'PUT',body:JSON.stringify(input)},initData);
export const writePersonalMemory=(input:PersonalMemoryInput,initData?:string,id?:string)=>request<PersonalMemory>(`/api/universe/memories${id?'/'+id:''}`,{method:id?'PATCH':'POST',body:JSON.stringify(input)},initData);
export const removePersonalMemory=(initData?:string,id?:string)=>request<{ok:boolean}>(`/api/universe/memories${id?'/'+id:''}`,{method:'DELETE'},initData);
export const getPersonalProfile=(initData?:string)=>request<PersonalProfile>('/api/personalization',undefined,initData);
export const savePersonalProfile=(profile:PersonalProfile,initData?:string)=>request<PersonalProfile>('/api/personalization',{method:'PUT',body:JSON.stringify(profile)},initData);
export const deletePersonalProfile=(initData?:string)=>request<{ok:boolean}>('/api/personalization',{method:'DELETE'},initData);
export type TarotInterpretation={version?:2;summary:string;cardMeaning?:string;context?:string;reflection?:string;question:string;continuation:string|null;cardInsights?:Array<{cardId:string;text:string}>;links?:string;cards?:Array<{cardId:string;orientation:'upright'|'reversed';position:string;positionMeaning:string;application:string;detail:string}>;overall?:string;actions?:string[]};
export type TarotSelection={cardId:string;orientation:'upright'|'reversed'};
export type TarotReading={id:string;client_reading_id:string;card_id:string;orientation:'upright'|'reversed';reading_kind?:'single'|'daily'|'three'|'five';cards?:TarotSelection[];intention:'general'|'love'|'career'|'growth';question:string;language:AppLanguage;interpretation:TarotInterpretation|null;status:'local'|'processing'|'ready'|'fallback'|'safety';fallback_reason:string|null;created_at:string;updated_at:string};
export const saveTarotReading=(input:{clientReadingId:string;cardId:string;orientation:TarotReading['orientation'];intention:TarotReading['intention'];question:string;language:AppLanguage;generate:boolean},initData?:string)=>request<{reading:TarotReading;reason:string|null}>('/api/tarot/readings',{method:'POST',body:JSON.stringify(input)},initData);
export const listTarotReadings=(offset=0,initData?:string)=>request<{readings:TarotReading[];nextOffset:number|null}>(`/api/tarot/readings?offset=${offset}`,undefined,initData);
export const deleteTarotReading=(id:string,initData?:string)=>request<{ok:boolean}>(`/api/tarot/readings/${id}`,{method:'DELETE'},initData);
export type DailyTarotResult={reading:TarotReading;day:string;timezone:'UTC';resetsAt:string;reason:string|null};
export const openDailyTarot=(language:AppLanguage,generate=false,initData?:string,expectedDay?:string)=>request<DailyTarotResult>('/api/tarot/daily',{method:'POST',body:JSON.stringify({language,generate,...(expectedDay?{expectedDay}:{})})},initData);
export const getDailyTarotStatus=(initData?:string)=>request<{state:'new'|'saved'|'removed';day:string;resetAt:string}>('/api/tarot/daily',undefined,initData);
export const saveTarotSpread=(reading:{clientReadingId:string;kind:'three'|'five';cards:TarotSelection[];intention:TarotReading['intention'];question:string;language:AppLanguage;generate:boolean},initData?:string,orderId?:string)=>request<{reading:TarotReading;reason:string|null}>('/api/tarot/spreads',{method:'POST',body:JSON.stringify({reading,...(orderId?{orderId}:{})})},initData);
export type ReadingOffer={kind:'single'|'three'|'five';cards:number;seeds:number|null;stars:number};
export type ReadingOrder={id:string;kind:ReadingOffer['kind'];currency:'SEEDS'|'XTR';amount:number;status:'pending'|'entitled'|'consumed'|'refunded';client_reading_id:string|null};
export const getReadingOffers=(initData?:string)=>request<{enabled:boolean;offers:ReadingOffer[];premium:{threeDaily:number;fiveDaily:number;monthlyStars:number|null}|null}>('/api/luna21/offers',undefined,initData);
export const buyReading=(input:{requestId:string;kind:ReadingOffer['kind'];currency:'SEEDS'|'XTR';expectedAmount:number;confirmed:true;termsAccepted:true},initData?:string)=>request<{order:ReadingOrder;invoiceUrl:string|null}>('/api/luna21/orders',{method:'POST',body:JSON.stringify(input)},initData);
export const getReadingOrder=(id:string,initData?:string)=>request<ReadingOrder>(`/api/luna21/orders/${id}`,undefined,initData);

export type AccessState = {
  hasPremium: boolean;
  hasPaidPremium?:boolean;
  beta?:{active:boolean;startsAt:string|null;expiresAt:string|null;features:string[];source:'promotion';autoCharge:false}|null;
  plan: string;
  user?: {
    language_code?: string | null;
    active_until?: string | null;
    lifetime_access?: boolean;
  };
};

export type AppLanguage = 'en' | 'ru';
export type RelationshipKind='romantic'|'business'|'friendship'|'family';
export type BirthLocation={placeId:string;label:string;latitude:number;longitude:number;timezone:string;provider:string;confirmed:true};
export type BirthProfile={id:string;subject_kind:'self'|'other';display_label:string;birth_date:string;birth_time:string|null;location:BirthLocation;revision:number;created_at:string;updated_at:string};
export type BirthProfileInput={subjectKind:'self'|'other';label:string;date:string;time:string|null;placeId:string;consent:true;revision?:number};
export type NatalCalculation={engine:string;engineVersion:string;ephemeris:string;timezoneDatabaseVersion:string;timePrecision:'exact'|'unknown';utcInstant:string|null;ascendant:number|null;houses:number[];planets:Array<{id:string;longitude:number}>;aspects:Array<{from:string;to:string;type:string;orb:number}>;houseSystem:'whole-sign';uncertainPlanets:Array<{id:string;signs:number[]}>;warnings:string[];approximatePlanets:boolean};
export type NatalChart={id:string;profile_id:string;profile_revision:number;calculation:NatalCalculation;created_at:string};
export type BirthLocationResult={placeId:string;label:string;country:string;timezone:string;latitude:number;longitude:number};
export type SynastryResult={firstChartId:string;secondChartId:string;aspects:Array<{from:string;to:string;type:string;orb:number}>;unknownTime:boolean;excluded:{first:string[];second:string[]};percentage:null;disclaimer:string;reflection?:{version:string;relationship:RelationshipKind;index:number|null;scale:number;reason:string|null;methodology:string;dimensions:Array<{id:string;score?:number|null;weight?:number;flow:number;tension:number;conjunctions:number;evidence:Array<{from:string;to:string;type:string;orb:number}>}>}|null};
export const findBirthLocations=(q:string,initData?:string)=>request<{locations:BirthLocationResult[]}>(`/api/astrology/locations?q=${encodeURIComponent(q)}`,undefined,initData);
export const getBirthProfiles=(initData?:string)=>request<{profiles:BirthProfile[]}>('/api/astrology/profiles',undefined,initData);
export type CelestialMonth={month:string;timezone:'UTC';events:Array<{quarter:number;at:string}>;days:Array<{date:string;at?:string;moonPhaseDegrees:number;illuminatedFraction:number;planets?:Array<{id:string;longitude:number}>;aspects?:Array<{from:string;to:string;type:string;orb:number}>}>;personalPrediction:false;transitScope?:'general_sky_at_12_utc'};
export const getCelestialMonth=(month:string,initData?:string)=>request<CelestialMonth>(`/api/astrology/calendar?month=${encodeURIComponent(month)}`,undefined,initData);
export type DreamEntry={id:string;client_id:string;title:string;description:string;language:AppLanguage;dream_date:string;created_at:string;updated_at:string};
export const getDreams=(initData?:string)=>request<{dreams:DreamEntry[];nextOffset:number|null}>('/api/luna32/dreams',undefined,initData);
export const saveDream=(value:{clientId:string;title:string;description:string;language:AppLanguage;date:string;saveConsent:true},initData?:string,id?:string)=>request<DreamEntry>(`/api/luna32/dreams${id?'/'+id:''}`,{method:id?'PATCH':'POST',body:JSON.stringify(value)},initData);
export const removeDream=(id:string,initData?:string)=>request<{ok:boolean}>(`/api/luna32/dreams/${id}`,{method:'DELETE'},initData);
export const saveBirthProfile=(input:BirthProfileInput,initData?:string,id?:string)=>request<{profile:BirthProfile}>(`/api/astrology/profiles${id?'/'+id:''}`,{method:id?'PUT':'POST',body:JSON.stringify(input)},initData);
export const removeBirthProfile=(id:string,initData?:string)=>request<{ok:boolean}>(`/api/astrology/profiles/${id}`,{method:'DELETE'},initData);
export const calculateBirthChart=(id:string,initData?:string)=>request<{chart:NatalChart;cached:boolean}>(`/api/astrology/profiles/${id}/chart`,{method:'POST',body:'{}'},initData);
export const getBirthChart=(id:string,initData?:string)=>request<{chart:NatalChart}>(`/api/astrology/charts/${id}`,undefined,initData);
export const compareBirthCharts=(firstChartId:string,secondChartId:string,initData?:string,relationship?:RelationshipKind)=>request<SynastryResult>('/api/astrology/compatibility',{method:'POST',body:JSON.stringify({firstChartId,secondChartId,...(relationship?{relationship}:{})})},initData);
export type AstrologyReportRecord={id:string;first_chart_id:string;second_chart_id:string|null;report_kind:'portrait'|'compatibility';language:AppLanguage;report:{summary:string;sections:Array<{id:string;title:string;text:string}>;question:string;disclaimer:string};created_at:string};
export type Luna30Finance={ai:Array<{category:string;requests:number;input_tokens:number;output_tokens:number;known_cost_usd:number;unknown_cost_requests:number}>;legacy_paid_stars:number;new_paid_stars:number;refund_stars:number;refunds_needing_review:number;active_new_periods:number;seed_delta:number;net_usd:null;sales_flags:Record<string,unknown>};
export const getLuna30Finance=(initData?:string)=>request<Luna30Finance>('/api/luna30/commerce/admin/metrics',undefined,initData);
export const openAstrologyReport=(firstChartId:string,secondChartId:string|null,language:AppLanguage,initData?:string,relationship?:RelationshipKind)=>request<{report:AstrologyReportRecord|null;cached:true}>(`/api/astrology/reports?${new URLSearchParams({firstChartId,...(secondChartId?{secondChartId}:{}),language,...(relationship?{relationship}:{})})}`,undefined,initData);
export const generateAstrologyReport=(firstChartId:string,secondChartId:string|null,language:AppLanguage,initData?:string,relationship?:RelationshipKind)=>request<{report:AstrologyReportRecord;cached:boolean}>('/api/astrology/reports',{method:'POST',body:JSON.stringify({firstChartId,...(secondChartId?{secondChartId}:{}),language,consent:true,...(relationship?{relationship}:{})})},initData);

export type MeditationTranslation = {
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  audioUrl?: string | null;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
};

export type Meditation = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  category: string;
  duration: number;
  cover_image: string;
  audio_file: string;
  premium: boolean;
  published: boolean;
  mood: 'Calm' | 'Stressed' | 'Focused' | 'Tired' | 'Anxious';
  play_count: number;
  created_at: string;
  translations?: Partial<Record<AppLanguage, MeditationTranslation>>;
  favorite?: boolean;
  history?: PlaybackHistory | null;
};

export type PlaybackHistory = {
  id: string;
  meditation_id: string;
  last_played: string;
  play_count: number;
  completion_percent: number;
  last_position: number;
  completed: boolean;
  meditation?: Meditation;
};

export type ProfileWeek = {
  weekStart: string;
  activeDays: number;
  practiceDays: number;
  completedDays: number;
  completedSessions: number;
  listeningMinutes: number;
  days: Array<{
    key: string;
    label: string;
    state: 'completed' | 'current' | 'missed' | 'future' | 'freeze_used' | 'premium_freeze';
    minutes: number;
    sessions: number;
    isCurrent: boolean;
    hasCheckin: boolean;
    hasVerifiedPractice: boolean;
  }>;
};

export type ProfileStats = {
  journeyV3?:ReturnType<typeof import('../../backend/src/luna30-progression').buildLuna30Progress>;
  user?: {
    first_name?: string;
    username?: string;
    language_code?: string | null;
    active_until?: string | null;
    lifetime_access?: boolean;
    avatar_url?: string | null;
    profile_goals?: string[] | null;
    notification_preferences?: NotificationPreferences | null;
  };
  completed: number;
  completedMeditations?: number;
  completedBreathSessions?: number;
  dayStreak: number;
  currentStreak: number;
  longestStreak: number;
  freezeCount?: number;
  freezeMax?: number;
  lastFreezeUsed?: string | null;
  lastCleanWeekAwarded?: string | null;
  minutesListened: number;
  weeklyPracticeMinutes?: number;
  weeklyStats?: {
    listeningMinutes: number;
    completedSessions: number;
    checkins: number;
    activeDays: number;
    practiceDays: number;
    completedDays: number;
  };
  lifetimeStats?: {
    totalListeningMinutes: number;
    totalSessions: number;
    longestStreak: number;
    practiceDays: number;
    completedWeeks: number;
  };
  currentWeek?: ProfileWeek;
  previousWeek?: ProfileWeek;
  moodTrend?: Array<{
    key: string;
    mood: DailyCheckin['mood'] | null;
    sleepRange?: DailyCheckin['sleep_range'];
    listeningMinutes?: number;
    completedSessions?: number;
    practiceId?: string | null;
    practiceTitle?: string | null;
  }>;
  progressInsights?: {
    favoriteCategory: string | null;
    favoriteCategoryCount: number;
    favoriteMeditationTitle: string | null;
    favoritePracticeTime: 'morning' | 'afternoon' | 'evening' | 'night' | null;
    favoritePracticeTimeCount: number;
    favoritePracticeTimeDays: number;
    averageSessionMinutes: number;
    completedPracticeSamples: number;
    monthlyPracticeDays: number;
    monthlyConsistency: number;
    bestPracticeWeekday: number | null;
    bestPracticeWeekdayCount: number;
    observedPracticeWeeks: number;
  };
  totalPracticeMinutes?: number;
  calmPoints?: number;
  moonSeeds?: number;
  moonSeedsAvailable?: number;
  moonSeedsEarnedTotal?: number;
  plantedGardenElements?: string[];
  plantedElementsCount?: number;
  lastMoonSeedEarnedAt?: string | null;
  gardenLevel?: number;
  gardenAtomicReady?:boolean;
  streakDays?: number;
  lastPracticeDate?: string | null;
  purchasedPlan: string;
  calmScore: number;
  rewards: Record<7 | 14 | 30 | 100, boolean>;
  achievements?: {
    version?:number;
    unlocked: number;
    total: number;
    items: Array<{
      id: string;
      title: string;
      description: string;
      category: string;
      unlocked: boolean;
      unlockedAt?: string | null;
      progress?: number;
      current?: number;
      target?: number;
      art?:string;
      celebrationPending?:boolean;
    }>;
  };
  journeyStatus?: {
    id: 'initiate' | 'seeker' | 'adept' | 'guardian' | 'luminary' | 'sage' | 'ascendant' | 'celestial' | 'ethereal' | 'lunaris';
    rank: number;
    earned: boolean;
    eligibleRank: number;
    unlockedAt?: string | null;
    next: {
      id: 'initiate' | 'seeker' | 'adept' | 'guardian' | 'luminary' | 'sage' | 'ascendant' | 'celestial' | 'ethereal' | 'lunaris';
      rank: number;
      progressPercent: number;
      remaining: Array<{
        key: 'completedMeditations' | 'longestStreak' | 'unlockedAchievements' | 'gardenLevel';
        current: number;
        target: number;
        remaining: number;
      }>;
    } | null;
  };
  progressDiagnostics?: {
    localWeekStart: string;
    localWeekEnd: string;
    previousWeekStart: string;
    previousWeekEnd: string;
    sourceSessionCount: number;
    verifiedListeningSeconds: number;
    dailyActiveDates: string[];
    currentStreak: number;
    longestStreak: number;
    moodEntriesCount: number;
    plantedGardenUpgrades: number;
    achievementCount: number;
    lastProgressRefreshAt: string;
  };
};

export type ReminderType = 'daily' | 'morning' | 'evening' | 'streak_risk' | 'inactivity' | 'weekly_summary';

export type NotificationPreferences = {
  remindersEnabled: boolean;
  reminderTypes: ReminderType[];
  consentedAt: string | null;
  dailyReminder: boolean;
  newContent: boolean;
  reminderTime: string;
  timezone: string;
};

export type PurchasePlanId = 'annual' | 'lifetime';

export type PlanCatalog = Record<PurchasePlanId, {
  id: PurchasePlanId;
  title: string;
  amountStars: number;
  days?: number;
}>;

export type SupportCategory = 'problem' | 'feedback' | 'payment' | 'contact' | 'account_deletion';
export type SupportStatus = 'new' | 'in_progress' | 'resolved';
export type AdminSupportRequest = {
  id: string;
  category: SupportCategory;
  message: string;
  contact: string | null;
  app_version: string;
  build_sha: string;
  platform: string;
  status: SupportStatus;
  created_at: string;
  updated_at: string;
  users?: { first_name?: string | null; username?: string | null } | null;
};

export type DailyCheckin = {
  id?: string;
  telegram_id?: number;
  sleep_range: 'less_than_4' | '4_6' | '6_8' | '8_plus' | null;
  mood: 'calm' | 'stressed' | 'tired' | 'anxious' | 'focused' | 'low_energy';
  available_minutes: '3' | '5' | '10' | '15_plus' | null;
  local_date: string;
  created_at?: string;
};

export type DailyCheckinPayload = Pick<DailyCheckin, 'mood'> & Partial<Pick<DailyCheckin, 'sleep_range' | 'available_minutes'>> & {
  local_date?: string;
  telegram_id?: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  language_code?: string;
};

export type WellnessSummary = {
  todayCheckin: DailyCheckin | null;
  weeklyCheckins: DailyCheckin[];
  weeklyCheckinCount: number;
  averageSleepHours: number;
  averageSleepLabel: string;
  mostCommonMood: DailyCheckin['mood'] | null;
  mostCommonMoodLabel: string;
  weeklyInsight: string;
  recommendedFocus: string;
  level: {
    title: string;
    current: number;
    progress: number;
    next: string;
  };
  achievements: Array<{
    id: string;
    title: string;
    description: string;
    unlocked: boolean;
  }>;
};

export type MeditationPayload = {
  title: string;
  subtitle: string;
  description: string;
  category: string;
  duration: number;
  cover_image: string;
  audio_file: string;
  premium: boolean;
  published: boolean;
  mood: Meditation['mood'];
  translations?: Partial<Record<AppLanguage, MeditationTranslation>>;
};

export type LunaConversationSummary = {
  id: string;
  title: string;
  language: AppLanguage;
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
  last_message_at: string;
  latestMessage: string;
};

export type AstrologyChatAttachment={chartId:string;secondChartId?:string;reportId?:string;comparisonId?:string;relationship?:'romantic'|'business'|'friendship'|'family';planet?:'sun'|'moon'|'mercury'|'venus'|'mars'|'jupiter'|'saturn'|'uranus'|'neptune'|'pluto';aspect?:{from:string;to:string;type:string}};
export type AstrologyWorkflow={version:1;kind:'natal'|'compatibility';state:'selecting'|'ready';relationship?:'romantic'|'business'|'friendship'|'family';firstProfileId?:string;secondProfileId?:string;firstChartId?:string;secondChartId?:string;compatibilitySnapshot?:{reportId:string;calculatedAt:string;reflection:SynastryResult['reflection']}};
export const openLunaAstrology=(input:{requestId:string;conversationId?:string;kind:'natal'|'compatibility';language:AppLanguage;relationship?:'romantic'|'business'|'friendship'|'family';firstProfileId?:string;secondProfileId?:string},initData?:string)=>request<{conversationId:string;message:LunaMessage}>('/api/luna/tools/astrology',{method:'POST',body:JSON.stringify(input)},initData);
export type LunaMessage = {
  id: string;
  request_id?: string | null;
  role: 'user' | 'assistant';
  content: string;
  metadata?: {
    navigation?:{destination:import('../../backend/src/luna41-navigation').LunaDestinationId;operationId?:string};
    commerce?:{version:1;view:import('../../backend/src/luna35-commerce-policy').CommerceView;language:AppLanguage;checkedAt:string};
    contextReset?:boolean;
    astrology?:AstrologyChatAttachment;
    astrologyWorkflow?:AstrologyWorkflow;
    astrologyConsent?:{version:1;chartId:string;secondChartId?:string};
    workflowActions?:Array<'natal_chart'|'compatibility'|'breathing'>;
    readingId?:string;
    consultation?:{version:1;phase:string;actions:Array<'continue'|'alternative'|'tarot'|'natal_chart'|'compatibility'|'meditation'|'breathing'|'journal'|'history'>;quickReplies?:string[]};
    breathing?:{practiceId:string;minutes:number};
    contextualActions?:Array<'tarot'|'birth_profile'|'journal'|'meditation'>;
    tarot?:{readingId:string;clientReadingId:string;kind:'single'|'three'|'five';revealed:number;requestHash:string;reading:TarotReading|null};
    recommendedMeditationId?: string | null;
    meditationAction?: {
      type: 'meditation_card';
      meditationId: string;
    } | null;
    recommendedMeditation?: Meditation | null;
    safetyState?: string;
    resolvedIntent?: string | null;
    pending_action?: string | null;
    pending_state?: {
      pending_intent?: string;
      pending_meditation_id?: string | null;
      pending_action?: string;
      clarification_hash?: string | null;
    } | null;
    duplicateClarificationBlocked?: boolean;
  };
  created_at: string;
};

export type LunaMemory = {
  id: string;
  category: string;
  memory_key: string;
  memory_value: string;
  created_at: string;
  updated_at: string;
};

export type PendingCommerceAction={id:string;conversation_id:string;action_type:string;parameters:unknown;state:string;expires_at:string;eligibility?:{allowed:boolean;source:string;required:number;shortfall:number}|null};
export type CommerceCard={version:1;view:import('../../backend/src/luna35-commerce-policy').CommerceView;content:string;balance:number;membership:MembershipOverview['membership'];catalog:MembershipOverview['catalog'];products:Record<string,boolean>;usage:MembershipOverview['usage'];beta:MembershipOverview['beta'];earning:Array<{id:string;destination:string;seeds?:number;rewardPerMinute?:number;completionBonus?:number}>;transactions:MembershipOverview['transactions'];pendingOrders:Array<{id:string;request_id:string;product:string;stars:number;state:string;created_at:string}>;pending:PendingCommerceAction[]};
export function getCommerceCard(view:import('../../backend/src/luna35-commerce-policy').CommerceView,language:AppLanguage,initData?:string,conversationId?:string){return request<CommerceCard>('/api/luna35/commerce?'+new URLSearchParams({view,language,...(conversationId?{conversationId}:{})}),undefined,initData);}
export function savePendingCommerceAction(input:import('../../backend/src/luna35-commerce-policy').PendingActionInput,initData?:string){return request<{action:{id:string}}>('/api/luna35/pending-actions',{method:'POST',body:JSON.stringify(input)},initData);}
export function resumePendingCommerceAction(id:string,initData?:string,expectedSeeds?:number){return request<{conversationId:string;message:LunaMessage}>(`/api/luna35/pending-actions/${encodeURIComponent(id)}/resume`,{method:'POST',body:JSON.stringify({confirmed:true,...(expectedSeeds===undefined?{}:{expectedSeeds})})},initData);}
export function getPendingCommerceActions(conversationId:string,initData?:string){return request<{actions:PendingCommerceAction[]}>('/api/luna35/pending-actions?'+new URLSearchParams({conversationId}),undefined,initData);}
export const recordLuna35Launch=(initData?:string)=>request('/api/luna35/launch',{method:'POST',body:'{}'},initData);
export const getLuna35Funnel=(initData?:string)=>request<{since:string;groups:Array<{event:string;source:string;events:number;accounts:number}>;note:string}>('/api/luna35/admin/funnel',undefined,initData);

function telegramHeaders(initData?: string) {
  const headers: Record<string, string> = {};

  if (initData) {
    headers['x-telegram-init-data'] = initData;
  }

  return headers;
}

async function request<T>(path: string, options?: RequestInit, initData?: string): Promise<T> {
  const requestUrl = `${API_URL}${path}`;
  const method = options?.method ?? 'GET';
  const dedupeKey = `${method}:${requestUrl}:${initData ?? ''}`;

  if (method === 'GET' && inFlightRequests.has(dedupeKey)) {
    return inFlightRequests.get(dedupeKey) as Promise<T>;
  }

  const promise = executeRequest<T>(requestUrl, options, initData);

  if (method === 'GET') {
    inFlightRequests.set(dedupeKey, promise);
    promise.then(
      () => inFlightRequests.delete(dedupeKey),
      () => inFlightRequests.delete(dedupeKey)
    );
  }

  return promise;
}

async function executeRequest<T>(requestUrl: string, options?: RequestInit, initData?: string): Promise<T> {
  const clientRequestId = new Headers(options?.headers).get('x-request-id');
  let response: Response;
  try {
    response = await fetch(requestUrl, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...telegramHeaders(initData), ...options?.headers }
    });
  } catch (error) {
    throw new ApiRequestError(error instanceof Error ? error.message : 'Network request failed.', requestUrl, null, null, clientRequestId);
  }

  const responseBody = await response.text();
  if (!response.ok) {
    throw new ApiRequestError(`Request failed: ${response.status}`, requestUrl, response.status, responseBody, response.headers.get('x-request-id') ?? clientRequestId);
  }

  try {
    return JSON.parse(responseBody) as T;
  } catch {
    throw new ApiRequestError('API response was not valid JSON.', requestUrl, response.status, responseBody, response.headers.get('x-request-id') ?? clientRequestId);
  }
}

export async function syncUser(user: TelegramWebAppUser, initData?: string) {
  return request('/api/users/sync', {
    method: 'POST',
    body: JSON.stringify({
      telegram_id: user.id,
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      language_code: user.language_code
    })
  }, initData);
}

export async function getAccess(initData?: string): Promise<AccessState> {
  return request('/api/access/me', undefined, initData);
}

export async function getCategories(): Promise<Category[]> {
  const response = await request<{ categories: Category[] }>('/api/categories');
  return response.categories;
}

export async function getMeditations(initData?: string): Promise<Meditation[]> {
  let timezone = 'UTC';
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    timezone = 'UTC';
  }
  const response = await request<{ meditations: Meditation[] }>(`/api/meditations?timezone=${encodeURIComponent(timezone)}`, undefined, initData);
  return response.meditations;
}

export async function getFavorites(initData?: string): Promise<Meditation[]> {
  const response = await request<{ favorites: Meditation[] }>('/api/favorites', undefined, initData);
  return response.favorites;
}

export async function setFavorite(meditationId: string, favorite: boolean, initData?: string) {
  return request<{ favorite: boolean }>(`/api/favorites/${meditationId}`, {
    method: 'POST',
    body: JSON.stringify({ favorite })
  }, initData);
}

export async function getHistory(initData?: string): Promise<PlaybackHistory[]> {
  const response = await request<{ history: PlaybackHistory[] }>('/api/history', undefined, initData);
  return response.history;
}

export async function saveHistory(input: {
  meditation_id: string;
  last_position: number;
  duration: number;
  completed?: boolean;
  session_id?: string;
  local_date?: string;
}, initData?: string) {
  return request<{
    completion_percent: number;
    completed: boolean;
    moonSeedsAwarded?: number;
    completionBonusAwarded?: boolean;
  }>('/api/history', {
    method: 'POST',
    body: JSON.stringify(input)
  }, initData);
}

export async function startPlaybackSession(meditationId: string, localDate: string, initData?: string) {
  return request<{ id: string; meditation_id: string; listened_seconds: number }>('/api/history/session', {
    method: 'POST',
    body: JSON.stringify({ meditation_id: meditationId, local_date: localDate })
  }, initData);
}

export async function heartbeatPlaybackSession(sessionId: string, lastPosition: number, initData?: string) {
  return request<{
    ok: boolean;
    listened_seconds: number;
    intervalAccepted: boolean;
    completionQualified: boolean;
    completed: boolean;
    newlyCompleted: boolean;
  }>('/api/history/session/heartbeat', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, last_position: lastPosition })
  }, initData);
}

export async function saveBreathSession(input: {
  session_id?:string;
  mode: 'calm' | 'box' | '478' | 'coherent' | 'triangle' | 'sigh' | 'anxiety_reset' | 'sleep' | 'morning_energy';
  duration_seconds: number;
  breath_count: number;
  local_date?: string;
}, initData?: string) {
  return request('/api/breath-sessions', {
    method: 'POST',
    body: JSON.stringify(input)
  }, initData);
}

export const startVerifiedBreath=(clientId:string,mode:string,duration:number,initData?:string)=>request<{id:string;verifiedSeconds:number;completed:boolean}>('/api/luna34/breath/start',{method:'POST',body:JSON.stringify({clientId,mode,duration})},initData);
export const heartbeatVerifiedBreath=(id:string,active:boolean,initData?:string)=>request<{verifiedSeconds:number;completed:boolean}>(`/api/luna34/breath/${id}/heartbeat`,{method:'POST',body:JSON.stringify({active})},initData);
export const recordProgressEvidence=(input:{kind:string;entityId:string;detail?:string;secondChartId?:string},initData?:string)=>request<{recorded:boolean}>('/api/luna34/progress/events',{method:'POST',body:JSON.stringify(input)},initData);
export const acknowledgeMilestones=(ids:string[],initData?:string)=>request('/api/luna34/progress/acknowledge',{method:'POST',body:JSON.stringify({ids})},initData);
export const prepareShareExport=(input:{kind:string;asset?:string;format:string;reference?:string;secondReference?:string},initData?:string)=>request<{ticket:string}>('/api/luna34/share/prepare',{method:'POST',body:JSON.stringify(input)},initData);
export const completeShareExport=(input:{ticket:string;outcome:'download_invoked'|'native_share_completed';sha256:string;bytes:number},initData?:string)=>request('/api/luna34/share/complete',{method:'POST',body:JSON.stringify(input)},initData);
export type MembershipOverview={catalog:{version:string;premium:{monthlyStars:number;ordinaryAiRepliesPerBillingMonth:number;threeCardReadings:number;fiveCardReadings:number;compatibilityReports:number;renewalSeeds:number;meditations:number};annual:{stars:number;days:number;recurring:false};free:{aiSuccessfulRepliesPerUtcDay:number;meditations:number};packages:Array<{id:string;seeds:number;stars:number}>;supportStars:number[]};membership:{kind:'free'|'monthly'|'annual'|'lifetime'|'legacy_fixed_term';paid:boolean;until:string|null;preserveLegacy:boolean;ordinaryLimit:number|null;resetAt:string|null};commercialEnabled:boolean;quotasEnabled:boolean;balance:number;earned:number;transactions:Array<{id:string;kind:string;delta:number;balance_after:number;created_at:string}>|null;purchases:Array<{id:string;plan:string;amount_stars:number;currency:string;status:string;created_at:string}>;newPurchases:Array<{charge_id:string;order_id:string;stars:number;state:string;subscription_expires_at:string|null;cancelled_at:string|null;created_at:string}>|null;usage:{limit:number;remaining:number;resetAt:string;scope?:'utc_day'|'billing_month'};beta:{active:boolean;expiresAt:string|null}};
export type ReferralOverview={enabled:boolean;link:string|null;total:number;pending:number;qualified:number;rewarded:number;seedsEarned:number;monthlyCap:number;rewardsEnabled:boolean;onboardingRequired:boolean};
export const getReferralOverview=(initData?:string)=>request<ReferralOverview>('/api/luna34/referrals',undefined,initData);
export type Luna34Operations={achievement_count:number;progress_settings:{enabled:boolean;achievement_rewards_enabled:boolean};event_volume_last_hour:number;stale_allowance_reservations:number;financial_activation:Record<string,unknown>;pricing_basis:string;groups:Array<{billing_month:string;feature:string;model:string;requests:number;operations:number;active_users:number;completed:number;failed_or_unknown:number;retry_leases:number;additional_provider_calls:number;input_tokens:number;cached_input_tokens:number;output_tokens:number;cost_microusd:number;held_microusd:number;average_per_active_user_microusd:number;recorded_run_rate_projection_microusd:number|null}>};
export const getLuna34Operations=(initData?:string)=>request<Luna34Operations>('/api/luna34/admin/metrics',undefined,initData);
export const makeReferralLink=(initData?:string)=>request<ReferralOverview>('/api/luna34/referrals/link',{method:'POST',body:'{}'},initData);
export const finishReferralOnboarding=(initData?:string)=>request<{completed:boolean}>('/api/luna34/referrals/onboarding',{method:'POST',body:JSON.stringify({completed:true})},initData);
export const cancelCommercialSubscription=(chargeId:string,initData?:string)=>request('/api/luna30/commerce/subscriptions/cancel',{method:'POST',body:JSON.stringify({chargeId,confirmed:true})},initData);
export const getMembershipOverview=(initData?:string)=>request<MembershipOverview>('/api/luna34/membership',undefined,initData);
export const createCommercialOrder=(input:{requestId:string;product:string;expectedStars:number;confirmed:true;termsAccepted:true},initData?:string)=>request<{order:{id:string;state:string};invoiceUrl:string|null}>('/api/luna30/commerce/orders',{method:'POST',body:JSON.stringify(input)},initData);
export const getCommercialOrder=(id:string,initData?:string)=>request<{order:{id:string;state:string}}>(`/api/luna30/commerce/orders/${id}`,undefined,initData);

export async function plantMoonGardenElement(elementId: string, initData?: string) {
  return request<{
    planted: boolean;
    elementId: string;
    moonSeedsAvailable: number;
    plantedGardenElements: string[];
    profile: ProfileStats;
  }>('/api/moon-garden/plant', {
    method: 'POST',
    body: JSON.stringify({ elementId })
  }, initData);
}

export type MoonGardenDevAction = 'grant_100' | 'grant_seeds' | 'unlock_full' | 'reset' | 'reset_all' | 'reset_planted' | 'set_balance' | 'set_stage';

export async function updateMoonGardenDevState(input: {
  action: MoonGardenDevAction;
  seedBalance?: number;
  amount?: number;
  stageLevel?: number;
}, initData?: string) {
  return request<{
    ok: boolean;
    moonSeedsAvailable: number;
    moonSeedsEarnedTotal: number;
    plantedGardenElements: string[];
    profile: ProfileStats;
  }>('/api/moon-garden/dev', {
    method: 'POST',
    body: JSON.stringify(input)
  }, initData);
}

export async function recordSceneMoonSeed(input: {
  scene_id: string;
  duration_seconds: number;
  local_date?: string;
}, initData?: string) {
  return request<{ awarded: boolean; moonSeeds: number }>('/api/scene-sessions/moon-seed', {
    method: 'POST',
    body: JSON.stringify(input)
  }, initData);
}

export type InvoiceLinkResult = {
  invoiceLink: string;
  requestId: string;
  amountStars?: number;
  plan: PurchasePlanId;
  sourceField: string;
  rawResponse: unknown;
};

export function createPaymentRequestId() {
  return typeof window !== 'undefined' && window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : `payment-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function invoiceUrlFromResponse(response: unknown) {
  if (!response || typeof response !== 'object') return null;
  const payload = response as Record<string, unknown>;
  const urlFields = ['invoiceLink', 'invoice_url', 'invoice_link', 'url'];
  for (const field of urlFields) {
    if (isValidTelegramInvoiceUrl(payload[field])) return { invoiceLink: payload[field], sourceField: field };
  }
  if (typeof payload.slug === 'string' && payload.slug.trim()) {
    const slug = payload.slug.trim().replace(/^\$+/, '');
    const invoiceLink = `https://t.me/$${slug}`;
    if (isValidTelegramInvoiceUrl(invoiceLink)) return { invoiceLink, sourceField: 'slug' };
  }
  return null;
}

export async function createInvoiceLink(plan: PurchasePlanId, initData?: string, requestId = createPaymentRequestId()): Promise<InvoiceLinkResult> {
  const response = await request<unknown>('/api/payments/invoice-link', {
    method: 'POST',
    headers: { 'x-request-id': requestId },
    body: JSON.stringify({ plan })
  }, initData);

  const normalizedInvoice = invoiceUrlFromResponse(response);
  if (!normalizedInvoice) {
    throw new ApiRequestError('The payment service returned an invalid Telegram invoice link.', `${API_URL}/api/payments/invoice-link`, 502, JSON.stringify(response), requestId);
  }

  const responsePlan = (response as { plan?: unknown })?.plan;
  if (responsePlan !== plan) {
    throw new ApiRequestError('The payment service returned the wrong plan.', `${API_URL}/api/payments/invoice-link`, 502, JSON.stringify(response), requestId);
  }

  return {
    invoiceLink: normalizedInvoice.invoiceLink,
    requestId: typeof (response as { requestId?: unknown }).requestId === 'string'
      ? (response as { requestId: string }).requestId
      : requestId,
    amountStars: (response as { amountStars?: number }).amountStars,
    plan,
    sourceField: normalizedInvoice.sourceField,
    rawResponse: response
  };
}

export type RecentPayment = {
  plan: 'monthly' | 'lifetime';
  amount_stars: number;
  currency: string;
  status: string;
  created_at: string;
};

export async function getRecentSuccessfulPayments(initData?: string) {
  const response = await request<{ payments: RecentPayment[] }>('/api/payments/recent', undefined, initData);
  return response.payments;
}

export function isValidTelegramInvoiceUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;

  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !['t.me', 'telegram.me'].includes(url.hostname.toLowerCase())) return false;
    return /^\/\$(?!$)[^/]+$/.test(url.pathname) || /^\/invoice\/(?!$)[^/]+$/.test(url.pathname);
  } catch {
    return false;
  }
}

export async function completePractice(input: {
  practice_id: string;
  mood_before?: string;
  mood_after?: string;
}, initData?: string) {
  return request('/api/progress', {
    method: 'POST',
    body: JSON.stringify(input)
  }, initData);
}

export async function getTodayCheckin(initData?: string, localDate?: string): Promise<DailyCheckin | null> {
  const response = await request<{ checkin: DailyCheckin | null }>(`/api/checkins/today${localDate ? `?local_date=${encodeURIComponent(localDate)}` : ''}`, undefined, initData);
  return response.checkin;
}

export async function saveDailyCheckin(input: DailyCheckinPayload, initData?: string): Promise<DailyCheckin> {
  const response = await request<{ checkin: DailyCheckin }>('/api/checkins', {
    method: 'POST',
    body: JSON.stringify(input)
  }, initData);
  return response.checkin;
}

export async function getWellnessSummary(initData?: string, localDate?: string): Promise<WellnessSummary> {
  return request(`/api/wellness/summary${localDate ? `?local_date=${encodeURIComponent(localDate)}` : ''}`, undefined, initData);
}

export async function getProfile(initData?: string, localDate?: string): Promise<ProfileStats> {
  return request(`/api/profile/me${localDate ? `?local_date=${encodeURIComponent(localDate)}` : ''}`, undefined, initData);
}

export async function getLunaConversations(initData?: string,offset=0) {
  const response = await request<{ conversations: LunaConversationSummary[] }>('/api/luna/conversations'+(offset?`?offset=${offset}`:''), undefined, initData);
  return response.conversations;
}

export async function getLunaHealth(initData?: string) {
  return request<{ available: boolean; enabled: boolean; model: string; errorClass: string | null }>('/api/luna/health', undefined, initData);
}

export async function getLunaConversation(conversationId: string, initData?: string) {
  return request<{ conversation: LunaConversationSummary; messages: LunaMessage[] }>(`/api/luna/conversations/${conversationId}`, undefined, initData);
}

export const getLunaUsage=(initData?:string)=>request<{remaining:number;limit:number;resetAt:string}>('/api/luna/usage',undefined,initData);

export async function sendLunaMessage(input: {
  contextReset?:boolean;
  astrologyConsent?:true;
  mode?:'companion'|'tarot'|'wellbeing'|'meditation'|'astrology'|'dream';
  chartId?:string;
  astrology?:AstrologyChatAttachment;
  readingId?:string;
  conversationId?: string;
  message: string;
  language: AppLanguage;
  requestId: string;
}, initData?: string) {
  return request<{ conversationId: string; message: LunaMessage; duplicate: boolean; remaining: number; resetAt?:string; requestState: 'completed' }>('/api/luna/chat', {
    method: 'POST',
    body: JSON.stringify(input)
  }, initData);
}

export async function deleteLunaConversation(conversationId: string, initData?: string) {
  return request<{ ok: true }>(`/api/luna/conversations/${conversationId}`, { method: 'DELETE' }, initData);
}

export async function renameLunaConversation(id:string,title:string,initData?:string){return request<{id:string;title:string}>(`/api/luna/tools/conversations/${id}`,{method:'PATCH',body:JSON.stringify({title})},initData);}
export async function openLunaTarot(input:{clientReadingId:string;conversationId?:string;kind:'single'|'three'|'five';intention:'general'|'love'|'career'|'growth';question:string;language:AppLanguage},initData?:string){return request<{conversationId:string;message:LunaMessage}>('/api/luna/tools/tarot',{method:'POST',body:JSON.stringify(input)},initData);}
export async function revealLunaTarot(id:string,index:number,initData?:string){return request<{conversationId:string;message:LunaMessage}>(`/api/luna/tools/tarot/${id}/reveal`,{method:'POST',body:JSON.stringify({index})},initData);}
export async function attachSavedLunaTarot(readingId:string,initData?:string,conversationId?:string){return request<{conversationId:string;message:LunaMessage}>('/api/luna/tools/tarot/attach',{method:'POST',body:JSON.stringify({readingId,...(conversationId?{conversationId}:{})})},initData);}
export const resetLunaContext=(conversationId:string,requestId:string,language:AppLanguage,initData?:string)=>request<{message:LunaMessage}>(`/api/luna/tools/conversations/${conversationId}/context-reset`,{method:'POST',body:JSON.stringify({requestId,language})},initData);

export async function clearLunaConversations(initData?: string) {
  return request<{ ok: true }>('/api/luna/conversations', { method: 'DELETE' }, initData);
}

export async function getLunaMemory(initData?: string) {
  return request<{ enabled: boolean; available: boolean; memories: LunaMemory[] }>('/api/luna/memory', undefined, initData);
}

export async function setLunaMemoryEnabled(enabled: boolean, initData?: string) {
  return request<{ ok: true; enabled: boolean }>('/api/luna/memory', { method: 'PATCH', body: JSON.stringify({ enabled }) }, initData);
}

export async function deleteLunaMemory(memoryId: string, initData?: string) {
  return request<{ ok: true }>(`/api/luna/memory/${memoryId}`, { method: 'DELETE' }, initData);
}

export async function clearLunaMemory(initData?: string) {
  return request<{ ok: true }>('/api/luna/memory', { method: 'DELETE' }, initData);
}

export async function updateUserLanguage(language: AppLanguage, initData?: string) {
  return request<{ user: unknown }>('/api/profile/language', {
    method: 'POST',
    body: JSON.stringify({ language })
  }, initData);
}

export const getLanguagePreference=(initData?:string)=>request<import('./localization/languagePreference').LanguagePreference>('/api/profile/language-preference',undefined,initData);
export const getAdmin40Session=(initData?:string)=>request<import('./admin/types').Admin40Session>('/api/admin/v4/session',undefined,initData);
export const admin40Request=<T,>(path:string,initData?:string,body?:unknown)=>request<T>('/api/admin/v4'+path,body===undefined?undefined:{method:'POST',body:JSON.stringify(body)},initData);
export const uploadAdmin40Media=(file:File,initData?:string)=>request<{publicUrl:string;bytes:number}>('/api/admin/v4/media',{method:'POST',headers:{'Content-Type':file.type==='audio/mp3'?'audio/mpeg':file.type},body:file},initData);
export const getAdmin40Overview=(period:{from:string;to:string},initData?:string)=>request<import('./admin/types').Admin40Overview>('/api/admin/v4/overview?'+new URLSearchParams(period),undefined,initData);
export const getAdmin40Users=(filters:{search:string;page:number;size:number;sort:string;plan:string},initData?:string)=>request<import('./admin/types').Admin40Users>('/api/admin/v4/users?'+new URLSearchParams(Object.fromEntries(Object.entries(filters).map(([k,v])=>[k,String(v)]))),undefined,initData);
export type MeditationActionOrigin={messageId:string;referenceId:string};
export const acknowledgeLunaAction=(value:MeditationActionOrigin&{event:'meditation_card_rendered'|'player_opened'|'playback_started'},initData?:string)=>request<{acknowledged:boolean}>('/api/luna/actions/ack',{method:'POST',body:JSON.stringify(value)},initData);
export const acknowledgeLunaNavigation=(value:{messageId:string;referenceId:string;destination:string;event:'screen_opened'},initData?:string)=>request<{acknowledged:boolean}>('/api/luna/actions/ack',{method:'POST',body:JSON.stringify(value)},initData);
export const setLanguagePreference=(value:{mode:import('./localization/languagePreference').LanguageMode;expectedRevision:number;requestId:string},initData?:string)=>request<import('./localization/languagePreference').LanguagePreference&{conflict?:boolean}>('/api/profile/language-preference',{method:'PUT',body:JSON.stringify(value)},initData);

export async function updateProfileGoals(goals: string[], initData?: string) {
  return request<{ user: { profile_goals: string[] } }>('/api/profile/goals', {
    method: 'POST',
    body: JSON.stringify({ goals })
  }, initData);
}

export async function updateNotificationPreferences(preferences: NotificationPreferences, initData?: string) {
  return request<{ user: { notification_preferences: NotificationPreferences } }>('/api/profile/notifications', {
    method: 'POST',
    body: JSON.stringify(preferences)
  }, initData);
}

export async function getPlans() {
  return request<{ plans: PlanCatalog }>('/api/plans');
}

export async function submitSupportRequest(input: {
  category: SupportCategory;
  message: string;
  contact?: string;
  appVersion?: string;
  buildSha?: string;
  platform?: string;
}, initData?: string) {
  return request<{ request: { id: string; category: SupportCategory; status: SupportStatus; created_at: string } }>('/api/support', {
    method: 'POST',
    body: JSON.stringify(input)
  }, initData);
}

export async function getAdminSupportRequests(initData?: string) {
  return request<{ requests: AdminSupportRequest[] }>('/api/admin/support', undefined, initData);
}

export async function updateAdminSupportRequestStatus(id: string, status: SupportStatus, initData?: string) {
  return request<{ request: Pick<AdminSupportRequest, 'id' | 'status' | 'updated_at'> }>(`/api/admin/support/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  }, initData);
}

export async function removeProfileAvatar(initData?: string) {
  return request<{ user: { avatar_url?: string | null } }>('/api/profile/avatar', { method: 'DELETE' }, initData);
}

export async function checkAdmin(initData?: string) {
  if(String(import.meta.env.VITE_FEATURE_ADMIN_V4??'').toLowerCase()==='true'){await getAdmin40Session(initData);return{admin:true};}
  return request<{ admin: boolean }>('/api/admin/me', undefined, initData);
}

export type AdminDebugInfo = {
  telegramUserId: number | null;
  adminTelegramId: number | null;
  isAdmin: boolean;
  authenticationStatus: string;
  authenticationError: string | null;
  apiBaseUrl?: string;
  configuredApiUrl?: string | null;
  requestUrl?: string | null;
  httpStatus?: number | null;
  responseBody?: string | null;
};

export async function getAdminDebug(initData?: string) {
  return request<AdminDebugInfo>('/api/debug/admin', undefined, initData);
}

export type BackendVersion = {
  commitSha: string;
  buildTimestamp: string;
  environment: string;
  serviceName: string;
  apiVersion: string;
  aiChatEnabled: boolean;
  aiModel: string;
  featureFlags: {
    new_navigation: boolean;
    tarot_daily: boolean;
    tarot_spreads: boolean;
    astrology: boolean;
    moon_seeds_wallet_v2: boolean;
    moon_seeds_purchases: boolean;
    breathwork_audio: boolean;
  };
};

export async function getBackendVersion(initData?: string) {
  return request<BackendVersion>('/api/version', undefined, initData);
}

export type ClientEventName =
  | 'payment_button_clicked'
  | 'invoice_request_started'
  | 'invoice_response_received'
  | 'invoice_url_validated'
  | 'open_invoice_available'
  | 'open_invoice_called'
  | 'open_invoice_callback'
  | 'open_invoice_exception'
  | 'payment_timeout'
  | 'payment_failed'
  | 'entitlement_refresh_started'
  | 'entitlement_refresh_completed'
  | 'luna_message_sent'
  | 'pending_state_loaded'
  | 'pending_state_value'
  | 'model_request_started'
  | 'model_result_received'
  | 'resolved_intent'
  | 'resolved_meditation_id'
  | 'card_action_generated'
  | 'card_render_attempted'
  | 'card_render_success'
  | 'card_render_failed'
  | 'duplicate_reply_blocked';

export async function sendClientEvent(event: ClientEventName, details: Record<string, unknown>, initData?: string) {
  return request<{ ok: true }>('/api/client-events', {
    method: 'POST',
    body: JSON.stringify({ event, ...details })
  }, initData);
}

export type AdminUser = {
  telegram_id: number;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  created_at: string;
  last_seen_at: string;
  active_until?: string | null;
  lifetime_access: boolean;
  premiumStatus: 'free' | 'monthly' | 'lifetime' | 'expired';
  totalMinutesListened: number;
  completedMeditations: number;
  currentStreak: number;
  longestStreak: number;
  totalStars: number;
};

export type AdminPayment = {
  telegram_id: number;
  plan: 'monthly' | 'lifetime';
  amount_stars: number;
  status: string;
  created_at: string;
  expiryDate?: string | null;
  user?: {
    username?: string | null;
    first_name?: string | null;
  } | null;
};

export type AdminMeditationStat = {
  id: string;
  title: string;
  category: string;
  premium: boolean;
  published: boolean;
  play_count: number;
  duration: number;
  created_at: string;
  updated_at: string;
  completionRate: number;
  listeningMinutes: number;
};

export type AdminChartPoint = {
  date: string;
  value: number;
};

export type AdminDashboardData = {
  users: {
    totalRegistered: number;
    newToday: number;
    newThisWeek: number;
    activeToday: number;
    activeThisMonth: number;
  };
  subscriptions: {
    freeUsers: number;
    monthlySubscribers: number;
    lifetimeSubscribers: number;
    activePremiumUsers: number;
    expiredPremiumUsers: number;
  };
  revenue: {
    totalStars: number;
    todayStars: number;
    monthStars: number;
    revenueByPlan: { monthly: number; lifetime: number };
    averageRevenuePerPayingUser: number;
    conversionRate: number;
    latestPurchases: AdminPayment[];
  };
  meditations: {
    total: number;
    published: number;
    drafts: number;
    mostPlayed: AdminMeditationStat | null;
    totalListeningMinutes: number;
    averageCompletionRate: number;
    items: AdminMeditationStat[];
  };
  topUsers: {
    topListeners: AdminUser[];
    longestStreaks: AdminUser[];
    mostCompleted: AdminUser[];
  };
  recentActivity: {
    latestRegistrations: AdminUser[];
    latestPurchases: AdminPayment[];
    latestMeditationPlays: Array<{
      telegram_id: number;
      last_played: string;
      play_count: number;
      completion_percent: number;
      user?: { username?: string | null; first_name?: string | null } | null;
      meditation?: { title?: string | null } | null;
    }>;
    latestCheckins: Array<DailyCheckin & {
      user?: { username?: string | null; first_name?: string | null } | null;
    }>;
    latestAdminUploads: AdminMeditationStat[];
  };
  wellness?: {
    totalCheckins: number;
    checkinsToday: number;
    checkinsThisWeek: number;
    mostCommonMood: DailyCheckin['mood'] | null;
    mostCommonMoodLabel: string;
    averageSleepLabel: string;
    mostRequestedDuration: DailyCheckin['available_minutes'] | null;
    latestCheckins: Array<DailyCheckin & {
      user?: { username?: string | null; first_name?: string | null } | null;
    }>;
  };
  charts: {
    registrationsByDay: AdminChartPoint[];
    purchasesByDay: AdminChartPoint[];
    revenueByDay: AdminChartPoint[];
    listeningMinutesByDay: AdminChartPoint[];
    meditationPlaysByDay: AdminChartPoint[];
  };
  usersList: AdminUser[];
  subscriptionsList: AdminUser[];
  purchaseHistory: AdminPayment[];
};

export async function getAdminDashboard(initData?: string) {
  return request<AdminDashboardData>('/api/admin/dashboard', undefined, initData);
}

export async function updateAdminUserAccess(telegramId: number, action: 'grant_monthly' | 'grant_lifetime' | 'extend_monthly' | 'remove_premium', initData?: string) {
  return request<{ user: unknown }>(`/api/admin/users/${telegramId}/access`, {
    method: 'POST',
    body: JSON.stringify({ action })
  }, initData);
}

export async function getAdminMeditations(initData?: string): Promise<Meditation[]> {
  const response = await request<{ meditations: Meditation[] }>('/api/admin/meditations', undefined, initData);
  return response.meditations;
}

export async function uploadAdminAsset(
  kind: 'audio' | 'cover',
  file: File,
  initData?: string,
  onProgress?: (progress: number) => void
) {
  return new Promise<{ path: string; publicUrl: string }>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', `${API_URL}/api/admin/storage/${kind}`);
    request.setRequestHeader('content-type', file.type);
    request.setRequestHeader('x-file-name', file.name);

    for (const [key, value] of Object.entries(telegramHeaders(initData))) {
      request.setRequestHeader(key, value);
    }

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };

    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        resolve(JSON.parse(request.responseText) as { path: string; publicUrl: string });
        return;
      }

      try {
        const parsed = JSON.parse(request.responseText) as { error?: string };
        reject(new Error(parsed.error || `Upload failed: ${request.status}`));
      } catch {
        reject(new Error(`Upload failed: ${request.status}`));
      }
    };

    request.onerror = () => reject(new Error('Upload failed. Please check your connection and try again.'));
    request.send(file);
  });
}

export async function uploadProfileAvatar(
  file: Blob,
  initData?: string,
  onProgress?: (progress: number) => void
) {
  return new Promise<{ avatarUrl: string }>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', `${API_URL}/api/profile/avatar`);
    request.setRequestHeader('content-type', file.type || 'image/webp');
    request.setRequestHeader('x-file-name', 'avatar.webp');

    for (const [key, value] of Object.entries(telegramHeaders(initData))) {
      request.setRequestHeader(key, value);
    }

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };

    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        const parsed = JSON.parse(request.responseText) as { avatarUrl: string };
        resolve(parsed);
        return;
      }

      try {
        const parsed = JSON.parse(request.responseText) as { error?: string };
        reject(new Error(parsed.error || `Upload failed: ${request.status}`));
      } catch {
        reject(new Error(`Upload failed: ${request.status}`));
      }
    };

    request.onerror = () => reject(new Error('Upload failed. Please check your connection and try again.'));
    request.send(file);
  });
}

export async function createMeditation(input: MeditationPayload, initData?: string) {
  return request<{ meditation: Meditation }>('/api/admin/meditations', {
    method: 'POST',
    body: JSON.stringify(input)
  }, initData);
}

export async function updateMeditation(id: string, input: Partial<MeditationPayload>, initData?: string) {
  return request<{ meditation: Meditation }>(`/api/admin/meditations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input)
  }, initData);
}

export async function deleteMeditation(id: string, initData?: string) {
  return request<{ ok: boolean }>(`/api/admin/meditations/${id}`, { method: 'DELETE' }, initData);
}

export async function saveCategory(input: { name: string; slug: string; sort_order?: number }, initData?: string) {
  return request<{ category: Category }>('/api/admin/categories', {
    method: 'POST',
    body: JSON.stringify(input)
  }, initData);
}
