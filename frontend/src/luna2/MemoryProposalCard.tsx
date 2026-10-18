import {useState} from 'react';
import {decideMemoryProposal,type MemoryProposal,type AppLanguage} from '../api';
import {cosmosAreas} from '../../../backend/src/luna41-cosmos-policy';
import {readCosmosDomain} from '../../../backend/src/luna42-cosmos-domain';
export function MemoryProposalCard({messageId,proposal,language,initData,disabled,onUpdate}:{messageId:string;proposal:MemoryProposal;language:AppLanguage;initData?:string;disabled:boolean;onUpdate:(proposal:MemoryProposal)=>void}){
 const en=language==='en',[busy,setBusy]=useState(false),[error,setError]=useState(false);
 const area=cosmosAreas.find(a=>'cosmos_'+a.id===proposal.key),expired=Date.parse(proposal.expiresAt)<Date.now();
 const fields=en?{status:'Current situation',priority:'Priority',details:'Details',goal:'Goal'}:{status:'Сейчас',priority:'Приоритет',details:'Подробности',goal:'Цель'};
 const text=(value:string|null)=>value===null?<p>{en?'No entry':'Нет записи'}</p>:area?<dl>{Object.entries(readCosmosDomain(value)).filter(([key,value])=>key!=='format'&&value).map(([key,value])=><div key={key}><dt>{fields[key as keyof typeof fields]}</dt><dd>{value}</dd></div>)}</dl>:<p>{value}</p>;
 async function decide(confirmed:boolean){if(busy||disabled)return;setBusy(true);setError(false);try{const result=await decideMemoryProposal(messageId,proposal.id,confirmed,initData);onUpdate(result.proposal);}catch{setError(true);}finally{setBusy(false);}}
 return <section className="luna42-memory-proposal" data-testid="memory-proposal" aria-label={en?'Review memory change':'Проверить изменение памяти'}>
  <h4>{area?.[language]??proposal.key.split('_').join(' ')}</h4>
  {proposal.state==='pending'?<><p>{proposal.operation==='delete'?(en?'Remove this entry from My Cosmos? Conversation history is managed separately.':'Удалить эту запись из «Моего космоса»? История разговоров удаляется отдельно.'):(en?'Save this information exactly as shown? AI personalization permissions stay unchanged.':'Сохранить сведения именно в таком виде? Разрешения на персонализацию AI не изменятся.')}</p>
   {proposal.before!==null&&<details><summary>{en?'Previously saved':'Сохранено сейчас'}</summary>{text(proposal.before)}</details>}
   {proposal.operation==='save'&&<div className="luna42-memory-preview">{text(proposal.after)}</div>}
   <div className="universe-actions"><button type="button" className="luna-button-primary" disabled={busy||disabled||expired} onClick={()=>void decide(true)}>{busy?(en?'Saving…':'Сохранение…'):proposal.operation==='delete'?(en?'Confirm deletion':'Подтвердить удаление'):(en?'Confirm and save':'Подтвердить и сохранить')}</button><button type="button" disabled={busy||disabled||expired} onClick={()=>void decide(false)}>{en?'Cancel':'Отмена'}</button></div>
   {expired&&<p role="status">{en?'This proposal expired. Review the latest entry in My Cosmos.':'Предложение устарело. Проверь актуальные сведения в «Моём космосе».'}</p>}
  </>:<p role="status">{proposal.state==='cancelled'?(en?'Cancelled · no memory changed':'Отменено · память не изменена'):proposal.operation==='delete'?(en?'Deleted · excluded from future AI context':'Удалено · исключено из будущего AI-контекста'):(en?'Saved in My Cosmos':'Сохранено в «Моём космосе»')}</p>}
  {error&&<p role="alert">{en?'Could not confirm. The entry may have changed, or privacy settings were updated. Retry to check the saved outcome, or review My Cosmos.':'Не удалось подтвердить. Возможно, запись или настройки приватности изменились. Повтори, чтобы проверить результат, или открой «Мой космос».'}</p>}
  <button type="button" disabled={busy} onClick={()=>window.dispatchEvent(new Event('luna-open-universe'))}>{en?'Review / edit in My Cosmos':'Проверить / изменить в «Моём космосе»'} →</button>
 </section>;
}
