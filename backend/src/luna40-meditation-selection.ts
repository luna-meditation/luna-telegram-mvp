import {z} from 'zod';
import {FoundationError} from './foundation-error.js';
import {rankMeditationRecommendation,isVulnerableMessage,isAlternativeRecommendationRequest,formatMeditationDuration,type RecommendationCatalogItem} from './luna-ai-policy.js';

const catalogItem=z.object({
 id:z.string().uuid(),title:z.string().trim().min(1).max(300),
 durationSeconds:z.number().finite().positive().max(24*3600),premium:z.boolean(),
 published:z.boolean().optional(),audioLanguage:z.enum(['en','ru']).optional()
});
export type VerifiedMeditationSelection={id:string;title:string;durationSeconds:number;premium:boolean;audioLanguage?:'en'|'ru';access:'available'|'premium_required'};
const durationWords:Record<string,number>={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,fifteen:15,twenty:20,одна:1,одну:1,один:1,две:2,два:2,три:3,четыре:4,пять:5,шесть:6,семь:7,восемь:8,девять:9,десять:10,пятнадцать:15,двадцать:20};
export function requestedMeditationSeconds(message:string){const words=Object.keys(durationWords).join('|'),match=message.toLocaleLowerCase().match(new RegExp(`(?<!\\p{L})(\\d{1,3}|${words})[ -]*(?:minutes?|mins?|мин(?:ут[ауы]?)?)(?!\\p{L})`,'iu'));if(!match)return null;const minutes=durationWords[match[1]]??Number(match[1]);return Number.isSafeInteger(minutes)&&minutes>0&&minutes<=180?minutes*60:null;}

/** Explicit recommendations reuse the semantic ranker. A missing synonym,
 * generic request or absent exact duration must not become a raw 404 when an
 * actual published practice exists. Fallback is disclosed, never invented. */
export function chooseDirectMeditation(message:string,catalog:Array<RecommendationCatalogItem&{durationSeconds?:number;audioLanguage?:'en'|'ru'}>,language:'en'|'ru',hasPremium:boolean,recentIds:readonly string[]=[]):VerifiedMeditationSelection&{selectionNote?:string}{
 const vulnerable=isVulnerableMessage(message),valid=catalog.filter(item=>{const parsed=catalogItem.safeParse(item);return parsed.success&&parsed.data.published!==false&&(!vulnerable||!item.premium);});
 if(!valid.length)throw new FoundationError(404,'meditation_unavailable','No published practice is currently available.');
 const alternative=isAlternativeRecommendationRequest(message)&&recentIds.length>0,other=alternative?valid.filter(item=>!recentIds.includes(item.id)):valid,choices=other.length?other:valid;
 const preferred=/in english|на английск/iu.test(message)?'en':/in russian|на русск/iu.test(message)?'ru':language,spoken=choices.filter(item=>item.audioLanguage===preferred),localized=spoken.length?spoken:choices;
 const free=localized.filter(item=>!item.premium),available=!hasPremium&&free.length?free:localized,requested=requestedMeditationSeconds(message),timed=requested?available.filter(item=>Math.abs(Number(item.durationSeconds)-requested)<=30):available;
 const pool=timed.length?timed:available,decision=rankMeditationRecommendation({message,catalog:pool,language,forceRecommendation:true,vulnerable});
 const fallback=[...pool].sort((a,b)=>requested?Math.abs(Number(a.durationSeconds)-requested)-Math.abs(Number(b.durationSeconds)-requested)||a.id.localeCompare(b.id):Number(a.durationSeconds)-Number(b.durationSeconds)||a.id.localeCompare(b.id));
 const chosen=selectToolMeditation(decision.meditationId??fallback[0].id,pool,hasPremium),notes:string[]=[];
 if(alternative&&!other.length)notes.push(language==='ru'?'Другой опубликованной практики сейчас нет. Эта карточка остаётся доступной.':'There is no other published practice available right now. This card remains available.');
 if(requested&&!timed.length)notes.push(language==='ru'?`Среди доступных тебе практик нет трека примерно на ${formatMeditationDuration(requested,language)}. Доступный вариант длится ${formatMeditationDuration(chosen.durationSeconds,language)}.`:`There is no roughly ${formatMeditationDuration(requested,language)} track in your available practices. This available option lasts ${formatMeditationDuration(chosen.durationSeconds,language)}.`);
 if(chosen.audioLanguage&&chosen.audioLanguage!==preferred)notes.push(language==='ru'?`Аудио этой практики — ${chosen.audioLanguage==='en'?'на английском':'на русском'}.`:`This practice's audio is in ${chosen.audioLanguage==='en'?'English':'Russian'}.`);
 return {...chosen,...(notes.length?{selectionNote:notes.join(' ')}:{})};
}

/** Only the authenticated server's published catalog can become a UI action. */
export function selectToolMeditation(id:string,catalog:unknown[],hasPremium:boolean):VerifiedMeditationSelection{
 const item=catalog.map(value=>catalogItem.safeParse(value)).find(value=>value.success&&value.data.id===id);
 if(!item?.success||item.data.published===false)throw new FoundationError(404,'meditation_unavailable','Choose an available meditation from the current library.');
 const {published:_published,...meditation}=item.data;
 void _published;
 return {...meditation,access:meditation.premium&&!hasPremium?'premium_required':'available'};
}

/** Tools may choose one card per turn; displaying it is not playback. */
export function meditationToolAction(selection:VerifiedMeditationSelection){
 return {action:'meditation_card' as const,meditationId:selection.id,title:selection.title,durationSeconds:selection.durationSeconds,
  premium:selection.premium,audioLanguage:selection.audioLanguage??'en',access:selection.access,
  nextAction:selection.access==='available'?'open_player' as const:'view_access_options' as const,playbackStarted:false as const};
}

/** An attached recommendation is not evidence that a device opened or played it. */
export function enforcePracticeActionClaims(message:string,language:'en'|'ru',hasCard:boolean){
 const ownEnglish=/(?:^|[.!?\n]\s*)I(?:['’]ve| have)?\s+(?:already\s+)?(?:(?:started|launched|played|turned on)\s+(?:(?:the|your|this|that|selected|recommended)\s+){0,3}(?:audio|music|meditation|practice|track|playback)|opened\s+(?:(?:the|your|meditation)\s+){0,2}player)/i;
 const ownRussian=/(?:^|[.!?\n]\s*)(?:я\s+)?(?:уже\s+)?(?:(?:включил[а]?|запустил[а]?)\s+(?:(?:твою|вашу|эту|выбранную|рекомендованную)\s+){0,2}(?:аудио|музык|медитац|практик|трек|воспроизвед)|(?:я\s+)?открыл[а]?\s+(?:твой\s+|ваш\s+)?плеер)/i;
 const started=/(?:^|[.!?\n]\s*)(?:(?:the |your )?(?:audio|meditation|playback) (?:has (?:already )?started|is (?:already )?playing)|(?:аудио|медитация|воспроизведение) (?:уже )?(?:запущен[ао]?|начал[ао]сь|играет))/i;
 const playerOpen=/(?:^|[.!?\n]\s*)(?:(?:the |your )?player (?:is (?:already )?open|has been opened)|плеер (?:уже )?открыт)/i;
 if(!ownEnglish.test(message)&&!ownRussian.test(message)&&!started.test(message)&&!playerOpen.test(message))return message;
 return language==='ru'?hasCard?'Карточка практики — ниже. Нажми на неё, чтобы посмотреть доступные действия; аудио само не запускается.':'Аудио не запускалось. Выбери практику в приложении, чтобы открыть её плеер.':hasCard?'The practice card is below. Tap it for the available actions; audio does not start automatically.':'No audio has started. Choose a practice in the app to open its player.';
}
