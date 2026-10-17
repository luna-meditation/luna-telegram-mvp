export const audioFocusEvent='luna-practice-audio-focus';
/** Playback and microphone capture share one focus channel, including detached
 * HTMLAudioElement and Web Audio sources registered by their owning feature.
 * Losing focus never auto-resumes a prior sound or an interrupted practice. */
export function observeAudioFocus(owner:string,pause:()=>void){
 const changed=(event:Event)=>{if((event as CustomEvent<{owner?:string}>).detail?.owner!==owner)pause();};
 window.addEventListener(audioFocusEvent,changed);return()=>window.removeEventListener(audioFocusEvent,changed);
}
export function requestAudioFocus(owner:string,keep?:HTMLMediaElement|null){
 window.dispatchEvent(new CustomEvent(audioFocusEvent,{detail:{owner}}));
 for(const audio of document.querySelectorAll<HTMLMediaElement>('audio,video'))if(audio!==keep&&!audio.paused)audio.pause();
}
