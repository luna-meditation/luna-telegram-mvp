import serverless from 'serverless-http';

const stagingSiteId = 'a634a7fc-1ecb-47fa-8b43-edd81a7e3694';
type StagingContext = {site?: {id?: string}; ip?: string; requestId?: string};
type LambdaResult = {statusCode: number; body: string; isBase64Encoded?: boolean; headers?: Record<string,string|number|boolean>; multiValueHeaders?: Record<string,string[]>};
let adapter: ReturnType<typeof serverless> | undefined;

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

/** Only this separate private Netlify site may load the existing Express backend. */
export async function netlifyStagingHandler(request: Request, context: StagingContext) {
  if (context.site?.id !== stagingSiteId || process.env.STAGING_MODE !== 'true' || process.env.STAGING_HOST !== 'netlify') {
    if(typeof request.url==='string' && new URL(request.url).searchParams.get('report')==='true') {
      const checks={siteMatched:context.site?.id===stagingSiteId,stagingMode:process.env.STAGING_MODE==='true',netlifyHost:process.env.STAGING_HOST==='netlify'};
      return new Response(`<html><title>Luna staging boundary check</title><h1>Staging boundary check</h1><pre>${JSON.stringify(checks,null,2)}</pre></html>`,{status:403,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store'}});
    }
    return Response.json({code:'staging_host_denied'},{status:403,headers:{'Cache-Control':'private, no-store'}});
  }
  const body = await boundedBody(request);
  if (!body) return Response.json({code:'request_too_large'},{status:413});
  if (!adapter) {
    try {
      const {app} = await import('./server.js');
      adapter = serverless(app);
    } catch (error) {
      // Diagnostics list variable NAMES only; no values, exception text or stack.
      const failure=error as {name?:string;issues?:Array<{path?:unknown[]}>;code?:string};
      const missingVariables=failure.name==='ZodError'?(failure.issues??[]).map(item=>item.path?.[0]).filter(item=>typeof item==='string'&&/^[A-Z_]{1,80}$/.test(item)):[];
      const report={code:'staging_startup_failed',missingVariables};
      if(new URL(request.url).searchParams.get('report')==='true') {
        return new Response(`<html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Luna staging startup check</title><h1>Staging startup check</h1><pre>${JSON.stringify(report,null,2)}</pre></html>`,{status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store'}});
      }
      return Response.json(report,{status:503,headers:{'Cache-Control':'private, no-store'}});
    }
  }
  const url = new URL(request.url);
  const functionPrefix = '/.netlify/functions/luna-staging';
  const path = url.pathname.startsWith(`${functionPrefix}/`) ? url.pathname.slice(functionPrefix.length) : url.pathname;
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
