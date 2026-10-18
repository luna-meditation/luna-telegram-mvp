import type {AppLanguage,LunaMessage,Meditation,AstrologyChatAttachment} from '../api';
import type {IntelligenceAttachment} from '../../../backend/src/luna-intelligence-contract';
import {ChatTarotReading} from '../features/tarot/ChatTarotReading';
import {EmbeddedTarotChooser} from '../features/tarot/EmbeddedTarotChooser';
import {ChatBreathing} from './ChatBreathing';
import {ChatAstrology} from './ChatAstrology';
import {ChatCommerce} from '../features/membership/ChatCommerce';
import {ChatMeditationCard} from '../design-system/components/ChatMeditationCard';
import type {BreathPracticeId} from '../features/breathing/practices';
import './luna-intelligence.css';
type Props={attachment:IntelligenceAttachment;message:LunaMessage;conversationId:string;language:AppLanguage;initData?:string;meditations:Meditation[];hasPremium:boolean;fulfilled:Set<string>;disabled:boolean;onUpdate:(message:LunaMessage)=>void;onResult:(result:{conversationId:string;message:LunaMessage})=>void;onPending:()=>void;onOpenMeditation:(meditation:Meditation)=>void;onDiscuss:(context:AstrologyChatAttachment,focus?:string)=>void;onFollowUp:(prompt:string,context:AstrologyChatAttachment)=>void;onCompleteBreath?:(mode:BreathPracticeId,duration:number,breaths:number,sessionId?:string)=>Promise<void>;registerBackHandler?:(handler:(()=>void)|null)=>void};
export function LunaAttachmentRenderer(props:Props){
 const {attachment:a,message,language,initData,registerBackHandler}=props,en=language==='en';
 if(a.status==='FAILED')return <p role="status">{en?'This action is unavailable. Your saved conversation and balance are unchanged.':'Действие недоступно. Сохранённый разговор и баланс не изменены.'}</p>;
 switch(a.type){
  case 'tarot_reading':
   if(a.payload.stage==='choose')return props.fulfilled.has(message.id)?<p className="luna-intelligence-resolved">✓ {en?'Your reading is saved below.':'Расклад сохранён ниже.'}</p>:<EmbeddedTarotChooser attachment={a} messageId={message.id} conversationId={props.conversationId} language={language} initData={initData} onResult={props.onResult} onPending={props.onPending}/>;
   return message.metadata?.tarot?.readingId===a.payload.readingId?<ChatTarotReading message={message} language={language} initData={initData} registerBackHandler={registerBackHandler} onUpdate={props.onUpdate}/>:<p role="status">{en?'Reopen the saved reading. It will not be drawn again.':'Открой сохранённый расклад снова. Новые карты не выбираются.'}</p>;
  case 'breathing_session':return <ChatBreathing sessionKey={a.operationId} language={language} initial={a.payload} initData={initData} onComplete={props.onCompleteBreath} registerBackHandler={registerBackHandler}/>;
  case 'meditation':{const meditation=props.meditations.find(m=>m.id===a.payload.meditationId)??(message.metadata?.recommendedMeditation?.id===a.payload.meditationId?message.metadata.recommendedMeditation:null);return meditation?<ChatMeditationCard meditation={meditation} language={language} hasPremium={props.hasPremium} onOpen={()=>props.onOpenMeditation(meditation)}/>:<p role="status">{en?'This practice is no longer available. Choose another published meditation.':'Эта практика больше недоступна. Выбери другую медитацию из библиотеки.'}</p>;}
  case 'natal_chart':case 'compatibility_report':
   return message.metadata?.astrologyWorkflow?<ChatAstrology message={message} language={language} initData={initData} disabled={props.disabled} onUpdate={props.onUpdate} onDiscuss={props.onDiscuss} onFollowUp={props.onFollowUp}/>:<section className="luna-intelligence-context"><strong>{a.type==='natal_chart'?(en?'Calculated natal chart':'Рассчитанная натальная карта'):(en?'Calculated compatibility':'Рассчитанная совместимость')}</strong>{a.payload.chartId&&<button type="button" disabled={props.disabled} onClick={()=>props.onDiscuss({chartId:a.payload.chartId!,...('secondChartId'in a.payload&&a.payload.secondChartId?{secondChartId:a.payload.secondChartId}:{}),...('reportId'in a.payload&&a.payload.reportId?{reportId:a.payload.reportId}:{}),...('comparisonId'in a.payload&&a.payload.comparisonId?{comparisonId:a.payload.comparisonId}:{}),...('relationship'in a.payload&&a.payload.relationship?{relationship:a.payload.relationship}:{})})}>{en?'Discuss this exact context':'Обсудить именно этот контекст'}</button>}</section>;
  case 'moon_seeds_offer':return <ChatCommerce view={a.payload.view} language={language} initData={initData} conversationId={props.conversationId} onResult={props.onResult}/>;
  case 'premium_offer':return <ChatCommerce view="premium" language={language} initData={initData} conversationId={props.conversationId} onResult={props.onResult}/>;
 }
}
