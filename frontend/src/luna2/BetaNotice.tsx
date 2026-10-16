import type {AccessState,AppLanguage} from '../api';
export function BetaNotice({access,language}:{access:AccessState;language:AppLanguage}){
 if(!access.beta?.active)return null;
 return <aside className="luna32-beta-notice"><strong>Public Beta</strong><p>{language==='en'?'Implemented discovery features are temporarily included, within your daily AI allowance. No Moon Seeds or Stars are charged for these beta features. Existing paid rights are preserved; beta never renews into a paid subscription.':'Доступные функции самопознания временно включены в доступ с вашей дневной AI-квотой. За эти beta-функции Moon Seeds и Stars не списываются. Купленные права сохранены; beta не превращается в платную подписку.'}</p>{access.beta.expiresAt&&<small>{language==='en'?'Promotional access through ':'Промо-доступ до '}{new Intl.DateTimeFormat(language==='en'?'en-GB':'ru-RU',{dateStyle:'medium'}).format(new Date(access.beta.expiresAt))}</small>}</aside>;
}
