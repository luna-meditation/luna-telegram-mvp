import {messagesAfterContextReset,type AstrologyAttachment} from './luna31-consultation.js';
export function recordedAstrologyConsent(messages:Array<{role:string;metadata?:unknown}>,attachment:AstrologyAttachment){
 return messagesAfterContextReset(messages).some(m=>{const c=(m.metadata as {astrologyConsent?:{version?:number;chartId?:string;secondChartId?:string}}|undefined)?.astrologyConsent;return m.role==='assistant'&&c?.version===1&&c.chartId===attachment.chartId&&(c.secondChartId??null)===(attachment.secondChartId??null);});
}
