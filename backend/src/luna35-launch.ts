/** A route hint, never authentication or permission to read/charge an account.
 * Referral attribution is accepted only from server-verified Telegram initData. */
export const launchDestinations=['home','luna','tarot','daily','astrology','natal','compatibility','meditations','breathwork','membership','seeds','invite','meet','cosmos'] as const;
export type LaunchDestination=typeof launchDestinations[number];
const aliases:Record<string,LaunchDestination>={'luna-ai':'luna',ai:'luna',library:'meditations',saved:'meditations',breathing:'breathwork',premium:'membership',wallet:'seeds','card-of-the-day':'daily',card_of_day:'daily','natal-chart':'natal'};
export function parseLaunchDestination(raw:string){
 if(raw.length>512||raw!==raw.trim()||!/^[-A-Za-z0-9_]*$/.test(raw))return {destination:'home' as LaunchDestination,referral:null};
 const referral=raw.match(/^ref_([A-Za-z0-9_-]{24})(?:__([a-z]+))?$/);
 const hint=referral?referral[2]??'home':raw.toLowerCase();
 const destination=launchDestinations.includes(hint as LaunchDestination)?hint as LaunchDestination:aliases[hint]??'home';
 return {destination,referral:referral?.[1]??null};
}
export function miniAppLink(username:string,destination:LaunchDestination='home',referral?:string){
 const bot=username.replace(/^@/,'');if(!/^[A-Za-z0-9_]{5,32}$/.test(bot))throw new Error('Invalid bot username');
 if(referral&&!/^[A-Za-z0-9_-]{24}$/.test(referral))throw new Error('Invalid referral');
 const payload=referral?`ref_${referral}__${destination}`:destination==='home'?'':destination;
 return `https://t.me/${bot}?startapp${payload?'='+payload:''}`;
}
