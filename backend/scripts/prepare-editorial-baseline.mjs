// Public, canonical bundled content only. Run with Node 22 --import tsx.
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {breathPractices} from '../../frontend/src/features/breathing/practices.ts';
import {luna34Achievements} from '../src/luna34-achievements.ts';
import {luna35BotCopy} from '../src/luna35-bot-policy.ts';
const json=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
const manifest=json('../../frontend/src/features/tarot/manifest.json'),content=json('../../frontend/src/features/tarot/content.json'),voices=json('../../frontend/src/features/breathing/voiceAssets.json');
const entries=[];const add=(kind,key,body)=>entries.push({kind,key,body});
for(const p of breathPractices)add('breathwork',p.id,{title:p.name,description:p.description,guide:p.guide,phases:p.phases,ambientAudio:'/assets/audio/soundscapes/deep-space-ambient.mp3',voiceCues:voices.clips});
for(const c of manifest.cards){const a=c.arcana==='major'?content.majorContent[c.number]:null,b=c.suit?content.minorContent[c.suit][c.number-1]:null;add('tarot',c.id,{title:c.name,description:{en:'Traditional symbolic meaning — not a prediction.',ru:'Традиционный символический смысл — не предсказание.'},image:c.image,upright:{en:a?.[2]??b[0],ru:a?.[3]??b[1]},reversed:{en:a?.[4]??b[2],ru:a?.[5]??b[3]}});}
for(const a of luna34Achievements)add('achievement',a.id,{title:a.title,description:a.description,image:a.art});
const astrology=[['natal','My natal chart','Моя натальная карта','Character, relationships and life themes.','Характер, отношения и жизненные темы.'],['compatibility','Compatibility','Совместимость','Two charts. A closer look at your connection.','Две карты и новый взгляд на ваши отношения.'],['calendar','Celestial calendar','Небесный календарь','Moon phases, planetary transits and daily reflection.','Лунные фазы, транзиты и темы для размышления.'],['path','Path & potential','Мой путь и потенциал','Motivation, strengths and room to grow.','Мотивация, сильные стороны и развитие.']];
for(const [key,en,ru,enText,ruText]of astrology)add('astrology',key,{title:{en,ru},description:{en:enText,ru:ruText},image:`/images/astrology/luna32-${key}.webp`});
add('garden','season-2',{title:{en:'Sakura Springs',ru:'Источники сакуры'},description:{en:'A future garden inspired by blossoms and quiet water.',ru:'Будущий сад с цветением и спокойной водой.'},image:'/assets/moon-garden/level-4-twin-bloom.png'});
add('garden','season-3',{title:{en:'Crystal Sanctuary',ru:'Кристальное убежище'},description:{en:'A future space inspired by luminous reflections.',ru:'Будущее пространство светящихся отражений.'},image:'/assets/moon-garden/level-6-reflection-garden.png'});
for(const key of ['app','tarot','garden','achievement','natal','compatibility'])add('share',key,{title:{en:'L U N A',ru:'L U N A'},description:{en:'A moment of self-discovery',ru:'Момент самопознания'}});
add('bot','welcome',{title:{en:'Luna',ru:'Luna'},description:{en:luna35BotCopy.en.welcome,ru:luna35BotCopy.ru.welcome},image:'/images/home/luna35-bot-welcome.jpg'});
const root=new URL('../../frontend/public/',import.meta.url),assets=[];
function walk(dir,prefix=''){for(const e of readdirSync(dir,{withFileTypes:true})){const p=prefix+e.name;if(e.isDirectory())walk(new URL(e.name+'/',dir),p+'/');else if(/\.(webp|png|jpe?g|mp3|wav)$/.test(e.name))assets.push('/'+p);}}walk(root);
writeFileSync(new URL('../src/luna42-editorial-baseline.json',import.meta.url),JSON.stringify(entries));
writeFileSync(new URL('../src/luna42-editorial-assets.json',import.meta.url),JSON.stringify(assets.sort()));
console.log(JSON.stringify({entries:entries.length,assets:assets.length,personalData:false,root:fileURLToPath(root)}));
