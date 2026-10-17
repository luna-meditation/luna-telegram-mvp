import {randomBytes} from 'node:crypto';
import {parseLaunchDestination,miniAppLink,type LaunchDestination} from './luna35-launch.js';
export const referralPrefix='ref_';
export function createReferralCode(){return randomBytes(18).toString('base64url');}
export function signedReferralCode(startParam:string|undefined){return startParam?.startsWith('ref_')?parseLaunchDestination(startParam).referral:null;}
export function referralLink(botUsername:string,code:string,destination?:LaunchDestination){if(destination)return miniAppLink(botUsername,destination,code);if(!/^[A-Za-z0-9_]{5,32}$/.test(botUsername)||!signedReferralCode(referralPrefix+code))throw new Error('Invalid referral link');return `https://t.me/${botUsername}?startapp=${referralPrefix}${code}`;}
/** A link/open/check-in is not enough. Only the first server-verified 90% meditation qualifies. */
export const referralQualification='first_verified_meditation_90_percent';
