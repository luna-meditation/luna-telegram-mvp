import { BookOpen, Heart, Moon, Sparkles, Stars } from 'lucide-react';
import type { AppLanguage } from '../api';
import { luna2Copy } from './copy';

export function LunaQuickActions({ language, onPrompt, onTarot, disabled = false }: { language: AppLanguage; onPrompt: (prompt: string) => void; onTarot?:()=>void; disabled?: boolean }) {
  const t = luna2Copy[language];
  const actions = [
    { id: 'feelings', title: t.feelings, Icon: Heart, prompt: t.feelingsPrompt },
    { id: 'tarot', title: t.tarotReading, Icon: Sparkles, prompt: null },
    { id: 'astrology', title: t.birthChart, Icon: Stars, prompt: null },
    { id: 'meditation', title: t.recommend, Icon: BookOpen, prompt: t.recommendPrompt },
    { id: 'dream', title: t.dream, Icon: Moon, prompt: t.dreamPrompt }
  ];
  return <div className="luna2-ai-actions" aria-label={t.ideas}>{actions.map(({ id, title, Icon, prompt }) => {
    const openTarot=id==='tarot'?onTarot:undefined;
    return <button type="button" key={id} data-action={id} disabled={disabled || (!prompt&&!openTarot)} onClick={() => openTarot?openTarot():prompt&&onPrompt(prompt)}>
      <Icon size={20} /><span>{title}</span>{!prompt&&!openTarot ? <small>{t.soon}</small> : null}
    </button>;
  })}</div>;
}
