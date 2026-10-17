import {miniAppLink,parseLaunchDestination} from './luna35-launch.js';
export {miniAppLink,parseLaunchDestination};
export type BotLanguage='en'|'ru';
export const botLanguage=(value?:string):BotLanguage=>value?.toLowerCase().startsWith('ru')?'ru':'en';
export const luna35BotCopy={
 en:{name:'Luna 🌙',short:'Your AI companion for Tarot, astrology, self-discovery and inner calm.',description:'Discover a more personal way to explore yourself with Luna. Interactive Tarot, natal astrology, relationship compatibility, meaningful AI conversations, meditation and breathwork — all in one beautiful space.',welcome:'🌙 Welcome to Luna\n\nA little magic. A deeper understanding of yourself.\n\nExplore Tarot, your birth chart and relationships, or find a moment of calm with your personal AI companion.\n\n✨ Your daily Tarot card is free.',open:'Open Luna ✨',tarot:'Free Tarot reading',astrology:'Explore astrology'},
 ru:{name:'Luna 🌙',short:'Ваш AI-проводник: Таро, астрология, самопознание и внутреннее спокойствие.',description:'Откройте новый способ узнать себя с Luna. Интерактивное Таро, натальная астрология, совместимость, осмысленные разговоры с AI, медитации и дыхание — в одном красивом пространстве.',welcome:'🌙 Добро пожаловать в Luna\n\nНемного магии. Больше понимания себя.\n\nИсследуйте Таро, натальную карту и отношения или найдите момент спокойствия с персональным AI-проводником.\n\n✨ Карта дня — бесплатно.',open:'Открыть Luna ✨',tarot:'Бесплатная карта Таро',astrology:'Открыть астрологию'}
} as const;
export function welcomeKeyboard(username:string,language:BotLanguage,start=''){
 const copy=luna35BotCopy[language],launch=parseLaunchDestination(start);
 return {inline_keyboard:[[{text:copy.open,url:miniAppLink(username,launch.destination,launch.referral??undefined)}],[{text:copy.tarot,url:miniAppLink(username,'daily',launch.referral??undefined)},{text:copy.astrology,url:miniAppLink(username,'astrology',launch.referral??undefined)}]]};
}
export function botCommands(language:BotLanguage){const ru=language==='ru';return [
 {command:'start',description:ru?'Знакомство с Luna':'Welcome to Luna'},
 {command:'app',description:ru?'Открыть Luna':'Open Luna'},
 {command:'tarot',description:ru?'Открыть Таро':'Explore Tarot'},
 {command:'astrology',description:ru?'Открыть астрологию':'Explore astrology'},
 {command:'help',description:ru?'Помощь и поддержка':'Help and support'},
 {command:'paysupport',description:ru?'Поддержка по платежам':'Payment support'}
 ];}
