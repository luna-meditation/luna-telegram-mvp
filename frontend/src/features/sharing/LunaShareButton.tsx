import {lazy,Suspense,useState} from 'react';
import {Share2} from 'lucide-react';
import type {AppLanguage} from '../../api';
import type {ShareCardContent} from './shareCard';
const Sheet=lazy(()=>import('./ShareCardSheet').then(module=>({default:module.ShareCardSheet})));
export function LunaShareButton({content,language,registerBackHandler}:{content:ShareCardContent;language:AppLanguage;registerBackHandler?:(handler:(()=>void)|null)=>void}){
 const [open,setOpen]=useState(false);
 return <><button type="button" className="luna30-share-trigger" onClick={()=>setOpen(true)}><Share2 size={17}/>{language==='ru'?'Поделиться открыткой':'Share a card'}</button>{open&&<Suspense fallback={<p role="status">{language==='ru'?'Готовим открытку…':'Preparing your card…'}</p>}><Sheet content={content} language={language} onClose={()=>setOpen(false)} registerBackHandler={registerBackHandler}/></Suspense>}</>;
}
