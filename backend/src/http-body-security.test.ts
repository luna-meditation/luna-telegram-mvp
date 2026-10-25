import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

// Keep a late decompressor exception inside a disposable process. Only a local
// Express fixture runs; application startup, credentials and providers do not.
const fixture = String.raw`
import express from 'express';
import http from 'node:http';
import {once} from 'node:events';
import {createRequire} from 'node:module';
import {gzipSync,deflateSync} from 'node:zlib';
const require=createRequire(import.meta.url);
const parserVersion=createRequire(require.resolve('express'))('body-parser/package.json').version;
const expected={probe:'local-parser-security'};
const input=Buffer.from(JSON.stringify(expected));
const app=express();
app.use(express.json({limit:'1mb'}));
app.get('/health',(_req,res)=>res.json({ok:true}));
app.post('/',(req,res)=>res.json(req.body));
app.use((error,_req,res,_next)=>res.status(error.status??500).json({error:error.type??'parse_failed'}));
const server=app.listen(0,'127.0.0.1');
await once(server,'listening');
const port=server.address().port;
const send=(body,encoding)=>new Promise((resolve,reject)=>{
 const headers={'content-type':'application/json','content-length':body.length,'connection':'close'};
 if(encoding)headers['content-encoding']=encoding;
 const req=http.request({host:'127.0.0.1',port,method:'POST',path:'/',headers},res=>{
  let text='';res.setEncoding('utf8');res.on('data',part=>text+=part);
  res.on('error',reject);res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(text)}));
 });
 req.setTimeout(4000,()=>req.destroy(new Error('Local parser request timed out')));
 req.on('error',reject);req.end(body);
});
const results=[];
try{
 for(const [name,body,encoding] of [
  ['json',input,undefined],['gzip',gzipSync(input),'gzip'],['deflate',deflateSync(input),'deflate'],
  ['gzip-trailing-bytes',Buffer.concat([gzipSync(input),Buffer.from([0]),Buffer.alloc(102400,88)]),'gzip']
 ]){
  const response=await send(body,encoding);
  if(response.status!==200||JSON.stringify(response.body)!==JSON.stringify(expected))
   throw new Error('Valid JSON contract changed for '+name);
  await new Promise(done=>setTimeout(done,200));
  const health=await fetch('http://127.0.0.1:'+port+'/health');
  if(health.status!==200)throw new Error('Local parser server stopped');
  results.push({name,status:response.status,serverAlive:true});
 }
 const oversized=Buffer.from(JSON.stringify({probe:'x'.repeat(1048576)}));
 for(const [name,body,encoding] of [
  ['oversized-json',oversized,undefined],['oversized-inflated-json',gzipSync(oversized),'gzip']
 ]){
  const response=await send(body,encoding);
  if(response.status!==413)throw new Error('One-megabyte body boundary changed for '+name);
  results.push({name,status:response.status});
 }
 server.closeAllConnections();
 await new Promise(done=>server.close(done));
 console.log(JSON.stringify({node:process.versions.node,parserVersion,results}));
}catch(error){server.closeAllConnections();server.close();throw error;}
`;

test('HTTP JSON parsing survives trailing compressed bytes and preserves request size boundaries', {timeout: 20000}, async () => {
  const result = await new Promise<{code: number | null; stdout: string; stderr: string}>((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', fixture], {
      cwd: fileURLToPath(new URL('../', import.meta.url)),
      env: {NODE_ENV: 'test', ...(process.env.NODE_OPTIONS ? {NODE_OPTIONS: process.env.NODE_OPTIONS} : {})},
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); }, 15000);
    child.stdout.on('data', chunk => { stdout += String(chunk); });
    child.stderr.on('data', chunk => { stderr += String(chunk); });
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => { clearTimeout(timer); resolve({code, stdout, stderr}); });
  });
  assert.equal(result.code, 0, 'Isolated HTTP parser exited: ' + result.stderr.slice(0, 1800));
  const report = JSON.parse(result.stdout.trim()) as {parserVersion: string; results: {name: string; status: number; serverAlive?: boolean}[]};
  assert.deepEqual(report.results.map(item => item.status), [200,200,200,200,413,413]);
  assert.ok(report.results.slice(0,4).every(item => item.serverAlive));
});
