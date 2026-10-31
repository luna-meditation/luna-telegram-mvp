/** Telegram expansion, browser chrome and pinch zoom are not a keyboard. */
export function viewportGeometry(input:{visualHeight:number;innerHeight:number;telegramHeight?:number;stableHeight?:number;offsetTop:number;scale:number;editableFocused:boolean}){
 const visible=Math.max(1,Math.min(input.visualHeight,input.telegramHeight||input.innerHeight));
 const gap=Math.max(0,(input.stableHeight||input.innerHeight)-visible-input.offsetTop);
 const keyboardOpen=input.editableFocused&&Math.abs(input.scale-1)<.05&&gap>120;
 return {height:Math.round(visible),offsetTop:Math.round(input.offsetTop),keyboardInset:keyboardOpen?Math.round(gap):0,keyboardOpen};
}
