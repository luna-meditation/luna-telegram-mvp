import type {TarotIntention} from './session';
import type {AppLanguage} from '../../api';
const context={
 en:{
  general:{intro:'For your day ahead',invitation:'Let this be a lens for noticing what matters today, rather than a promise of what will happen.',reflection:'What small, grounded step would honour this message today?'},
  love:{intro:'In love and relationships',invitation:'Notice this theme in how you give and receive care. Consider an honest conversation, without assuming what another person feels.',reflection:'What do I need to express or listen to more openly?'},
  career:{intro:'For work and money',invitation:'Consider where this theme appears in your choices, priorities and resources. Weigh practical facts before making financial decisions.',reflection:'Which choice feels aligned with my values and realistic resources?'},
  growth:{intro:'For your personal growth',invitation:'Notice a habit or belief connected to this theme. A gentle, repeatable change can matter more than a dramatic leap.',reflection:'What am I ready to practise, soften or let go of?'}
 },
 ru:{
  general:{intro:'В контексте твоего дня',invitation:'Пусть это станет способом заметить важное сегодня, а не обещанием того, что произойдёт.',reflection:'Какой небольшой, осознанный шаг поможет мне учесть эту мысль сегодня?'},
  love:{intro:'В любви и отношениях',invitation:'Заметь эту тему в том, как ты даришь и принимаешь заботу. Подумай о честном разговоре, не угадывая чувства другого человека.',reflection:'О чём мне стоит сказать честнее или что выслушать внимательнее?'},
  career:{intro:'В работе и финансах',invitation:'Обрати внимание на эту тему в своих решениях, приоритетах и ресурсах. Финансовые решения стоит принимать на основе реальных фактов.',reflection:'Какой выбор согласуется с моими ценностями и доступными ресурсами?'},
  growth:{intro:'В личном развитии',invitation:'Заметь привычку или убеждение, связанные с этой темой. Мягкое, регулярное изменение может значить больше, чем резкий рывок.',reflection:'Что я готовлюсь развивать, смягчить или отпустить?'}
 }
} as const;
// Existing card meaning + explicitly local, authored intention framing. No AI request.
export function buildTarotInterpretation(meaning:string,intention:TarotIntention,language:AppLanguage){
 const lens=context[language][intention];
 return {text:`${lens.intro}: ${meaning} ${lens.invitation}`,reflection:lens.reflection};
}
