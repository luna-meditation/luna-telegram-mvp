// Synthetic user inputs and source fixtures, never claimed to be AI output.
export const productV2Cases=[
 {id:'new-relationships-en',family:'personality',language:'en',topic:'relationships',turns:[
  'My partner goes quiet after disagreements. Yesterday I asked about our weekend and got no reply. I want to talk without chasing them.',
  'Usually I send several messages. I would like to send just one calm message and leave space.',
  'Help me write that one message in my own voice: warm, direct, and no more than two sentences.']},
 {id:'new-work-ru',family:'personality',language:'ru',topic:'work',turns:[
  'На работе мне добавили ещё один проект. Сегодня я уже не успеваю, но боюсь показаться ненадёжной.',
  'Сроки двух задач совпали. Руководитель пока не знает. Хочу попросить выбрать приоритет, а не оправдываться.',
  'Напиши короткое сообщение руководителю с этим запросом, без обещания закончить обе задачи сегодня.']},
 {id:'new-direction-en',family:'personality',language:'en',topic:'direction',turns:[
  'I am choosing between staying in my familiar job and trying illustration. I cannot afford to leave my job this month.',
  'I can spare two hours on Saturday, and I would like to test whether I enjoy making a real brief.',
  'Give me a realistic first experiment for those two hours, keeping my current job.']},
 {id:'new-self-ru',family:'personality',language:'ru',topic:'self',turns:[
  'Когда друг отменяет встречу, я злюсь и сразу решаю, что я ему не нужна. Хочу понять эту реакцию.',
  'Вчера он написал, что устал. У меня нет других фактов. Я ещё ничего не ответила.',
  'Помоги отделить факты от моей догадки и выбрать спокойный ответ. Без диагноза и догадок о его чувствах.']},
 {id:'return-memory-en',family:'memory',language:'en',turns:[
  'I want to return to the drawing goal I chose to save. What schedule did I choose?',
  'Tonight I only have five minutes after dinner. I want to keep it very simple.',
  'What is my plan for tonight, and how is that different from my usual saved goal?']},
 {id:'return-correction-delete-ru',family:'correction',language:'ru',resetBefore:[1,2],turns:[
  'В сохранённой цели сейчас рисование утром. Я хочу перенести его на десять минут вечером. Где исправить запись?',
  'Я проверила и подтвердила исправление в редакторе памяти. Какое время рисования сохранено сейчас?',
  'Я удалила эту цель в настройках памяти. Есть ли у тебя сейчас сохранённая цель о рисовании? Если нет, не восстанавливай её из старого разговора.']},
 {id:'return-discovery-en',family:'discovery',language:'en',resetBefore:[1],turns:[
  'I notice that drawing for only ten minutes makes beginning easier. Help me phrase a possible observation, but do not save it.',
  'I reviewed and confirmed that observation in My Cosmos. What exactly is saved, and what small experiment could help me reflect on it?',
  'I tried five minutes yesterday and still began. Could the observation be about a small start rather than exactly ten minutes? Do not silently edit it.']},
 {id:'return-reflection-ru',family:'no_history',language:'ru',turns:[
  'В сообщении на сегодня было предложение сделать план бережнее к себе. Как применить его к моей загруженной неделе?',
  'Я не передавала текущие транзиты. Это прогноз по сегодняшним планетам или просто размышление?',
  'Тогда помоги выбрать личный вопрос для размышления, без астрологических предсказаний. У меня важный разговор в пятницу.']},
 {id:'return-tarot-en',family:'tarot_spread',language:'en',turns:[
  'How do the three positions in this saved reading relate to my original question about beginning a creative practice? Do not draw again.',
  'Focus on the reversed first card. What tension could I reflect on without treating it as a fact about me?',
  'Give me one small next step connected to this reading. Keep the same cards and original question.']},
 {id:'return-astrology-ru',family:'astrology',language:'ru',turns:[
  'Объясни Меркурий в выбранной рассчитанной натальной карте простыми словами. Используй только переданные положения и аспекты.',
  'Какой один из переданных аспектов Меркурия связан с этой мыслью? Назови его точно и отдели символическую трактовку от факта расчёта.',
  'Предложи один вопрос для самонаблюдения по этому аспекту. Не делай прогноз на сегодня и не проси дату рождения повторно.']}
].map(item=>({...item,interfaceLanguage:item.language,resetBefore:item.resetBefore??[],subjectiveReviewRequired:true}));
