/** Public navigation IDs, never record access grants or arbitrary URLs. Both
 * chat tools and the application dispatcher consume this one registry. */
export const lunaDestinations=[
 {id:'home',page:'home',en:'Home',ru:'Главная'},
 {id:'luna',page:'luna',en:'Luna AI',ru:'Луна ИИ'},
 {id:'profile',page:'profile',en:'Profile',ru:'Профиль'},
 {id:'tarot',page:'tarot',feature:'tarot_daily',en:'Tarot',ru:'Таро'},
 {id:'daily',page:'tarot',feature:'tarot_daily',en:'Card of the Day',ru:'Карта дня'},
 {id:'tarot_history',page:'tarot',feature:'tarot_history',tarotScreen:'history',en:'Reading history',ru:'История раскладов'},
 {id:'astrology',page:'astrology',feature:'astrology',en:'Astrology',ru:'Астрология'},
 {id:'natal',page:'astrology',feature:'astrology',astrologySection:'natal',en:'Natal chart',ru:'Натальная карта'},
 {id:'compatibility',page:'astrology',feature:'astrology',astrologySection:'compatibility',en:'Compatibility',ru:'Совместимость'},
 {id:'birth_profiles',page:'astrology',feature:'astrology',astrologySection:'profiles',en:'Birth profiles',ru:'Астропрофили'},
 {id:'meditations',page:'library',en:'Meditations',ru:'Медитации'},
 {id:'breathwork',page:'breathCircle',en:'Breathwork',ru:'Дыхательные практики'},
 {id:'garden',page:'moonGarden',en:'Moon Garden',ru:'Лунный сад'},
 {id:'achievements',page:'achievements',en:'Achievements',ru:'Достижения'},
 {id:'journey',page:'progress',en:'My Journey',ru:'Мой путь'},
 {id:'journal',page:'activity',en:'Journal & activity',ru:'Дневник и активность'},
 {id:'membership',page:'pricing',en:'Membership',ru:'Подписка'},
 {id:'seeds',page:'wallet',en:'Moon Seeds',ru:'Moon Seeds'},
 {id:'cosmos',page:'profile',profileView:'universe',feature:'personal_memory',en:'My Universe',ru:'Мой космос'},
 {id:'meet',page:'profile',profileView:'meet',feature:'personal_memory',en:'Meet Luna',ru:'Познакомиться с Луной'},
 {id:'settings',page:'profile',profileView:'settings',en:'Settings',ru:'Настройки'},
 {id:'language',page:'profile',profileView:'language',en:'Language',ru:'Язык'},
 {id:'support',page:'profile',profileView:'support',en:'Support',ru:'Поддержка'},
 {id:'invite',page:'profile',profileView:'invite',en:'Invite friends',ru:'Пригласить друзей'},
 {id:'terms',page:'profile',profileView:'terms',en:'Terms of use',ru:'Условия использования'}
] as const;
export type LunaDestinationId=typeof lunaDestinations[number]['id'];
export type NavigationAvailability={tarot_daily?:boolean;tarot_history?:boolean;astrology?:boolean;personal_memory?:boolean};
export function resolveLunaDestination(id:unknown,availability:NavigationAvailability){
 if(typeof id!=='string')return null;const item=lunaDestinations.find(d=>d.id===id);
 if(!item||'feature' in item&&availability[item.feature]!==true)return null;return item;
}
export function availableLunaDestinations(language:'en'|'ru',availability:NavigationAvailability){return lunaDestinations.filter(d=>resolveLunaDestination(d.id,availability)).map(d=>({id:d.id,title:d[language]}));}
