import {ArrowRight,Sparkles} from 'lucide-react';
import type {AppLanguage,TarotReading} from '../../api';
export function TarotAiInterpretation({reading,language,onContinue}:{reading:TarotReading;language:AppLanguage;onContinue?:(id:string)=>void}){
 const ai=reading.interpretation;if(!ai||reading.status!=='ready')return null;
 const en=language==='en',labels=en?['Your reflection','The card','What it means for you','Try this','A question for you']:['Твоя мысль дня','Значение карты','Что это значит для тебя','Попробуй','Вопрос себе'];
 return <section className="tarot-ai-reflection" data-testid="tarot-ai-reflection"><p className="tarot-ai-label"><Sparkles size={16}/>Luna AI</p>{[ai.summary,ai.cardMeaning,ai.context,ai.reflection,ai.question].map((text,index)=><div key={index}><h3>{labels[index]}</h3><p>{text}</p></div>)}{onContinue&&<button type="button" className="tarot-draw-button" onClick={()=>onContinue(reading.id)}>{en?'Continue with Luna AI':'Продолжить с Luna AI'}<ArrowRight size={18}/></button>}</section>;
}
