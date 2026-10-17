import {supabase} from './db.js';
import {env} from './config.js';
import {bot} from './bot.js';
import {createLuna30Commerce} from './luna30-commerce.js';
import {createLuna35Commerce} from './luna35-commerce.js';
export function luna35Commerce(usage:(owner:number)=>Promise<{remaining:number;limit:number;resetAt:string}>){return createLuna35Commerce(supabase,env,createLuna30Commerce(supabase,env,value=>bot.telegram.callApi('createInvoiceLink',value)),usage);}
