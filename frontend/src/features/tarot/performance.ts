/** Local bounded diagnostics: no card/question/user IDs, no network logging. */
type Timing={phase:'selection_to_paint'|'reveal_request'|'interpretation_request';milliseconds:number;cards:1|3|5};
const recent:Timing[]=[];
export function recordTarotTiming(phase:Timing['phase'],started:number,cards:Timing['cards']){
 const sample={phase,milliseconds:Math.max(0,Math.round(performance.now()-started)),cards};recent.push(sample);if(recent.length>30)recent.shift();return sample;
}
export const tarotTimingSnapshot=()=>recent.map(row=>({...row}));
