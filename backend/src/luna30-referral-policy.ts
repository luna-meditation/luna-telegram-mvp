import {randomBytes} from 'node:crypto';
export const referralPrefix='ref_';
export function createReferralCode(){return randomBytes(18).toString('base64url');}
export function signedReferralCode(startParam:string|undefined){const match=startParam?.match(/^ref_([A-Za-z0-9_-]{24})$/);return match?.[1]??null;}
export function referralLink(botUsername:string,code:string){if(!/^[A-Za-z0-9_]{5,32}$/.test(botUsername)||!signedReferralCode(referralPrefix+code))throw new Error('Invalid referral link');return `https://t.me/${botUsername}?startapp=${referralPrefix}${code}`;}
/** A link/open/check-in is not enough. Only the first server-verified 90% meditation qualifies. */
export const referralQualification='first_verified_meditation_90_percent';
