import {ArrowRight,Sparkles} from 'lucide-react';
import type {AppLanguage,TarotReading} from '../../api';
import {useTarotDeck} from './editorialDeck';
export function TarotAiInterpretation({reading,language,onContinue}:{reading:TarotReading;language:AppLanguage;onContinue?:(id:string)=>void}){
 const tarotDeck=useTarotDeck();
 const ai=reading.interpretation;if(!ai||reading.status!=='ready')return null;
 const en=language==='en',v2=ai.version===2,action=v2?ai.actions?.[0]:ai.reflection;
 // Presentation only: historical interpretations remain intact, with no regeneration.
 return <section className="tarot-ai-reflection luna251-interpretation" data-testid="tarot-ai-reflection">
 <p className="tarot-ai-label"><Sparkles size={16}/>Luna AI</p>
 <div className="tarot-ai-takeaway"><h3>{en?'Your takeaway':'Главный вывод'}</h3><p>{ai.summary}</p></div>
 {v2&&Boolean(ai.cards?.length)&&<div className="tarot-ai-card-insights luna3-card-details" aria-label={en?'Explore each card':'Подробнее о каждой карте'}>{ai.cards?.map(c=><details key={c.cardId}><summary><span><strong>{tarotDeck.find(card=>card.id===c.cardId)?.name[language]??c.cardId}</strong><small>{c.position} · {c.orientation==='reversed'?(en?'Reversed':'Перевёрнутая'):(en?'Upright':'Прямая')}</small></span></summary><p>{c.positionMeaning}</p><p>{c.application}</p><p>{c.detail}</p></details>)}</div>}
 {action&&<div className="luna251-practical"><h3>{en?'One small step':'Один небольшой шаг'}</h3><p>{action}</p></div>}
 <p className="luna251-reflection-question">{ai.question}</p>
 <details className="tarot-ai-details luna251-reading-details"><summary>{en?'Explore the reading':'Подробнее о раскладе'}</summary>
  {v2?<>
   {ai.overall&&<div><h3>{en?'How the cards connect':'Как связаны карты'}</h3><p>{ai.overall}</p></div>}
   {Boolean(ai.actions&&ai.actions.length>1)&&<div><h3>{en?'Further reflection':'Для дальнейшего размышления'}</h3><ul>{ai.actions?.slice(1).map(a=><li key={a}>{a}</li>)}</ul></div>}
  </>:<>
   {ai.cardMeaning&&<div><h3>{en?'Card symbolism':'Символика карты'}</h3><p>{ai.cardMeaning}</p></div>}
   {ai.context&&<div><h3>{en?'In your context':'В контексте вопроса'}</h3><p>{ai.context}</p></div>}
   {ai.cardInsights?.map(c=><details key={c.cardId}><summary>{tarotDeck.find(card=>card.id===c.cardId)?.name[language]??c.cardId}</summary><p>{c.text}</p></details>)}
   {ai.links&&<div><h3>{en?'How the cards connect':'Как связаны карты'}</h3><p>{ai.links}</p></div>}
  </>}
  {ai.continuation&&<p>{ai.continuation}</p>}
 </details>
 {onContinue&&<button type="button" className="tarot-draw-button" onClick={()=>onContinue(reading.id)}>{en?'Discuss with Luna':'Обсудить с Luna'}<ArrowRight size={18}/></button>}
 </section>;
}
