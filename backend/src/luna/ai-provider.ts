import{env}from'../config.js';
import {createLunaResponseTransport} from './response-transport.js';
export {responseOutputText} from './response-transport.js';
/** Shared server-only transport. No implicit retries or frontend credentials. */
export const requestLunaResponse=createLunaResponseTransport(()=>env.OPENAI_API_KEY);
