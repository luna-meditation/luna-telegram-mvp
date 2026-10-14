// Offline UI preview only. Never connects to Supabase, Telegram, OpenAI or payment APIs.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

assert.equal(process.versions.node.split('.')[0], '22', 'Use Node.js 22');
const frontend = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tarotPreview = process.argv.includes('--tarot');
const luna21Preview=process.argv.includes('--luna21');
const refinementPreview=process.argv.includes('--refinement')||luna21Preview;
const legacyPreview = process.argv.includes('--legacy');
assert.ok(!(tarotPreview&&legacyPreview),'Choose either Tarot or legacy preview');
const outputDirectory = refinementPreview?'dist-refinement-preview':legacyPreview ? 'dist' : tarotPreview ? 'dist-tarot-preview' : 'dist-phase2';
const output = resolve(frontend, outputDirectory);
const flagNames = ['NEW_NAVIGATION','TAROT_DAILY','TAROT_SPREADS','ASTROLOGY','MOON_SEEDS_WALLET_V2','MOON_SEEDS_PURCHASES','BREATHWORK_AUDIO','PERSONALIZATION','AI_MODES','TAROT_HISTORY','TAROT_AI','DAILY_CARD_V2','ECONOMY_REWARDS_V2','TAROT_PAID_READINGS','PREMIUM_V2'];
const build = spawn(process.execPath,[resolve(frontend,'node_modules/vite/bin/vite.js'),'build','--outDir',outputDirectory],{
  cwd:frontend, stdio:'inherit', env:{...process.env,...Object.fromEntries(flagNames.map(key=>[`VITE_FEATURE_${key}`,'false'])),...(refinementPreview?Object.fromEntries(['PERSONALIZATION','AI_MODES','TAROT_HISTORY','TAROT_AI'].map(key=>[`VITE_FEATURE_${key}`,'true'])):{}),...(luna21Preview?{VITE_FEATURE_DAILY_CARD_V2:'true',VITE_FEATURE_TAROT_SPREADS:'true'}:{}),VITE_FEATURE_NEW_NAVIGATION:legacyPreview?'false':'true',VITE_FEATURE_TAROT_DAILY:tarotPreview||refinementPreview?'true':'false',VITE_API_URL:'',VITE_BOT_USERNAME:''}
});
const code = await new Promise(done=>build.once('exit',done));
assert.equal(code,0,'Preview build failed');
if(process.argv.includes('--build-only'))process.exit(0);
const date = (d=new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const monday=new Date();monday.setDate(monday.getDate()-((monday.getDay()+6)%7));
const meditation={id:'00000000-0000-4000-8000-000000000001',title:'A quiet return',subtitle:'Come back to the present moment',description:'Offline QA practice. The audio is a silent local fixture, not a production meditation.',category:'calm',duration:180,cover_image:'/images/home/hero-night.png',audio_file:'/preview-audio.wav',premium:false,published:true,mood:'Calm',play_count:24,created_at:new Date().toISOString(),translations:{ru:{title:'Тихое возвращение',subtitle:'Вернись в настоящий момент',description:'Локальная QA-практика. Аудио — тестовая тишина, не production-медитация.'}}};
const user={first_name:'Alex',language_code:'en',lifetime_access:true,active_until:'2000-01-01',profile_goals:[]};
const profile={user,currentWeek:{weekStart:date(monday),activeDays:3,practiceDays:3,completedDays:3,completedSessions:10,listeningMinutes:42,days:[]},completed:10,completedMeditations:10,dayStreak:5,currentStreak:5,longestStreak:10,minutesListened:100,purchasedPlan:'Lifetime',calmScore:20,rewards:{7:true,14:false,30:false,100:false},moonSeeds:123,moonSeedsAvailable:123,moonSeedsEarnedTotal:345,gardenLevel:3,plantedGardenElements:[],achievements:{unlocked:3,total:10,items:[]}};
let checkin=null;const messages=[];const conversation={id:'offline-qa',title:'Offline UI preview',created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
const emptyPersonal={interests:[],preferences:'',birth_date:null,birth_time:null,birth_place:null,ai_context_consent:false};let personal={...emptyPersonal};const readings=new Map();let generated=0;
if(refinementPreview)profile.gardenAtomicReady=true;
if(refinementPreview)profile.journeyStatus={id:'adept',rank:2,earned:true,eligibleRank:2,next:{id:'guardian',rank:3,progressPercent:75,remaining:[{key:'completedMeditations',current:10,target:20,remaining:10}]}};
const bridge=`<script>window.Telegram??={WebApp:{initData:'offline-local-qa',initDataUnsafe:{user:{id:880000002,first_name:'Alex',language_code:'en'}},platform:'web',ready(){},expand(){},onEvent(){},offEvent(){},setHeaderColor(){},setBackgroundColor(){},setBottomBarColor(){}}};</script>`;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.wav':'audio/wav','.webmanifest':'application/manifest+json'};
function silentAudio(){const samples=8000*180;const wav=Buffer.alloc(44+samples*2);wav.write('RIFF');wav.writeUInt32LE(36+samples*2,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(samples*2,40);return wav;}
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  const json=(data,status=200)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store','x-luna-preview':'synthetic-local-only'});res.end(JSON.stringify(data));};
  try {
    if(url.pathname.startsWith('/api/')){
      let body={};if(req.method!=='GET'){let input='';for await(const part of req){input+=part;if(input.length>20000)return json({error:'Preview input too large'},413);}if(input)body=JSON.parse(input);}
      if(url.pathname==='/api/users/sync')return json({user});
      if(refinementPreview&&url.pathname==='/api/personalization'){
        if(req.method==='PUT')personal={...body};if(req.method==='DELETE'){personal={...emptyPersonal};return json({ok:true});}return json(personal);
      }
      if(refinementPreview&&url.pathname==='/api/moon-garden/plant'&&req.method==='POST'){
        if(profile.plantedGardenElements.includes(body.elementId))return json({profile});if(profile.moonSeedsAvailable<10)return json({error:'Not enough preview seeds'},400);
        profile.plantedGardenElements.push(body.elementId);profile.gardenLevel=profile.plantedGardenElements.length;profile.moonSeedsAvailable-=10;profile.moonSeeds=profile.moonSeedsAvailable;return json({profile});
      }
      if(refinementPreview&&url.pathname==='/api/tarot/readings'){
        if(req.method==='GET'){const rows=[...readings.values()].reverse();const offset=Number(url.searchParams.get('offset')||0);return json({readings:rows.slice(offset,offset+20),nextOffset:rows.length>offset+20?offset+20:null});}
        let reading=readings.get(body.clientReadingId);if(!reading){reading={id:randomUUID(),client_reading_id:body.clientReadingId,card_id:body.cardId,orientation:body.orientation,intention:body.intention,question:body.question,language:body.language,interpretation:null,status:'local',fallback_reason:null,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};readings.set(body.clientReadingId,reading);}
        if(body.generate&&reading.status==='local'){
          if(generated>=2)return json({reading,reason:'daily_limit'});generated++;
          if(/error|ошибка/i.test(body.question)){reading.status='fallback';reading.fallback_reason='provider_error';}
          else{const en=body.language==='en';reading.status='ready';reading.interpretation={summary:en?'OFFLINE QA — not a real AI answer.':'ЛОКАЛЬНЫЙ QA — не настоящий ответ AI.',cardMeaning:en?'Fixture for testing card meaning layout.':'Тестовая строка для отображения значения карты.',context:en?'Fixture for testing question layout.':'Тестовая строка для отображения контекста вопроса.',reflection:en?'No OpenAI request was sent.':'Запрос в OpenAI не отправлялся.',question:en?'Does the mobile interface remain readable?':'Удобно ли читать интерфейс на телефоне?',continuation:null};}
        }return json({reading,reason:null});
      }
      if(refinementPreview&&url.pathname.startsWith('/api/tarot/readings/')&&req.method==='DELETE'){for(const[key,value]of readings)if(value.id===url.pathname.split('/').pop())readings.delete(key);return json({ok:true});}
      if(luna21Preview&&url.pathname==='/api/tarot/daily'){
        const day=new Date().toISOString().slice(0,10),key=`daily:${day}`;
        if(body.generate&&body.expectedDay!==day)return json({code:'daily_changed'},409);
        let reading=readings.get(key);
        if(!reading){reading={id:randomUUID(),client_reading_id:randomUUID(),card_id:'the-star',orientation:'reversed',reading_kind:'daily',cards:[{cardId:'the-star',orientation:'reversed'}],intention:'general',question:'',language:body.language,status:'local',interpretation:null,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};readings.set(key,reading);}
        if(body.generate&&reading.status==='local'){reading.status='ready';reading.interpretation={summary:'OFFLINE QA — not a real AI answer.',cardMeaning:'Synthetic daily card layout.',context:'Synthetic context layout.',reflection:'No paid request was sent.',question:'Is this comfortable to read?',continuation:null};}
        return json({reading,day,timezone:'UTC',resetsAt:new Date(Date.parse(day+'T00:00:00Z')+86400000).toISOString(),reason:null});
      }
      if(luna21Preview&&url.pathname==='/api/tarot/spreads'){
        const input=body.reading;let reading=readings.get(input.clientReadingId);
        if(!reading){reading={id:randomUUID(),client_reading_id:input.clientReadingId,card_id:input.cards[0].cardId,orientation:input.cards[0].orientation,reading_kind:input.kind,cards:input.cards,intention:input.intention,question:input.question,language:input.language,status:'local',interpretation:null,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};readings.set(input.clientReadingId,reading);}
        if(input.generate&&reading.status==='local'){reading.status='ready';reading.interpretation={summary:'OFFLINE QA — not a real AI answer.',cardMeaning:'Synthetic connected spread.',context:'Synthetic question context.',reflection:'No payment or OpenAI call was made.',question:'Is the composition readable?',continuation:null,cardInsights:input.cards.map(c=>({cardId:c.cardId,text:'Synthetic card-position text, not an AI interpretation.'})),links:'Synthetic connection text for mobile layout only.'};}
        return json({reading,reason:null});
      }
      if(url.pathname==='/api/profile/language'&&req.method==='POST'){
        if(!['en','ru'].includes(body.language))return json({error:'Unsupported preview language'},400);
        user.language_code=body.language;return json({user});
      }
      if(url.pathname==='/api/checkins'&&req.method==='POST'){checkin={id:'offline-checkin',...body,local_date:body.local_date||date()};return json({checkin});}
      if(url.pathname==='/api/luna/chat'&&req.method==='POST'){
        const message={id:randomUUID(),role:'assistant',content:body.language==='ru'?'Это локальный UI preview. Реальный запрос к AI не отправлялся.':'This is an offline UI preview. No actual AI request was sent.',created_at:new Date().toISOString(),metadata:{}};
        messages.push({id:randomUUID(),role:'user',content:body.message,created_at:new Date().toISOString()},message);return json({conversationId:conversation.id,message,duplicate:false,remaining:7,requestState:'completed'});
      }
      if(req.method!=='GET')return json({error:'This action is unavailable in the offline preview. No production records were changed.'},501);
      const fixtures={
        '/api/access/me':{hasPremium:true,plan:'Lifetime',user},'/api/profile/me':profile,'/api/meditations':{meditations:[meditation]},'/api/categories':{categories:[{id:'calm',name:'Calm',slug:'calm',sort_order:1}]},'/api/favorites':{favorites:[]},'/api/history':{history:[{id:'offline-history',meditation_id:meditation.id,last_played:new Date().toISOString(),play_count:2,completion_percent:100,last_position:180,completed:true}]},
        '/api/payments/recent':{payments:[]},'/api/wellness/summary':{todayCheckin:checkin,weeklyCheckins:checkin?[checkin]:[],weeklyCheckinCount:checkin?1:0,achievements:[],level:{title:'Seeker',current:1,progress:20,next:'Adept'}},
        '/api/luna/conversations':{conversations:messages.length?[conversation]:[]},'/api/luna/conversations/offline-qa':{conversation,messages},'/api/luna/health':{available:true,enabled:true,model:'offline-fixture',errorClass:null},'/api/luna/memory':{enabled:true,available:true,memories:[]},
        '/api/plans':{plans:{annual:{id:'annual',title:'Annual Premium',amountStars:750,days:365},lifetime:{id:'lifetime',title:'Lifetime Access',amountStars:2499}}}
      };
      if(url.pathname==='/api/admin/me')return json({error:'Offline preview has no admin access'},403);
      return fixtures[url.pathname]?json(fixtures[url.pathname]):json({error:'Unavailable in offline preview'},404);
    }
    if(url.pathname==='/preview-audio.wav'){res.writeHead(200,{'content-type':'audio/wav'});return res.end(silentAudio());}
    let path=resolve(output,`.${decodeURIComponent(url.pathname)}`);
    if(path!==output&&!path.startsWith(output+sep)){res.writeHead(403);return res.end();}
    if(!extname(path))path=resolve(output,'index.html');
    let content=await readFile(path);if(extname(path)==='.html')content=Buffer.from(content.toString().replace(/<script\b[^>]*src=["']https:\/\/telegram\.org\/[^"']*["'][^>]*><\/script>/g,'').replace('<head>',`<head>${bridge}`).replace('<title>Luna Meditation</title>','<title>Luna Phase 2 — OFFLINE QA</title>'));
    res.writeHead(200,{'content-type':mime[extname(path)]||'application/octet-stream','cache-control':'no-store','x-luna-preview':'synthetic-local-only','content-security-policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; media-src 'self'"});res.end(content);
  } catch {res.writeHead(404);res.end('Not available in the offline preview');}
});
const port=Number(process.env.PHASE2_PREVIEW_PORT??(tarotPreview?55448:55444));assert.ok(Number.isInteger(port)&&port>1024&&port<65536);
server.listen(port,'127.0.0.1',()=>console.log(`OFFLINE QA preview: http://127.0.0.1:${port} — synthetic data only; no production API, AI, payments or database writes.`));
