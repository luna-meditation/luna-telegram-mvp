import {ArrowRight,Sparkles} from 'lucide-react';
import type {AppLanguage,TarotReading} from '../../api';
export function TarotAiInterpretation({reading,language,onContinue}:{reading:TarotReading;language:AppLanguage;onContinue?:(id:string)=>void}){
 const ai=reading.interpretation;if(!ai||reading.status!=='ready')return null;
 const en=language==='en';
 return <section className="tarot-ai-reflection" data-testid="tarot-ai-reflection">
 <p className="tarot-ai-label"><Sparkles size={16}/>Luna AI</p>
 <div className="tarot-ai-takeaway"><h3>{en?'Your takeaway':'Главный вывод Luna'}</h3><p>{ai.summary}</p></div>
 <div><h3>{en?'The card':'Значение карты'}</h3><p>{ai.cardMeaning}</p></div>
 <div><h3>{en?'A practical thought':'Практическая мысль'}</h3><p>{ai.reflection}</p></div>
 {onContinue&&<button type="button" className="tarot-draw-button" onClick={()=>onContinue(reading.id)}>{en?'Discuss with Luna':'Обсудить с Luna'}<ArrowRight size={18}/></button>}
 <details className="tarot-ai-details"><summary>{en?'Explore the full interpretation':'Подробная интерпретация'}</summary><div><h3>{en?'In your context':'В твоём контексте'}</h3><p>{ai.context}</p></div><div><h3>{en?'A question for you':'Вопрос для размышления'}</h3><p>{ai.question}</p></div>{ai.continuation&&<p>{ai.continuation}</p>}</details></section>;
}
