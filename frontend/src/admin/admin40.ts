export const admin40Enabled=String(import.meta.env.VITE_FEATURE_ADMIN_V4??'').toLowerCase()==='true';
export type Admin40Section='dashboard'|'users'|'ai'|'content'|'monetization'|'analytics'|'referrals'|'support'|'settings';
export const admin40Navigation:Array<{id:Admin40Section;en:string;ru:string;group:'overview'|'management'|'business'|'intelligence'|'system'}>=[
 {id:'dashboard',en:'Dashboard',ru:'Обзор',group:'overview'},{id:'users',en:'Users',ru:'Пользователи',group:'management'},
 {id:'ai',en:'Luna AI',ru:'Луна ИИ',group:'intelligence'},{id:'content',en:'Content',ru:'Контент',group:'management'},
 {id:'monetization',en:'Monetization',ru:'Монетизация',group:'business'},{id:'analytics',en:'Analytics',ru:'Аналитика',group:'business'},
 {id:'referrals',en:'Referrals',ru:'Приглашения',group:'business'},{id:'support',en:'Support',ru:'Поддержка',group:'management'},
 {id:'settings',en:'Settings',ru:'Настройки',group:'system'}
];
export function adminPeriod(days:number,now=new Date()){const to=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+1)),from=new Date(to.getTime()-days*86400000);return {from:from.toISOString(),to:to.toISOString()};}
export function formatAdminMetric(value:number|null|undefined,language:'en'|'ru',options:Intl.NumberFormatOptions={}){return value==null?'—':new Intl.NumberFormat(language==='ru'?'ru-RU':'en-US',options).format(value);}
