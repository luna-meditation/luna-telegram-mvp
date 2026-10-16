export type ShareFormat='story'|'square'|'portrait';
export const shareSizes={story:[1080,1920],square:[1080,1080],portrait:[1080,1350]} as const;
// Deliberately not a Reading, Profile or Conversation object. No private fields.
export type ShareCardContent={kind:'app'|'tarot'|'garden'|'achievement';title:string;subtitle:string;image?:string;badge?:string};
export function publicShareContent(input:ShareCardContent):ShareCardContent {
 if(!['app','tarot','garden','achievement'].includes(input.kind))throw new Error('Unsupported public card');
 const plain=(v:string,max:number)=>v.replace(/[\u0000-\u001f]/g,' ').trim().slice(0,max);
 const image=input.image;
 if(image&&(!/^\/(assets\/(tarot\/cards\/|moon-garden\/)|images\/home\/)[a-zA-Z0-9/_-]+\.(webp|png|jpe?g)$/.test(image)||image.includes('..')))throw new Error('Share artwork must be an existing local Luna asset');
 return {kind:input.kind,title:plain(input.title,100),subtitle:plain(input.subtitle,220),...(image?{image}:{}),...(input.badge?{badge:plain(input.badge,70)}:{})};
}
export async function renderShareCard(input:ShareCardContent,format:ShareFormat):Promise<Blob>{
 const content=publicShareContent(input),[width,height]=shareSizes[format],canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Image export is unavailable');
 await document.fonts.ready;
 const bg=ctx.createLinearGradient(0,0,width,height);bg.addColorStop(0,'#14152e');bg.addColorStop(1,'#30213e');ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);
 ctx.strokeStyle='#d0b88b66';ctx.lineWidth=2;ctx.strokeRect(43,43,width-86,height-86);
 ctx.fillStyle='#e7d2a2';ctx.font='500 34px system-ui';ctx.textAlign='center';ctx.fillText('L U N A',width/2,113);
 // Fixed constellation pattern, reproducible without a network AI call.
 for(let i=0;i<32;i++){const x=70+(i*197%940),y=160+(i*89%Math.max(100,height-300));ctx.globalAlpha=.2+(i%4)*.12;ctx.beginPath();ctx.arc(x,y,1.5+i%2,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
 const wrap=(text:string,y:number,font:number,maxWidth:number,maxLines:number)=>{ctx.font=`500 ${font}px system-ui`;const words=text.split(/\s+/);let line='',count=0;for(const word of words){const next=line?line+' '+word:word;if(ctx.measureText(next).width>maxWidth&&line){ctx.fillText(line,width/2,y+count*font*1.32);count++;line=word;if(count>=maxLines-1)break;}else line=next;}if(line)ctx.fillText(line,width/2,y+count*font*1.32);return y+(count+1)*font*1.32;};
 let textY=210;
 if(content.image){const img=new Image();img.decoding='async';await new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(new Error('Artwork could not load'));img.src=content.image!;});const boxH=height-(format==='square'?510:570),boxW=width-190,ratio=Math.min(boxW/img.naturalWidth,boxH/img.naturalHeight),w=img.naturalWidth*ratio,h=img.naturalHeight*ratio;ctx.drawImage(img,(width-w)/2,175+(boxH-h)/2,w,h);textY=boxH+235;}
 ctx.fillStyle='#fbf3f9';textY=wrap(content.title,textY,format==='story'?54:48,width-150,2)+23;ctx.fillStyle='#d8cee2';textY=wrap(content.subtitle,textY,33,width-170,3)+22;
 if(content.badge){ctx.fillStyle='#e7d2a2';wrap(content.badge,Math.min(textY,height-170),28,width-170,2);}
 ctx.fillStyle='#d0b88b';ctx.font='28px system-ui';ctx.fillText(/[А-Яа-яЁё]/.test(content.title)?'Luna · пространство самопознания':'Luna · a space for self-discovery',width/2,height-90);
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Image export failed')),'image/png'));
}
