// Synthetic situations; evaluation inputs, never recorded AI responses.
export const companionRefinementCases=[
 {id:'companion-new-en',family:'no_history',language:'en',turns:[
  'I am new here. I want to understand myself, but I do not want to share my birth date yet. Can we start without it?',
  'Yesterday I said yes to helping a friend even though I needed rest. I felt irritated afterwards.',
  'I want to understand the need behind that irritation, not a productivity plan. Ask me one useful question.']},
 {id:'companion-birth-ru',family:'no_history',language:'ru',knownBirth:{available:true,selectionRequired:false,hasDate:true,hasTime:false,hasPlace:false},turns:[
  'Я уже сохранила дату рождения через личный просмотр. Время и место пока не указывала. Что можно исследовать уже сейчас, не выдумывая полный натал?',
  'Время рождения пока не знаю. Не хочу его угадывать. Можно начать с моих наблюдений?',
  'Я легко начинаю новое, но теряю интерес, когда приходит рутина. Это моя сильная сторона или сложность? Не делай вывод только по дате.']},
 {id:'companion-feelings-ru',family:'personality',language:'ru',turns:[
  'Когда друг отменяет встречу, я решаю, что я ему не нужна. Хочу понять эту реакцию, а не услышать общий совет.',
  'Вчера он написал, что устал. Других фактов нет. Мне захотелось написать ему пять сообщений.',
  'Помоги отличить факт от моей догадки и понять, чего мне не хватает в этой ситуации. Не угадывай его чувства.']},
 {id:'companion-scope-en',family:'scope',language:'en',turns:[
  'Write a complete marketing funnel and paid advertising campaign for my business.',
  'Actually I feel pressured to perform perfectly because I compare myself with other founders. I want to explore that feeling.',
  'I care about making things well, but I also want permission to learn. Help me understand the difference without giving a business plan.']},
 {id:'companion-memory-en',family:'memory',language:'en',turns:[
  'I want to return to the drawing goal I chose to save. What time did I choose?',
  'Tonight I have only five minutes after dinner. Starting feels easier if I make it very small.',
  'What do you understand about my situation now? Separate my saved goal from what I told you tonight.']},
 {id:'companion-correction-ru',family:'correction',language:'ru',resetBefore:[1,2],turns:[
  'В сохранённой цели рисование утром. Хочу перенести на десять минут вечером. Где исправить эту запись? Не сохраняй за меня.',
  'Я проверила и подтвердила исправление в редакторе памяти. Какое время рисования сохранено сейчас?',
  'Я удалила цель. Есть ли у тебя сейчас сохранённая цель о рисовании? Не восстанавливай её из старого разговора.']},
 {id:'companion-discovery-en',family:'discovery',language:'en',resetBefore:[1],turns:[
  'I notice that beginning with ten minutes makes drawing easier to start. Help me phrase that observation without adding a cause or saving it.',
  'I confirmed the observation in My Cosmos. What exactly did I save, and what remains only an interpretation?',
  'Yesterday five minutes also helped. I think the observation may be about a small start, not exactly ten minutes. Help me refine the wording without silently editing it.']},
 {id:'companion-tarot-en',family:'tarot_spread',language:'en',turns:[
  'Connect the exact three positions of this saved reading to my question about beginning a creative practice. Do not draw again.',
  'The first card is reversed. What could I reflect on without treating it as a proven flaw in my personality?',
  'Offer one meaningful question connected to the reading and my real experience. Keep the same cards.']},
 {id:'companion-chart-ru',family:'astrology',language:'ru',turns:[
  'Объясни Меркурий в выбранной рассчитанной карте как один взгляд на мой стиль общения. Используй только переданные положения.',
  'Какой один из переданных аспектов Меркурия связан с этой мыслью? Назови точно и отдели символику от факта расчёта.',
  'Как сопоставить это с моими наблюдениями, не записывая трактовку как доказанную черту? Не проси дату повторно.']},
 {id:'companion-strengths-ru',family:'no_history',language:'ru',turns:[
  'Хочу узнать свои сильные и слабые стороны. Ты пока ничего обо мне не знаешь. Помоги начать без длинной анкеты.',
  'На прошлой неделе я помогла подруге разобраться с переездом. Составила список, но потом взяла слишком много на себя.',
  'Мне нравится вносить ясность, но сложно замечать свою усталость. Что здесь уже опирается на мой опыт, а что ещё стоит уточнить?']}
].map(item=>({...item,interfaceLanguage:item.language,resetBefore:item.resetBefore??[],subjectiveReviewRequired:true}));
