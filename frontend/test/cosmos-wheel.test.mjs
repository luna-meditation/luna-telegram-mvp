import test from 'node:test';
import assert from 'node:assert/strict';
import{readFileSync}from'node:fs';
import ts from'typescript';
const load=async file=>import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));
test('touch labels keep separate 44px targets even at a zero-degree conjunction; real coordinates remain intact',async()=>{
 const{planetTouchAngles}=await load('src/features/astrology/planetLayout.ts');
 for(const base of[0,180,359]){const planets=Array.from({length:10},(_,i)=>({id:'p'+i,longitude:(base+i*.01)%360})),original=structuredClone(planets),angles=planetTouchAngles(planets);assert.deepEqual(planets,original);
  const points=Object.values(angles).map(angle=>({x:102*Math.cos(angle*Math.PI/180)*320/360,y:102*Math.sin(angle*Math.PI/180)*320/360}));
  for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++)assert.ok(Math.hypot(points[i].x-points[j].x,points[i].y-points[j].y)>44,'Adjacent hit targets must remain reachable at 360px');
 }
});
