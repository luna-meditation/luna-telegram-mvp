import {useEffect,useState} from 'react';import {getLuna35Funnel} from '../api';
export function Luna35FunnelPanel({initData}:{initData?:string}){
 const [data,setData]=useState<Awaited<ReturnType<typeof getLuna35Funnel>>|null>(null),[error,setError]=useState(false);
 useEffect(()=>{let alive=true;void getLuna35Funnel(initData).then(r=>{if(alive)setData(r);}).catch(()=>{if(alive)setError(true);});return()=>{alive=false;};},[initData]);
 return <details><summary>Luna 3.5 · private onboarding funnel</summary>{error?<p>Aggregate funnel is unavailable. No private content is exposed.</p>:!data?<p>Loading…</p>:<><p>{data.note}</p><p>Recorded since {new Date(data.since).toLocaleDateString()}; no historical funnel is invented.</p><ul>{data.groups.map(row=><li key={row.event+row.source}><strong>{row.event}</strong> · {row.source}: {row.events} events / {row.accounts} accounts</li>)}</ul></>}</details>;
}
