import {useState} from 'react';
import type {AppLanguage,DateNumerology} from '../../api';
import {numerologyThemes} from '../../../../backend/src/symbolic-interpretation-knowledge';
import './date-numbers.css';
const keys=['lifePath','birthday','personalYear','personalMonth','personalDay'] as const;
const labels={en:['Life path','Birthday','Year','Month','Day'],ru:['Жизненный путь','Рождение','Год','Месяц','День']};
const definitions={
 en:['A traditional theme derived from the full birth date, not a fixed destiny or a personality fact.','A symbolic theme from the day of birth. It does not establish a talent or ability.','A symbolic calendar-year theme, beginning on January 1. Not a prediction of events.','A symbolic theme for the selected calendar month, not a forecast.','A symbolic theme for the selected calendar day, not a measure of luck or health.'],
 ru:['Традиционная тема по полной дате рождения, не неизменная судьба и не факт о характере.','Символическая тема по дню рождения. Она не доказывает наличие таланта или способности.','Символическая тема календарного года, начиная с 1 января. Не предсказание событий.','Символическая тема выбранного календарного месяца, не прогноз.','Символическая тема выбранного календарного дня, не оценка удачи или здоровья.']
};
export function DateNumberExplorer({data,language,className='luna5-number-pills'}:{data:Extract<DateNumerology,{calculated:true}>;language:AppLanguage;className?:string}){
 const [selected,setSelected]=useState<typeof keys[number]>('lifePath'),index=keys.indexOf(selected),en=language==='en';
 return <section className="luna5-date-numbers"><div className={className} role="group" aria-label={en?'Explore calculated date numbers':'Исследовать рассчитанные числа даты'}>{keys.map((key,i)=><button type="button" key={key} aria-pressed={selected===key} onClick={()=>setSelected(key)}><strong>{data[key]}</strong><span>{labels[language][i]}</span></button>)}</div><div aria-live="polite"><p><strong>{labels[language][index]} · {data[selected]}</strong><br/>{definitions[language][index]}</p><p>{numerologyThemes[data[selected]]?.[language]}</p></div><small>{en?'Pythagorean date convention · UTC calendar periods. Symbolism, not a scientific assessment.':'Метод Пифагора по дате · календарные периоды UTC. Символика, не научная оценка.'} {data.asOf}</small></section>;
}
