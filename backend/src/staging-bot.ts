type QaBotConfig = {STAGING_MODE:boolean;STAGING_HOST:string;STAGING_SETUP_QA_BOT:boolean;BOT_TOKEN:string;BOT_USERNAME:string;MINI_APP_URL:string};
/** Idempotent setup of the new QA bot only. Never messages users or touches a production bot. */
export async function configureQaBotMenu(config:QaBotConfig,transport:typeof fetch=fetch) {
  if (!config.STAGING_MODE || config.STAGING_HOST !== 'netlify' || !config.STAGING_SETUP_QA_BOT ||
      config.BOT_USERNAME !== 'luna_staging_qa_eger_bot' || config.MINI_APP_URL !== 'https://luna-staging-itfl.netlify.app') return false;
  try {
    const base = `https://api.telegram.org/bot${config.BOT_TOKEN}`;
    const identity = await transport(`${base}/getMe`,{signal:AbortSignal.timeout(5000)});
    const user = await identity.json() as {ok?:boolean;result?:{username?:string}};
    if (!identity.ok || !user.ok || user.result?.username !== 'luna_staging_qa_eger_bot') return false;
    const response = await transport(`${base}/setChatMenuButton`,{method:'POST',signal:AbortSignal.timeout(5000),
      headers:{'content-type':'application/json'},body:JSON.stringify({menu_button:{type:'web_app',text:'Open Luna QA',web_app:{url:config.MINI_APP_URL}}})});
    const result = await response.json() as {ok?:boolean};
    return response.ok && result.ok === true;
  } catch {return false;} // Token-bearing request URLs must never enter logs.
}
