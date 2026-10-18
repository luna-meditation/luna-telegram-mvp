import serverless from 'serverless-http';

const stagingSiteId = 'a634a7fc-1ecb-47fa-8b43-edd81a7e3694';
declare const Netlify: {env: {get(name:string):string|undefined}} | undefined;
type StagingContext = {site?: {id?: string}; ip?: string; requestId?: string};
type LambdaResult = {statusCode: number; body: string; isBase64Encoded?: boolean; headers?: Record<string,string|number|boolean>; multiValueHeaders?: Record<string,string[]>};
let adapter: ReturnType<typeof serverless> | undefined;

// Modern Netlify Functions expose server configuration through Netlify.env.
// Bridge an explicit allowlist before importing config.ts; never export values.
const runtimeKeys = [
  'BOT_TOKEN','BOT_USERNAME','MINI_APP_URL','FRONTEND_ORIGIN',
  'SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','OPENAI_API_KEY',
  'STAGING_MODE','STAGING_HOST','STAGING_SETUP_QA_BOT','STAGING_SUPABASE_PROJECT_REF','STAGING_TELEGRAM_IDS','STAGING_VOICE_QA_GRANT_ID',
  'RUN_MIGRATIONS','ALLOW_UNVERIFIED_TELEGRAM_WEBAPP','REMINDER_SCHEDULER_ENABLED',
  'FEATURE_GARDEN_ATOMIC','FEATURE_PERSONALIZATION','FEATURE_PERSONAL_MEMORY','FEATURE_AI_MODES',
  'FEATURE_ADMIN_V4','FEATURE_ADMIN_V4_MUTATIONS','FEATURE_COSMOS_V2','FEATURE_AI_VOICE_INPUT',
  'FEATURE_AI_CENTRAL_EXPERIENCE','FEATURE_TAROT_SPREAD_AI_QA',
  'STAGING_TAROT_AI_QA_OWNER_ID','STAGING_TAROT_AI_QA_GRANT_ID',
  'FEATURE_TAROT_HISTORY','FEATURE_TAROT_AI','FEATURE_DAILY_CARD_V2','FEATURE_ECONOMY_REWARDS_V2',
  'FEATURE_TAROT_PAID_READINGS','FEATURE_PREMIUM_V2','FEATURE_PAYMENT_ATOMIC',
  'FEATURE_NEW_NAVIGATION','FEATURE_TAROT_DAILY','FEATURE_TAROT_SPREADS','FEATURE_ASTROLOGY',
  'FEATURE_MOON_SEEDS_WALLET_V2','FEATURE_MOON_SEEDS_PURCHASES','FEATURE_BREATHWORK_AUDIO','FEATURE_BREATHWORK_GUIDED',
  'LUNA30_REFERRALS_ENABLED','LUNA30_REFERRAL_REWARDS_ENABLED','LUNA30_PROGRESSION_ENABLED',
  'LUNA30_ASTROLOGY_AI_ENABLED',
  'LUNA30_PREMIUM_ENTITLEMENTS_ENABLED','LUNA30_PREMIUM_ENABLED','LUNA30_ANNUAL_ENABLED','LUNA30_SEED_PACKAGES_ENABLED','LUNA30_SUPPORT_ENABLED','LUNA30_PAID_COMPATIBILITY_ENABLED','LUNA30_MONTHLY_QUOTAS_ENABLED',
  'LUNA34_COMMERCIAL_ENABLED','LUNA34_COMMERCIAL_QUOTAS_ENABLED','LUNA34_REFERRALS_ENABLED','ADMIN_TELEGRAM_ID',
  'AI_CHAT_MODEL','AI_CHAT_ENABLED','AI_MEMORY_ENABLED','AI_MAX_MESSAGES_PER_DAY',
  'FEATURE_LUNA_INTELLIGENCE','AI_PROMPT_VERSION',
  'AI_PREMIUM_MAX_MESSAGES_PER_DAY','AI_MAX_OUTPUT_TOKENS','AI_REASONING_EFFORT','AI_REQUEST_TIMEOUT_MS',
  'LUNA32_ENABLED','AI_STRUCTURED_MAX_OUTPUT_TOKENS',
  'TAROT_AI_DAILY_LIMIT','TAROT_AI_GLOBAL_DAILY_LIMIT','TAROT_AI_MAX_OUTPUT_TOKENS','COMMIT_SHA'
] as const;
function loadRuntimeConfiguration() {
  // Netlify injects a module-scoped runtime binding, not globalThis.Netlify.
  const runtime = typeof Netlify === 'undefined' ? undefined : Netlify;
  if (!runtime?.env) return;
  for (const key of runtimeKeys) {
    const value = runtime.env.get(key);
    if (value !== undefined) process.env[key] = value;
  }
}

async function boundedBody(request: Request,maximum=128*1024) {
  if (!request.body) return Buffer.alloc(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const {done,value} = await reader.read();
      if (done) return Buffer.concat(chunks);
      length += value.length;
      if (length > maximum) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {reader.releaseLock();}
}

/** Only the separate QA site may load this adapter; data APIs enforce Telegram auth. */
export async function netlifyStagingHandler(request: Request, context: StagingContext) {
  if (context.site?.id !== stagingSiteId) {
    return Response.json({code:'staging_host_denied'},{status:403,headers:{'Cache-Control':'private, no-store'}});
  }
  loadRuntimeConfiguration();
  if (context.site?.id !== stagingSiteId || process.env.STAGING_MODE !== 'true' || process.env.STAGING_HOST !== 'netlify') {
    return Response.json({code:'staging_host_denied'},{status:403,headers:{'Cache-Control':'private, no-store'}});
  }
  const url = new URL(request.url);
  const functionPrefix = '/.netlify/functions/luna-staging';
  const path = url.pathname.startsWith(`${functionPrefix}/`) ? url.pathname.slice(functionPrefix.length) : url.pathname;
  if (path !== '/health' && path !== '/api' && !path.startsWith('/api/') && !path.startsWith('/telegram/')) {
    return Response.json({code:'not_found'},{status:404,headers:{'Cache-Control':'private, no-store'}});
  }
  const body = await boundedBody(request,path==='/api/admin/v4/media'?4*1024*1024:/^\/api\/luna\/voice\/[a-f0-9-]{36}$/.test(path)?1450*1024:128*1024);
  if (!body) return Response.json({code:'request_too_large'},{status:413});
  if (!adapter) {
    try {
      const {app} = await import('./server.js');
      adapter = serverless(app);
    } catch {
      // No public deployment diagnostics or configuration details.
      return Response.json({code:'staging_startup_failed'},{status:503,headers:{'Cache-Control':'private, no-store'}});
    }
  }
  // A finite operator test temporarily enables the existing staging budget.
  // Keep public QA API generations closed for its whole window (including an
  // interrupted worker). The worker calls owner-bound services directly with
  // synthetic identities. Production never imports this adapter.
  if(request.method==='POST'&&process.env.FEATURE_LUNA_INTELLIGENCE==='true'&&(/^\/api\/luna\/(?:messages|chat|voice)/.test(path)||/^\/api\/(?:tarot|astrology)\/.+(?:generate|interpret|reveal|report)/.test(path)||/^\/api\/luna43\/.+generate/.test(path))){
    const {supabase}=await import('./db.js');const window=await supabase.from('luna30_qa_report_runs').select('result').eq('run_name','luna-intelligence-1-0-20261018-v1').maybeSingle();
    if(window.error||window.data?.result?.providerWindowOpen)return Response.json({code:'qa_validation_in_progress'},{status:503,headers:{'Cache-Control':'private, no-store'}});
  }
  const query: Record<string,string[]> = {};
  for (const [key,value] of url.searchParams) (query[key] ??= []).push(value);
  const event = {
    path,httpMethod:request.method,
    headers:Object.fromEntries(request.headers),
    multiValueQueryStringParameters:query,
    body:body.toString('base64'),isBase64Encoded:true,
    requestContext:{identity:{sourceIp:context.ip ?? ''},requestId:context.requestId}
  };
  const result = await adapter(event,{}) as LambdaResult;
  const headers = new Headers();
  for (const [key,value] of Object.entries(result.headers ?? {})) headers.set(key,String(value));
  for (const [key,values] of Object.entries(result.multiValueHeaders ?? {})) {
    headers.delete(key);
    for (const value of values) headers.append(key,value);
  }
  const output = result.isBase64Encoded ? Buffer.from(result.body,'base64') : result.body;
  return new Response(request.method === 'HEAD' || [204,304].includes(result.statusCode) ? null : output,{status:result.statusCode,headers});
}
