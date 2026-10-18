export const meetSteps=['name','interests','priority','relationships','birth','style','consent'] as const;
export type MeetStep=typeof meetSteps[number];
export const meetInterestOptions=[
 ['relationships','Love & relationships','Любовь и отношения'],['career','Career & business','Карьера и дело'],['money','Money & goals','Деньги и цели'],['growth','Self-discovery','Самопознание'],['wellbeing','Emotional wellbeing','Эмоциональное благополучие'],['tarot','Tarot','Таро'],['astrology','Astrology','Астрология'],['meditation','Meditation & breathing','Медитация и дыхание'],['exploring','Just exploring','Просто знакомлюсь']
] as const;
export const meetOptions={
 priority:[['clarity','Find clarity about work','Прояснить вопросы работы'],['connection','Understand a relationship','Лучше понять отношения'],['balance','Find emotional balance','Найти эмоциональное равновесие'],['decision','Make a decision','Принять решение'],['habits','Build better habits','Развить полезные привычки'],['self','Understand myself','Лучше понять себя']],
 relationships:[['single','Single','Без партнёра'],['partnered','In a relationship','В отношениях'],['complex','It’s complicated','Всё непросто'],['private','Prefer not to say','Не хочу говорить'],['irrelevant','Not relevant','Неактуально']],
 style:[['warm','Warm & supportive','Тепло и с поддержкой'],['direct','Direct & practical','Прямо и по делу'],['reflective','Deep & reflective','Вдумчиво и глубоко'],['short','Short & simple','Кратко и просто']]
} as const;
/** Reorder real choices, without inferring a priority on the user's behalf. */
export function relevantMeetPriorities(interests:readonly string[]){
 const preferred:Record<string,string>={relationships:'connection',career:'clarity',money:'decision',growth:'self',wellbeing:'balance',meditation:'habits',tarot:'decision',astrology:'self'};
 const ranks=new Map<string,number>();for(const interest of interests){const id=preferred[interest];if(id&&!ranks.has(id))ranks.set(id,ranks.size);}
 return [...meetOptions.priority].sort((a,b)=>(ranks.get(a[0])??99)-(ranks.get(b[0])??99));
}
export const domainSuggestions:Record<string,Array<readonly [string,string]>>={
 relationships:[['Understand each other','Лучше понимать друг друга'],['Improve communication','Улучшить общение'],['Explore a difficult situation','Разобраться в сложной ситуации'],['Explore this topic','Просто исследовать тему']],
 career:[['Develop my business','Развивать свой бизнес'],['Find a new direction','Найти новое направление'],['Learn a new skill','Освоить новый навык'],['Find work-life balance','Найти баланс работы и жизни']],
 money:[['Build a savings habit','Начать откладывать'],['Plan a goal','Спланировать цель'],['Spend more intentionally','Тратить осознаннее'],['Understand my priorities','Понять свои приоритеты']],
 growth:[['Improve my English','Улучшить английский'],['Build confidence','Развивать уверенность'],['Keep a useful habit','Закрепить полезную привычку'],['Make time for learning','Находить время на учёбу']],
 wellbeing:[['Less stress','Меньше стресса'],['Better sleep','Лучше спать'],['More calm','Больше спокойствия'],['Better focus','Лучше концентрироваться']],
 social:[['Meet new people','Знакомиться с людьми'],['See friends more often','Чаще видеть друзей'],['Find a community','Найти своё сообщество'],['Set boundaries','Обозначать границы']],
 lifestyle:[['A steadier daily rhythm','Более устойчивый ритм дня'],['More time outdoors','Больше бывать на природе'],['Travel more','Больше путешествовать'],['Make time for hobbies','Находить время на увлечения']],
 dreams:[['Reflect through Tarot','Размышлять с помощью Таро'],['Explore astrology','Исследовать астрологию'],['Keep a reflection journal','Вести дневник размышлений'],['Clarify what matters to me','Понять, что для меня важно']]
};
