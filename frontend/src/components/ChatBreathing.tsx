import {saveBreathSession,type AppLanguage} from '../api';
import {breathPractices,type BreathPracticeId} from '../features/breathing/practices';
import {BreathPracticeSession} from '../features/breathing/BreathPracticeSession';
type Completion=(mode:BreathPracticeId,duration:number,breaths:number,sessionId?:string)=>Promise<void>;
export function ChatBreathing({language,initial,initData,onComplete,registerBackHandler,sessionKey}:{language:AppLanguage;initial?:{practiceId:string;minutes:number};initData?:string;onComplete?:Completion;registerBackHandler?:(handler:(()=>void)|null)=>void;sessionKey?:string}){
 const practiceId=breathPractices.find(p=>p.id===initial?.practiceId)?.id??'calm',minutes=initial&&[1,3,5,10].includes(initial.minutes)?initial.minutes:1;
 const complete:Completion=onComplete??(async(mode,duration_seconds,breath_count,session_id)=>{const date=new Date(),local_date=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;await saveBreathSession({mode,duration_seconds,breath_count,session_id,local_date},initData);});
 return <BreathPracticeSession embedded redesigned cacheKey={sessionKey} language={language} initial={{practiceId,minutes}} initData={initData} onComplete={complete} onClose={()=>{}} registerBackHandler={registerBackHandler} onOpenFull={(selectedPractice,selectedMinutes)=>window.dispatchEvent(new CustomEvent('luna-open-breathing',{detail:{practiceId:selectedPractice,minutes:selectedMinutes}}))}/>;
}
