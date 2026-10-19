import {useEffect,useState} from 'react';
import {getDateNumerology,type DateNumerology,type AppLanguage} from '../../api';
import {DateNumberExplorer} from './DateNumberExplorer';
export function NumerologyPanel({chartId,language,initData}:{chartId:string;language:AppLanguage;initData?:string}){
 const en=language==='en',[open,setOpen]=useState(false),[data,setData]=useState<DateNumerology|null>(null),[error,setError]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{if(!open)return;let live=true;setError(false);setData(null);getDateNumerology(chartId,initData).then(r=>{if(live)setData(r);}).catch(()=>{if(live)setError(true);});return()=>{live=false;};},[chartId,initData,open,retry]);
 return <details className="luna-date-numerology" onToggle={event=>setOpen(event.currentTarget.open)}><summary>{en?'Numbers in your date · symbolic':'Числа твоей даты · символический взгляд'}</summary>
 {error?<p role="alert">{en?'Could not verify your date.':'Не удалось проверить дату.'}<button type="button" onClick={()=>setRetry(n=>n+1)}>{en?'Retry':'Повторить'}</button></p>:!data?<p role="status">{en?'Calculating…':'Считаем…'}</p>:!data.calculated?<p>{en?'Choose your own confirmed birth profile. Luna does not infer a date.':'Выбери собственный подтверждённый профиль рождения. Luna не угадывает дату.'}</p>:<><DateNumberExplorer data={data} language={language}/><details><summary>{en?'Calculation rules':'Правила расчёта'}</summary><p>{en?'Month, day and year are reduced separately, then added for Life Path. Master numbers 11, 22 and 33 are retained. Calendar year, month and day cycles always reduce to 1–9; the year starts on January 1. No name-based calculations.':'Месяц, день и год сокращаются отдельно, затем складываются для числа пути. Сохраняются мастер-числа 11, 22 и 33. Календарные циклы года, месяца и дня сокращаются до 1–9; год начинается 1 января. Расчётов по имени нет.'}</p><small>{data.asOf} · UTC · {data.version}</small></details></>}
 </details>;
}
