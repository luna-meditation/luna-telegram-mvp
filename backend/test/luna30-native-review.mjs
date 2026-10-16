// Disposable, loopback-only native PostgreSQL. Never reads production secrets.
import assert from 'node:assert/strict';
import {mkdtempSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {Client} from 'pg';
import {randomInt} from 'node:crypto';
assert.equal(process.versions.node.split('.')[0],'22');
const bin=process.env.LUNA30_POSTGRES_BIN;assert.ok(bin&&existsSync(join(bin,'initdb'))&&existsSync(join(bin,'pg_ctl')),'Set LUNA30_POSTGRES_BIN to an installed PostgreSQL binary directory.');
const exec=promisify(execFile),directory=mkdtempSync('/tmp/luna30-native-'),data=join(directory,'data');
let port;
for(let attempt=0;attempt<20;attempt++){const listener=createServer(),candidate=randomInt(55001,64000);try{await new Promise((done,reject)=>{listener.once('error',reject);listener.listen(candidate,'127.0.0.1',done);});await new Promise(done=>listener.close(done));port=candidate;break;}catch{/* Try another unused high loopback port. */}}
// The child harness rejects non-loopback hosts and common production ports.
assert.ok(port>55000,'Rerun to obtain a high disposable local port.');
let started=false;
try{
 await exec(join(bin,'initdb'),['-D',data,'-A','trust','-U','lunaqa','-E','UTF8','--no-locale']);
 await exec(join(bin,'pg_ctl'),['-D',data,'-l',join(directory,'postgres.log'),'-o',`-h 127.0.0.1 -p ${port} -k ${directory} -c timezone=America/New_York`,'start']);started=true;
 const client=new Client({connectionString:`postgresql://lunaqa@127.0.0.1:${port}/postgres`});await client.connect();await client.query('create database luna30_isolated_review');await client.end();
 const result=await exec(process.execPath,['--import','tsx','test/luna30-database-review.mjs'],{env:{...process.env,LUNA30_NATIVE_DATABASE_URL:`postgresql://lunaqa@127.0.0.1:${port}/luna30_isolated_review`},maxBuffer:1024*1024});process.stdout.write(result.stdout);process.stderr.write(result.stderr);
}finally{if(started)await exec(join(bin,'pg_ctl'),['-D',data,'-m','fast','stop']);console.log('Disposable native PostgreSQL stopped; synthetic fixture retained at '+directory);}
