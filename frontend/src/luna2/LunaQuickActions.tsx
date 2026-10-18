import { BookOpen, Heart, Moon, Sparkles, Stars,Orbit } from 'lucide-react';
import {useState} from 'react';
import type { AppLanguage } from '../api';
import { luna2Copy } from './copy';
import {featureFlags} from '../config/featureFlags';

export function LunaQuickActions({ language, onPrompt, onTarot,onDream,onAstrology, disabled = false }: { language: AppLanguage; onPrompt: (prompt: string) => void; onTarot?:()=>void;onDream?:()=>void;onAstrology?:(kind:'natal'|'compatibility')=>void; disabled?: boolean }) {
  const t = luna2Copy[language];
  const [expanded,setExpanded]=useState(false);
  const actions = [
    ...(featureFlags.cosmos_v2?[{id:'meet',title:language==='en'?'Meet Luna':'Познакомиться с Луной',Icon:Moon,prompt:null}]:[]),
    { id: 'feelings', title: language==='en'?'Talk':'Поговорить', Icon: Heart, prompt: t.feelingsPrompt },
    { id: 'tarot', title: t.tarotReading, Icon: Sparkles, prompt: null },
    { id: 'astrology', title: featureFlags.ai_central_experience?(language==='en'?'Natal chart':'Натальная карта'):t.birthChart, Icon: Stars, prompt: null },
    ...(featureFlags.ai_central_experience?[{id:'compatibility',title:language==='en'?'Compatibility':'Совместимость',Icon:Orbit,prompt:null}]:[]),
    { id: 'meditation', title: t.recommend, Icon: BookOpen, prompt: t.recommendPrompt },
    { id: 'dream', title: t.dream, Icon: Moon, prompt: t.dreamPrompt }
  ];
  const prioritized=[...actions].sort((a,b)=>['feelings','tarot','meditation','astrology','meet','compatibility','dream'].indexOf(a.id)-['feelings','tarot','meditation','astrology','meet','compatibility','dream'].indexOf(b.id));
  return <div className="luna2-ai-actions" aria-label={t.ideas}>{(expanded?prioritized:prioritized.slice(0,4)).map(({ id, title, Icon, prompt }) => {
    const openTarot=id==='tarot'?onTarot:undefined;
    const openAction=openTarot??(id==='meet'?()=>window.dispatchEvent(new CustomEvent('luna-open-destination',{detail:{destination:'meet'}})):undefined)??(id==='dream'?onDream:undefined)??(['astrology','compatibility'].includes(id)&&featureFlags.ai_central_experience?()=>onAstrology?onAstrology(id==='compatibility'?'compatibility':'natal'):window.dispatchEvent(new CustomEvent('luna-open-astrology',{detail:{section:id==='compatibility'?'compatibility':'natal'}})):undefined);
    return <button type="button" key={id} data-action={id} disabled={disabled || (!prompt&&!openAction)} onClick={() => openAction?openAction():prompt&&onPrompt(prompt)}>
      <Icon size={20} /><span>{title}</span>{!prompt&&!openAction ? <small>{t.soon}</small> : null}
    </button>;
  })}{actions.length>4&&<button type="button" disabled={disabled} aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>{expanded?(language==='ru'?'Меньше вариантов':'Fewer options'):(language==='ru'?'Другие возможности':'More possibilities')}</button>}</div>;
}
