import {z} from 'zod';
import {FoundationError} from './foundation-error.js';

const catalogItem=z.object({
 id:z.string().uuid(),title:z.string().trim().min(1).max(300),
 durationSeconds:z.number().finite().positive().max(24*3600),premium:z.boolean(),
 published:z.boolean().optional(),audioLanguage:z.enum(['en','ru']).optional()
});
export type VerifiedMeditationSelection={id:string;title:string;durationSeconds:number;premium:boolean;audioLanguage?:'en'|'ru';access:'available'|'premium_required'};

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
