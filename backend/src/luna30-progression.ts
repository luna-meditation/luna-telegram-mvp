/** Additive v3 projection. Never rewrites the permanent legacy rank or earned achievement rows. */
export const luna30StatusCatalog=[
 {id:'seeker',names:{en:'Seeker',ru:'Искатель'},days:1,moments:1,directions:1},
 {id:'observer',names:{en:'Observer',ru:'Наблюдатель'},days:3,moments:4,directions:1},
 {id:'explorer',names:{en:'Explorer',ru:'Исследователь'},days:7,moments:10,directions:2},
 {id:'wanderer',names:{en:'Wanderer',ru:'Странник'},days:14,moments:20,directions:2},
 {id:'guardian',names:{en:'Guardian',ru:'Хранитель'},days:21,moments:35,directions:2},
 {id:'contemplator',names:{en:'Contemplator',ru:'Созерцатель'},days:30,moments:50,directions:3},
 {id:'guide',names:{en:'Guide',ru:'Проводник'},days:45,moments:75,directions:3},
 {id:'alchemist',names:{en:'Alchemist',ru:'Алхимик'},days:60,moments:100,directions:3},
 {id:'sage',names:{en:'Sage',ru:'Мудрец'},days:90,moments:150,directions:3},
 {id:'constellation',names:{en:'Constellation',ru:'Созвездие'},days:120,moments:200,directions:3}
] as const;
export type Luna30ProgressInput={meaningfulDays:number;meditations:number;breathwork:number;tarot:number;reflections:number;conversations:number};
const count=(n:number)=>Number.isSafeInteger(n)&&n>0?n:0;
export function buildLuna30Progress(input:Luna30ProgressInput,legacyRank=-1){
 const activity={meditations:count(input.meditations),breathwork:count(input.breathwork),tarot:count(input.tarot),reflections:count(input.reflections),conversations:count(input.conversations)},metrics={days:count(input.meaningfulDays),moments:Object.values(activity).reduce((a,b)=>a+b,0),directions:Object.values(activity).filter(v=>v>0).length};
 let eligible=-1;for(let i=0;i<luna30StatusCatalog.length;i++){const r=luna30StatusCatalog[i];if(metrics.days>=r.days&&metrics.moments>=r.moments&&metrics.directions>=r.directions)eligible=i;else break;}
 const grandfathered=Math.max(-1,Math.min(9,Number.isSafeInteger(legacyRank)?legacyRank:-1)),rank=Math.max(eligible,grandfathered),next=luna30StatusCatalog[rank+1];
 return {version:3 as const,rank,eligibleRank:eligible,current:rank>=0?luna30StatusCatalog[rank]:null,grandfathered:grandfathered>eligible,metrics,next:next?{...next,progressPercent:Math.floor(Math.min(1,metrics.days/next.days,metrics.moments/next.moments,metrics.directions/next.directions)*100),remaining:{days:Math.max(0,next.days-metrics.days),moments:Math.max(0,next.moments-metrics.moments),directions:Math.max(0,next.directions-metrics.directions)}}:null};
}
export const luna30AchievementCategories={first_discoveries:{en:'First discoveries',ru:'Первые открытия'},tarot:{en:'Tarot',ru:'Таро'},astrology:{en:'Astrology',ru:'Астрология'},self_discovery:{en:'Self-discovery',ru:'Самопознание'},inner_harmony:{en:'Meditation & breathwork',ru:'Медитации и дыхание'},consistency:{en:'Consistency',ru:'Постоянство'},community:{en:'Community & invitations',ru:'Сообщество и приглашения'},celestial_journey:{en:'Moon Garden',ru:'Лунный сад'}};
// Stable existing IDs remain intact. Legacy entries not featured in v3 remain in the archive.
export const luna30FeaturedAchievements=[
 'astrology_first_chart','astrology_two_perspectives','first_confirmed_memory','first_breathwork',
 'first_meditation','first_checkin','first_luna_conversation','tarot_first_reading',
 'three_meditations','seven_checkins','thirty_checkins','one_hundred_checkins',
 'tarot_seven_daily_cards','tarot_ten_readings','moon_garden_level_3','moon_garden_level_5','moon_garden_level_7',
 'morning_practice','evening_practice','deep_sleep_explorer','anxiety_companion','focus_builder','calm_explorer','hundred_minutes',
 'first_week','first_month','seven_day_rhythm','fourteen_day_rhythm','thirty_day_rhythm','sixty_day_rhythm','hundred_day_rhythm','one_year_together'
] as const;
export function projectLuna30Achievements<T extends {id:string;unlocked:boolean;unlockedAt?:string|null}>(items:T[]){
 const selected=new Set<string>(luna30FeaturedAchievements);return {featured:items.filter(i=>selected.has(i.id)).sort((a,b)=>Number(b.unlocked)-Number(a.unlocked)),legacyArchive:items.filter(i=>!selected.has(i.id)),preservedUnlockedIds:items.filter(i=>i.unlocked).map(i=>i.id)};
}
export function luna30AchievementFamily(item:{id:string;category?:string}){
 if(item.id.startsWith('astrology_'))return 'astrology';
 if(item.id==='first_confirmed_memory')return 'self_discovery';
 if(item.id.startsWith('referral_'))return 'community';
 if(item.category==='rhythm')return 'consistency';
 if(['first_meditation','first_checkin','first_luna_conversation','tarot_first_reading'].includes(item.id))return 'first_discoveries';
 if(item.category==='garden')return 'celestial_journey';
 if(item.id.startsWith('tarot_'))return 'tarot';
 if(item.id.includes('checkin'))return 'self_discovery';
 return 'inner_harmony';
}
