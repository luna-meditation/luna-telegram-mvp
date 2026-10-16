import { BookOpen, Heart, Moon, Sparkles, Stars,Orbit } from 'lucide-react';
import type { AppLanguage } from '../api';
import { luna2Copy } from './copy';
import {featureFlags} from '../config/featureFlags';

export function LunaQuickActions({ language, onPrompt, onTarot,onDream, disabled = false }: { language: AppLanguage; onPrompt: (prompt: string) => void; onTarot?:()=>void;onDream?:()=>void; disabled?: boolean }) {
  const t = luna2Copy[language];
  const actions = [
    { id: 'feelings', title: language==='en'?'Talk':'Поговорить', Icon: Heart, prompt: t.feelingsPrompt },
    { id: 'tarot', title: t.tarotReading, Icon: Sparkles, prompt: null },
    { id: 'astrology', title: featureFlags.ai_central_experience?(language==='en'?'Natal chart':'Натальная карта'):t.birthChart, Icon: Stars, prompt: null },
    ...(featureFlags.ai_central_experience?[{id:'compatibility',title:language==='en'?'Compatibility':'Совместимость',Icon:Orbit,prompt:null}]:[]),
    { id: 'meditation', title: t.recommend, Icon: BookOpen, prompt: t.recommendPrompt },
    { id: 'dream', title: t.dream, Icon: Moon, prompt: t.dreamPrompt }
  ];
  return <div className="luna2-ai-actions" aria-label={t.ideas}>{actions.map(({ id, title, Icon, prompt }) => {
    const openTarot=id==='tarot'?onTarot:undefined;
    const openAction=openTarot??(id==='dream'?onDream:undefined)??(['astrology','compatibility'].includes(id)&&featureFlags.ai_central_experience?()=>window.dispatchEvent(new CustomEvent('luna-open-astrology',{detail:{section:id==='compatibility'?'compatibility':'natal'}})):undefined);
    return <button type="button" key={id} data-action={id} disabled={disabled || (!prompt&&!openAction)} onClick={() => openAction?openAction():prompt&&onPrompt(prompt)}>
      <Icon size={20} /><span>{title}</span>{!prompt&&!openAction ? <small>{t.soon}</small> : null}
    </button>;
  })}</div>;
}
