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
  'STAGING_MODE','STAGING_HOST','STAGING_SETUP_QA_BOT','STAGING_SUPABASE_PROJECT_REF','STAGING_TELEGRAM_IDS',
  'RUN_MIGRATIONS','ALLOW_UNVERIFIED_TELEGRAM_WEBAPP','REMINDER_SCHEDULER_ENABLED',
  'FEATURE_GARDEN_ATOMIC','FEATURE_PERSONALIZATION','FEATURE_PERSONAL_MEMORY','FEATURE_AI_MODES',
  'FEATURE_AI_CENTRAL_EXPERIENCE','FEATURE_TAROT_SPREAD_AI_QA',
  'STAGING_TAROT_AI_QA_OWNER_ID','STAGING_TAROT_AI_QA_GRANT_ID',
  'FEATURE_TAROT_HISTORY','FEATURE_TAROT_AI','FEATURE_DAILY_CARD_V2','FEATURE_ECONOMY_REWARDS_V2',
  'FEATURE_TAROT_PAID_READINGS','FEATURE_PREMIUM_V2','FEATURE_PAYMENT_ATOMIC',
  'FEATURE_NEW_NAVIGATION','FEATURE_TAROT_DAILY','FEATURE_TAROT_SPREADS','FEATURE_ASTROLOGY',
  'FEATURE_MOON_SEEDS_WALLET_V2','FEATURE_MOON_SEEDS_PURCHASES','FEATURE_BREATHWORK_AUDIO',
  'AI_CHAT_MODEL','AI_CHAT_ENABLED','AI_MEMORY_ENABLED','AI_MAX_MESSAGES_PER_DAY',
  'AI_PREMIUM_MAX_MESSAGES_PER_DAY','AI_MAX_OUTPUT_TOKENS','AI_REASONING_EFFORT','AI_REQUEST_TIMEOUT_MS',
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

async function boundedBody(request: Request) {
  if (!request.body) return Buffer.alloc(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const {done,value} = await reader.read();
      if (done) return Buffer.concat(chunks);
      length += value.length;
      if (length > 128 * 1024) {
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
  const body = await boundedBody(request);
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
