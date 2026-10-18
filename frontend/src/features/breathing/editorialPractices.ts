import {useMemo} from 'react';
import {breathPractices} from './practices';
import {useEditorialEntries} from '../../editorial';
export function useBreathPractices(){const entries=useEditorialEntries();return useMemo(()=>breathPractices.map(p=>{const e=entries.find(e=>e.kind==='breathwork'&&e.key===p.id);return e?.body.phases&&e.body.guide?{...p,name:e.body.title,description:e.body.description,guide:e.body.guide,phases:e.body.phases.map(v=>({...v})),timing:{en:e.body.phases.map(v=>v.seconds).join(' · '),ru:e.body.phases.map(v=>v.seconds).join(' · ')}}:p;}),[entries]);}
