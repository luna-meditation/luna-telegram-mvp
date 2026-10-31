import {useEffect,useState} from 'react';
import {ArrowUpRight,ChevronDown} from 'lucide-react';
import {getBirthProfiles,openAstrologyReport,type AppLanguage,type BirthProfile,type PersonalPortrait,type UniverseData} from '../api';
import {planetTheme,zodiacNames} from '../features/astrology/chartCopy';
import {DateNumberExplorer} from '../features/astrology/DateNumberExplorer';

/** Read-only owner-authorized sources. No interpretation is generated on mount. */
export function MyPortraitSummary({portrait,data,language,name,initData,onChart,onBirth,onDiscuss}:{portrait:PersonalPortrait;data:UniverseData;language:AppLanguage;name:string;initData?:string;onChart:()=>void;onBirth:()=>void;onDiscuss:()=>void}){
 const en=language==='en',names=zodiacNames(language),english=zodiacNames('en');
 const [birth,setBirth]=useState<BirthProfile|null>(null),[birthError,setBirthError]=useState(false),[savedSummary,setSavedSummary]=useState('');
 const chartId=portrait.chart?.id;
 useEffect(()=>{
  let live=true;setBirth(null);setBirthError(false);setSavedSummary('');
  void getBirthProfiles(initData).then(result=>{if(!live)return;const own=result.profiles.filter(profile=>profile.subject_kind==='self');if(own.length===1&&!portrait.birth.selectionRequired)setBirth(own[0]);}).catch(()=>{if(live)setBirthError(true);});
  if(chartId)void openAstrologyReport(chartId,null,language,initData).then(result=>{const report=result.report;if(live&&report?.first_chart_id===chartId&&!report.second_chart_id&&report.language===language)setSavedSummary(report.report.summary);}).catch(()=>{/* A saved report is optional. Never purchase or regenerate it. */});
  return()=>{live=false;};
 },[initData,chartId,language,portrait.birth.selectionRequired]);
 const words=[...portrait.sections.essence,...portrait.sections.direction].filter(item=>!item.private).slice(0,2);
 const placements=[
  {id:'sun',title:en?'What gives you direction':'Что помогает выбирать направление'},
  {id:'moon',title:en?'What helps you feel at home':'Что помогает чувствовать опору'},
  {id:'rising',title:en?'How you meet something new':'Как ты встречаешь новое'}
 ].map(item=>({...item,value:item.id==='rising'?portrait.chart?.facts.ascendant:portrait.chart?.facts.planets.find(planet=>planet.planet.toLowerCase()===item.id)?.signs.map(sign=>names[english.indexOf(sign)]??sign).join(' / ')}));
 if(!placements[0].value&&portrait.dateOnlySun?.sunSigns.length)placements[0].value=portrait.dateOnlySun.sunSigns.map(index=>names[index]).join(' / ');
 if(placements[2].value)placements[2].value=names[english.indexOf(placements[2].value)]??placements[2].value;
 return <section className="cosmos-portrait-summary" data-testid="my-portrait-summary">
  <header className="cosmos-detail-heading"><p>{name}</p><h1>{en?'My Portrait':'Мой портрет'}</h1></header>
  <p className="cosmos-portrait-intro">{en?'Your own words come first. Your birth chart and date numbers offer other ways to reflect, without deciding who you are.':'Твои слова — главное. Карта рождения и числа даты предлагают другие взгляды для размышления, не определяя, кто ты.'}</p>
  {words.length>0&&<section aria-label={en?'In your own words':'Твоими словами'}><h2>{en?'In your own words':'Твоими словами'}</h2>{words.map(item=><blockquote key={item.id}>{item.text}</blockquote>)}</section>}
  <section className="cosmos-birth-summary"><h2>{en?'Your starting point':'Твоя точка отсчёта'}</h2>
   {birth?<p><time dateTime={birth.birth_date}>{birth.birth_date.split('-').reverse().join('.')}</time>{' · '}{birth.birth_time??(en?'Time unknown':'Время неизвестно')}<br/>{birth.location.label}</p>:<p>{birthError?(en?'Birth details could not be verified right now.':'Не удалось проверить данные рождения.'):(en?'Birth details are optional. Add or choose your own profile when you want to explore your chart.':'Данные рождения необязательны. Добавь или выбери свой профиль, когда захочется исследовать карту.')}</p>}
   <button className="cosmos-text-link" type="button" onClick={onBirth}>{birth?(en?'Review birth details':'Проверить данные рождения'):(en?'Add or choose my birth profile':'Добавить или выбрать мой профиль')}<ArrowUpRight size={15}/></button>
  </section>
  <section className="cosmos-readable-chart"><h2>{en?'A view through your birth chart':'Взгляд через карту рождения'}</h2>
   {savedSummary?<p data-testid="saved-portrait-summary">{savedSummary}</p>:<p>{en?'These three parts of a chart are invitations to explore purpose, comfort and new situations. Compare them with your experience; a placement is not a fact about your character.':'Три части карты помогают исследовать цели, чувство опоры и новые ситуации. Сверяй их со своим опытом: положение в карте не доказывает черту характера.'}</p>}
   <div>{placements.filter(item=>item.value).map(item=><article key={item.id}><h3>{item.title}</h3><strong>{item.value}</strong><p>{item.id==='rising'?(en?'A way to reflect on first encounters and new beginnings.':'Повод подумать о первом знакомстве и новых начинаниях.'):planetTheme(item.id,language)}</p></article>)}</div>
   {!placements.some(item=>item.value)&&<p>{en?'There is no verified chart yet. You can still explore your own observations with Luna.':'Проверенной карты пока нет. Свои наблюдения можно исследовать с Луной и без неё.'}</p>}
   {portrait.chart?.facts.precision==='unknown'&&<small>{en?'Birth time is unknown. Possible sign ranges are shown; rising and houses are not guessed.':'Время рождения неизвестно. Показаны возможные знаки; асцендент и дома не угадываются.'}</small>}
   <button type="button" className="cosmos-text-link" onClick={onChart}>{en?'Explore the interactive chart':'Исследовать интерактивную карту'}<ArrowUpRight size={16}/></button>
  </section>
  {portrait.numerology.calculated&&<details className="cosmos-portrait-numbers"><summary>{en?'Numbers of my birth date':'Числа моей даты рождения'} · {portrait.numerology.lifePath}<ChevronDown size={16}/></summary><DateNumberExplorer data={portrait.numerology} language={language}/></details>}
  <button type="button" className="cosmos-portrait-discuss" onClick={onDiscuss}>{en?'Explore my portrait with Luna':'Обсудить мой портрет с Луной'}<ArrowUpRight size={17}/></button>
  {data.profile.interests.length>0&&<p className="cosmos-muted">{en?'Your interests':'Твои интересы'}: {data.profile.interests.map(id=>({astrology:en?'Astrology':'Астрология',tarot:en?'Tarot':'Таро',meditation:en?'Meditation':'Медитация',wellbeing:en?'Wellbeing':'Благополучие'}[id]??'')).filter(Boolean).join(' · ')}</p>}
 </section>;
}
