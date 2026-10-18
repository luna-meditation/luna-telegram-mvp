import type {EditorialBody} from '../../../../backend/src/luna42-editorial-contract';
export type ShareFormat='story'|'square'|'portrait';
export const shareSizes={story:[1080,1920],square:[1080,1080],portrait:[1080,1350]} as const;
// Deliberately not a Reading, Profile or Conversation object. No private fields.
export type ShareCardContent={kind:'app'|'tarot'|'garden'|'achievement'|'natal'|'compatibility';title:string;subtitle:string;image?:string;badge?:string;tarot?:Array<{image:string;title:string;orientation:'upright'|'reversed'}>;celestial?:{names:string[];highlights:string[]};reference?:string;secondReference?:string};
export function publicShareContent(input:ShareCardContent,approvedArtwork:readonly string[]=[]):ShareCardContent {
 if(!['app','tarot','garden','achievement','natal','compatibility'].includes(input.kind))throw new Error('Unsupported public card');
 const plain=(v:string,max:number)=>v.replace(/[\u0000-\u001f]/g,' ').trim().slice(0,max);
 const image=input.image;
 if(image&&(!/^\/(assets\/(tarot\/cards\/|moon-garden\/)|images\/(home\/|achievements\/luna34\/))[a-zA-Z0-9/_-]+\.(webp|png|jpe?g)$/.test(image)&&!approvedArtwork.includes(image)||image.includes('..')))throw new Error('Share artwork must be an existing local or server-verified published Luna asset');
 const celestial=input.celestial?{names:input.celestial.names.slice(0,2).map(value=>plain(value,32)),highlights:input.celestial.highlights.slice(0,3).map(value=>plain(value,65))}:undefined;
 const tarot=input.tarot?.map(card=>{if(input.kind!=='tarot'||![1,3,5].includes(input.tarot!.length)||!['upright','reversed'].includes(card.orientation))throw new Error('Invalid spread');const safe=publicShareContent({kind:'tarot',title:card.title,subtitle:'',image:card.image},approvedArtwork);return{image:safe.image!,title:plain(card.title,60),orientation:card.orientation};});
 // References authenticate export evidence only; never serialize them into the public image.
 return {kind:input.kind,title:plain(input.title,100),subtitle:plain(input.subtitle,220),...(image?{image}:{}),...(input.badge?{badge:plain(input.badge,70)}:{}),...(celestial?{celestial}:{}),...(tarot?{tarot}:{})};
}
export async function renderShareCard(input:ShareCardContent,format:ShareFormat,language:'en'|'ru'='en',editorial?:Pick<EditorialBody,'title'|'description'>,approvedArtwork:readonly string[]=[]):Promise<Blob>{
 const content=publicShareContent(input,approvedArtwork),[width,height]=shareSizes[format],canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Image export is unavailable');
 await document.fonts.ready;
 const bg=ctx.createLinearGradient(0,0,width,height);bg.addColorStop(0,'#14152e');bg.addColorStop(1,'#30213e');ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);
 ctx.strokeStyle='#d0b88b66';ctx.lineWidth=2;ctx.strokeRect(43,43,width-86,height-86);
 ctx.fillStyle='#e7d2a2';ctx.font='500 34px system-ui';ctx.textAlign='center';ctx.fillText(editorial?.title[language]??'L U N A',width/2,113,width-170);
 // Fixed constellation pattern, reproducible without a network AI call.
 for(let i=0;i<32;i++){const x=70+(i*197%940),y=160+(i*89%Math.max(100,height-300));ctx.globalAlpha=.2+(i%4)*.12;ctx.beginPath();ctx.arc(x,y,1.5+i%2,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
 const wrap=(text:string,y:number,font:number,maxWidth:number,maxLines:number)=>{ctx.font=`500 ${font}px system-ui`;const words=text.split(/\s+/),lines:string[]=[];let line='';for(const word of words){const next=line?line+' '+word:word;if(ctx.measureText(next).width>maxWidth&&line){lines.push(line);line=word;}else line=next;}if(line)lines.push(line);const visible=lines.slice(0,maxLines);if(lines.length>maxLines)visible[maxLines-1]+='…';for(let i=0;i<visible.length;i++){while(ctx.measureText(visible[i]).width>maxWidth&&visible[i].length>1)visible[i]=visible[i].replace(/…$/,'').slice(0,-1)+'…';ctx.fillText(visible[i],width/2,y+i*font*1.32);}return y+visible.length*font*1.32;};
 let textY=210;
 if(content.kind==='natal'||content.kind==='compatibility'){
  const centerY=format==='square'?300:format==='portrait'?460:650,r=format==='square'?180:format==='portrait'?230:300;
  const wheel=(x:number,y:number,radius:number)=>{const glow=ctx.createRadialGradient(x,y,30,x,y,radius*1.3);glow.addColorStop(0,'#d0a1df33');glow.addColorStop(.7,'#5b4eaf35');glow.addColorStop(1,'#13182c00');ctx.fillStyle=glow;ctx.fillRect(x-radius*1.4,y-radius*1.4,radius*2.8,radius*2.8);ctx.lineWidth=2;for(const scale of [1,.84,.62]){ctx.strokeStyle=scale===.84?'#d9b976cc':'#c6a4dd88';ctx.beginPath();ctx.arc(x,y,radius*scale,0,Math.PI*2);ctx.stroke();}for(let i=0;i<12;i++){const a=i*Math.PI/6;ctx.beginPath();ctx.moveTo(x+Math.cos(a)*radius*.84,y+Math.sin(a)*radius*.84);ctx.lineTo(x+Math.cos(a)*radius,y+Math.sin(a)*radius);ctx.stroke();ctx.fillStyle='#e0c58e';ctx.beginPath();ctx.arc(x+Math.cos(a)*radius*.72,y+Math.sin(a)*radius*.72,4,0,Math.PI*2);ctx.fill();}ctx.fillStyle='#f0d49c';ctx.font='64px system-ui';ctx.fillText('☾',x,y+20);};
  if(content.kind==='natal')wheel(width/2,centerY,r);else{wheel(width*.32,centerY,r);wheel(width*.68,centerY,r);ctx.strokeStyle='#e0bb7888';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(width/2,centerY,270,80,-.25,0,Math.PI*2);ctx.stroke();}
  textY=centerY+r+55;
  if(content.celestial?.names.length){ctx.fillStyle='#e6cee9';textY=wrap(content.celestial.names.join(' · '),textY,35,width-170,1)+15;}
  if(content.celestial?.highlights.length){ctx.fillStyle='#e8ce9b';textY=wrap(content.celestial.highlights.join(' · '),textY,29,width-170,2)+15;}
 }
 if(content.tarot?.length){
  const count=content.tarot.length,rows=count===5&&format!=='square'?2:1,cols=rows===2?3:count;
  const boxH=height-(format==='square'?510:570),rowH=boxH/rows,cellW=(width-150)/cols;
  const images=await Promise.all(content.tarot.map(async card=>{const img=new Image();img.crossOrigin='anonymous';img.decoding='async';await new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(new Error('Artwork could not load'));img.src=card.image;});return img;}));
  images.forEach((img,i)=>{const row=Math.floor(i/cols),col=i%cols,itemsInRow=Math.min(cols,count-row*cols),x=width/2+(col-(itemsInRow-1)/2)*cellW,top=175+row*rowH,ratio=Math.min((cellW-20)/img.naturalWidth,(rowH-72)/img.naturalHeight),w=img.naturalWidth*ratio,h=img.naturalHeight*ratio;ctx.drawImage(img,x-w/2,top,w,h);ctx.fillStyle='#f2e9f4';ctx.font=`500 ${count===5&&format==='square'?21:25}px system-ui`;ctx.fillText(content.tarot![i].title,x,top+h+30,cellW-12);ctx.fillStyle='#e7d2a2';ctx.font='21px system-ui';const reversed=content.tarot![i].orientation==='reversed';ctx.fillText(language==='ru'?(reversed?'↶ Перевёрнутая':'Прямая'):(reversed?'↶ Reversed':'Upright'),x,top+h+57,cellW-12);});
  textY=boxH+235;
 }else if(content.image){const img=new Image();img.crossOrigin='anonymous';img.decoding='async';await new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(new Error('Artwork could not load'));img.src=content.image!;});const boxH=height-(format==='square'?510:570),boxW=width-190,ratio=Math.min(boxW/img.naturalWidth,boxH/img.naturalHeight),w=img.naturalWidth*ratio,h=img.naturalHeight*ratio;ctx.drawImage(img,(width-w)/2,175+(boxH-h)/2,w,h);textY=boxH+235;}
 ctx.fillStyle='#fbf3f9';textY=wrap(content.title,textY,format==='story'?54:48,width-150,2)+23;ctx.fillStyle='#d8cee2';textY=wrap(content.subtitle,textY,33,width-170,3)+22;
 if(content.badge){ctx.fillStyle='#e7d2a2';wrap(content.badge,Math.min(textY,height-170),28,width-170,2);}
 ctx.fillStyle='#d0b88b';ctx.font='28px system-ui';ctx.fillText(editorial?.description[language]??(/[А-Яа-яЁё]/.test(content.title)?'Luna · пространство самопознания':'Luna · a space for self-discovery'),width/2,height-90,width-170);
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Image export failed')),'image/png'));
}
