import{env}from'../config.js';
import {createLunaResponseTransport} from './response-transport.js';
import {guardedProviderTransport} from '../luna32-ai-accounting.js';
export {responseOutputText} from './response-transport.js';
/** Shared server-only transport. No implicit retries or frontend credentials. */
export const requestLunaResponse=guardedProviderTransport(createLunaResponseTransport(()=>env.OPENAI_API_KEY));
