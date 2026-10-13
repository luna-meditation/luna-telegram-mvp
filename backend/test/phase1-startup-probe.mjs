import assert from 'node:assert/strict';
assert.equal(process.env.PHASE1_ISOLATED_REVIEW,'true');
assert.equal(new URL(process.env.SUPABASE_URL).hostname,'127.0.0.1');
const {bot}=await import('../src/bot.ts');
bot.telegram.callApi=async(method)=>{
  assert.ok(['setMyCommands','setWebhook'].includes(method),`Unexpected Telegram call: ${method}`);
  return true;
};
await import('../src/server.ts');
