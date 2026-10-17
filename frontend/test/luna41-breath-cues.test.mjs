import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
const ts=(await import('typescript')).default,read=p=>readFileSync(new URL('../src/features/breathing/'+p,import.meta.url),'utf8'),assets=JSON.parse(read('voiceAssets.json'));
const compile=source=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64');
const practices=compile(read('practices.ts')),catalog=compile(read('voiceCatalog.ts').replace("from './practices'",`from '${practices}'`).replace("import voiceAssets from './voiceAssets.json';",'const voiceAssets='+JSON.stringify(assets)+';'));
const playerSource=read('BreathCuePlayer.ts').replace("import voiceAssets from './voiceAssets.json';",'const voiceAssets='+JSON.stringify(assets)+';').replace("from './voiceCatalog'",`from '${catalog}'`),{BreathCuePlayer}=await import(compile(playerSource));
test('ten local cue assets preserve exact verified hashes, PCM format and sub-phase duration',()=>{
 assert.equal(assets.aiGenerated,true);for(const language of ['en','ru']){assert.equal(Object.keys(assets.clips[language]).length,5);for(const clip of Object.values(assets.clips[language])){
  const bytes=readFileSync(new URL('../public'+clip.url,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),clip.sha256);assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WAVE');assert.equal(bytes.readUInt16LE(20),1);assert.equal(bytes.readUInt16LE(22),1);assert.equal(bytes.readUInt32LE(24),24000);assert.equal(bytes.readUInt16LE(34),16);assert.equal((bytes.length-44)/48000,clip.durationSeconds);assert.ok(clip.durationSeconds>0&&clip.durationSeconds<2);
 }}assert.doesNotMatch(playerSource,/setInterval|setTimeout|requestAnimationFrame|api\.openai|speechSynthesis/);
});
test('actual session cues play once per boundary, skip late phases and stop on pause/unmount',async()=>{
 const originalWindow=globalThis.window,originalFetch=globalThis.fetch,started=[];let stops=0,closed=0,resumes=0;
 class Context{destination={};createGain(){return{gain:{value:1},connect(){},disconnect(){}};}resume(){resumes++;return Promise.resolve();}close(){closed++;return Promise.resolve();}decodeAudioData(bytes){return Promise.resolve({duration:(bytes.byteLength-44)/48000});}createBufferSource(){const source={buffer:null,connect(){},start(){started.push(source.buffer);},stop(){stops++;}};return source;}}
 globalThis.window={AudioContext:Context};globalThis.fetch=async url=>{const b=readFileSync(new URL('../public'+url,import.meta.url));return{ok:true,arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)};};
 try{let errors=0;const p=new BreathCuePlayer(()=>errors++);p.start('ru');await Promise.all(p.loading.values());p.volume(.25);assert.equal(p.gain.gain.value,.25);
  for(const time of [.1,.2,.4,4.1,4.2,8.1,12.1])p.cue('box','ru',time);assert.equal(started.length,4);assert.equal(errors,0);assert.ok(resumes>=1);
  p.cue('box','ru',16.9);p.cue('box','ru',17.1);assert.equal(started.length,4,'A late cue is not replayed later');p.pause();p.cue('box','ru',20.1);assert.equal(started.length,4);assert.ok(stops>0);
  p.start('ru');p.cue('box','ru',20.1);assert.equal(started.length,5);p.close();p.cue('box','ru',24.1);assert.equal(started.length,5);assert.equal(closed,1);
 }finally{globalThis.window=originalWindow;globalThis.fetch=originalFetch;}
});
test('a corrupt file disables guidance rather than playing a partial cue set',async()=>{
 const originalWindow=globalThis.window,originalFetch=globalThis.fetch;let errors=0;
 class Context{resume(){return Promise.resolve();}close(){return Promise.resolve();}decodeAudioData(){throw Error('must verify hash first');}createBufferSource(){throw Error('must not play');}}
 globalThis.window={AudioContext:Context};globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(44)});
 try{const p=new BreathCuePlayer(()=>errors++);p.start('en');await Promise.allSettled(p.loading.values());await Promise.resolve();p.cue('calm','en',.1);assert.equal(p.ready.size,0);assert.equal(p.running,false);assert.equal(errors,1);p.close();}finally{globalThis.window=originalWindow;globalThis.fetch=originalFetch;}
});
