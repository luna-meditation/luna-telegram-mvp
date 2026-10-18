import {luna41EvalCases} from './luna41-eval-cases.mjs';
// 50 distinct tasks, alternating RU/EN, not 50 paraphrases of one action.
// The same exact context, history, schemas and prompt are supplied to all models.
export const intelligenceCases=luna41EvalCases.filter((_,index)=>index%2===Math.floor(index/2)%2).map((item,index)=>{
 const value={...item,id:`intelligence-${String(index+1).padStart(2,'0')}`,requiredTools:item.expectedTools,acceptableTools:item.expectedTools,turns:[{role:'assistant',content:item.language==='ru'?'Можем продолжить разговор или перейти к другой теме.':'We can continue our conversation or explore a new topic.'},{role:'user',content:item.message}]};
 if(index===20){value.requiredTools=['start_tarot_reading'];value.acceptableTools=value.requiredTools;value.expectedArguments={kind:'three'};}
 if(index===5||index===6){value.requiredTools=['start_breathing_session'];value.acceptableTools=value.requiredTools;if(index===6)value.expectedArguments={minutes:5};}
 if(item.category==='tarot'&&index!==20){value.requiredTools=[];value.acceptableTools=['get_tarot_reading'];}
 if(index===12){value.requiredTools=[];value.acceptableTools=['get_natal_chart'];}
 return value;
});
const replacements=[
 [44,'privacy','Создай Excel-файл и дай ссылку для скачивания.','ru',[],[]],
 [45,'context_switch','Different topic. Recommend an actual meditation for focus, not another Tarot spread.','en',['recommend_meditation'],['recommend_meditation']],
 [46,'memory','Я предпочитаю имя Александр, не Саша. Как мне начать двигаться к сохранённой цели по прототипу?','ru',[],['get_user_context']],
 [47,'journal','Find my saved reflections about the prototype, not all of my private journal.','en',['get_journal_context'],['get_journal_context']],
 [48,'history','Найди наш прошлый разговор о прототипе. Не выдумывай, если ничего не сохранилось.','ru',['find_previous_conversation'],['find_previous_conversation']],
 [49,'unsupported','Can you calculate my Human Design chart inside Luna right now?','en',[],[]]
];
for(const [index,category,message,language,requiredTools,acceptableTools] of replacements)Object.assign(intelligenceCases[index],{category,message,language,requiredTools,acceptableTools,turns:[{role:'assistant',content:language==='ru'?'Старый расклад сохранён в истории.':'Your previous Tarot reading is saved in history.'},{role:'user',content:message}]});
export function evaluateIntelligenceDecision(item,payload){
 const calls=(payload.output??[]).filter(v=>v.type==='function_call').map(v=>({name:v.name,arguments:v.arguments})),text=(payload.output??[]).filter(v=>v.type==='message').flatMap(v=>v.content??[]).filter(v=>v.type==='output_text').map(v=>v.text).join('\n');
 let message='';try{message=JSON.parse(text).message??'';}catch{message=text;}
 const required=item.requiredTools??[],acceptable=item.acceptableTools??[];
 const actionMatch=required.length?calls.some(c=>required.includes(c.name)):calls.every(c=>acceptable.includes(c.name));
 const argumentMatch=!item.expectedArguments||calls.some(c=>{let args;try{args=JSON.parse(c.arguments);}catch{return false;}return Object.entries(item.expectedArguments).every(([key,value])=>args[key]===value);});
 const letters=(message.match(/[a-z]/gi)??[]).length,cyrillic=(message.match(/[а-яё]/gi)??[]).length;
 const languageMatch=!message||item.language==='ru'?(!message||cyrillic>0&&letters<cyrillic*2):cyrillic<10;
 return{calledTools:calls,answer:message||null,status:payload.status,actionMatch,argumentMatch,languageMatch,complete:payload.status==='completed',humanReviewRequired:true};
}
