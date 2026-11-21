import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm,readFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join,sep} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {backupDatabase} from '../scripts/backup.mjs';
import {restoreDatabase} from '../scripts/restore.mjs';

async function run(args,env={}){const child=spawn(process.execPath,args,{cwd:new URL('..',import.meta.url),env:{...process.env,...env},stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',c=>output+=c);child.stderr.on('data',c=>output+=c);const [code]=await once(child,'exit');return {code,output};}
test('Gemeinsame Einkaufsliste und Wetterort: getrennte Haushalte, Bearbeiten, Abhaken und Neustart',async t=>{
 const prefix=resolve(tmpdir(),'miteinander-cloud-'),dir=await mkdtemp(prefix);let child,base;
 async function start(){child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,HOST:'127.0.0.1',PORT:'0',DATA_DIR:dir},stdio:['ignore','pipe','pipe']});child.done=once(child,'exit');let logs='';child.stderr.on('data',c=>logs+=c);base=await new Promise((accept,reject)=>{const timeout=setTimeout(()=>reject(new Error(logs)),10000);child.stdout.on('data',c=>{const m=String(c).match(/http:\/\/localhost:(\d+)/);if(m){clearTimeout(timeout);accept('http://127.0.0.1:'+m[1]);}});child.once('error',reject);child.once('exit',()=>{clearTimeout(timeout);reject(new Error(logs));});});}
 async function stop(){if(child?.exitCode===null){child.kill();await child.done;}}
 t.after(async()=>{await stop();assert.ok(resolve(dir).startsWith(prefix) && resolve(dir).startsWith(resolve(tmpdir())+sep));await rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100});});
 await start();
 const request=async(path,method='GET',data,cookie)=>{const res=await fetch(base+path,{method,headers:{...(data?{'Content-Type':'application/json'}:{}),...(cookie?{cookie}:{})},body:data?JSON.stringify(data):undefined});return {status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};};
 const owner=await request('/api/auth/login','POST',{identifier:'Bruns',password:'Test1234'}),cookie=owner.cookie;
 const member=await request('/api/auth/register','POST',{name:'Anna',email:'shopping-anna@example.test',password:'DasIstEinLangesPasswort',invite:owner.data.space.invite});
 const other=await request('/api/auth/register','POST',{name:'Gast',email:'shopping-other@example.test',password:'DasIstEinLangesPasswort'});
 const profile=(await request('/api/calendar','GET',undefined,cookie)).data.people[0].id;
 const item={title:'Milch',quantity:'2 Liter',personId:profile};
 const created=await request('/api/shopping','POST',item,cookie);assert.equal(created.status,201);const id=created.data.id;
 assert.equal((await request('/api/shopping','GET',undefined,member.cookie)).data.items[0].title,'Milch');
 assert.equal((await request('/api/shopping','GET',undefined,other.cookie)).data.items.length,0);
 assert.equal((await request('/api/shopping/'+id,'PUT',{...item,title:'Hafermilch'},member.cookie)).status,200);
 assert.equal((await request('/api/shopping/'+id,'PATCH',{done:true},cookie)).status,200);
 let saved=(await request('/api/shopping','GET',undefined,cookie)).data.items[0];assert.equal(saved.title,'Hafermilch');assert.equal(saved.done,true);
 assert.equal((await request('/api/shopping/'+id,'PUT',{...item,title:'Haferdrink',quantity:'3 Liter'},member.cookie)).status,200);
 assert.equal((await request('/api/shopping','GET',undefined,cookie)).data.items[0].done,true,'Bearbeiten überschreibt den Erledigt-Status nicht');
 assert.equal((await request('/api/shopping/'+id,'PATCH',{done:'true'},cookie)).status,400);
 for(const method of ['PUT','PATCH','DELETE'])assert.equal((await request('/api/shopping/'+id,method,method==='DELETE'?undefined:method==='PATCH'?{done:false}:item,other.cookie)).status,404);
 assert.equal((await request('/api/shopping','POST',{...item,personId:'fremd'},cookie)).status,400);
 assert.equal((await request('/api/shopping','POST',{title:''},cookie)).status,400);
 assert.equal((await request('/api/shopping')).status,401);
 const location={name:'Hamburg',latitude:53.551,longitude:9.993};
 assert.equal((await request('/api/location','PUT',location,cookie)).status,200);
 assert.equal((await request('/api/me','GET',undefined,member.cookie)).data.space.weatherName,'Hamburg');
 assert.equal((await request('/api/me','GET',undefined,other.cookie)).data.space.weatherName,'Berlin');
 assert.equal((await request('/api/location','PUT',{...location,latitude:100},cookie)).status,400);
 await stop();await start();
 saved=(await request('/api/shopping','GET',undefined,cookie)).data.items[0];assert.equal(saved.title,'Haferdrink');assert.equal(saved.quantity,'3 Liter');assert.equal(saved.done,true);
 assert.equal((await request('/api/me','GET',undefined,cookie)).data.space.weatherName,'Hamburg');
 assert.equal((await request('/api/shopping/'+id,'PATCH',{done:false},member.cookie)).status,200);
 assert.equal((await request('/api/shopping/'+id,'DELETE',undefined,cookie)).status,200);
 assert.equal((await request('/api/shopping','GET',undefined,member.cookie)).data.items.length,0);
});

test('Online-Sicherung ist konsistent, rotiert Dateien und lässt sich mit Erhalt des vorherigen Stands wiederherstellen',async t=>{
 const prefix=resolve(tmpdir(),'miteinander-backup-'),dir=await mkdtemp(prefix),source=join(dir,'source'),output=join(dir,'backups'),restored=join(dir,'restored');
 const {mkdir}=await import('node:fs/promises');await mkdir(source);await mkdir(restored);
 const db=new DatabaseSync(join(source,'calendar.sqlite'));db.exec("PRAGMA journal_mode=WAL;CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT);CREATE TABLE shopping(title TEXT,done INTEGER);INSERT INTO users VALUES('anna','Anna');INSERT INTO shopping VALUES('Brot',0)");
 let targetDb;
 t.after(async()=>{targetDb?.close();db.close();assert.ok(resolve(dir).startsWith(prefix) && resolve(dir).startsWith(resolve(tmpdir())+sep));await rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100});});
 const first=await backupDatabase({dataDir:source,outputDir:output,keep:2});db.exec("UPDATE shopping SET title='Milch',done=1");
 await backupDatabase({dataDir:source,outputDir:output,keep:2});const latest=await backupDatabase({dataDir:source,outputDir:output,keep:2});
 assert.equal((await readdir(output)).filter(f=>f.endsWith('.sqlite')).length,2);
 const snapshot=new DatabaseSync(latest,{readOnly:true});assert.equal(snapshot.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.equal(snapshot.prepare('SELECT title FROM shopping').get().title,'Milch');snapshot.close();
 const old=new DatabaseSync(join(restored,'calendar.sqlite'));old.exec("CREATE TABLE users(name TEXT);INSERT INTO users VALUES('Vorheriger Stand')");old.close();
 await assert.rejects(restoreDatabase({file:latest,dataDir:restored}),/stoppen/);
 const result=await restoreDatabase({file:latest,dataDir:restored,confirmStopped:true});
 targetDb=new DatabaseSync(result.target,{readOnly:true});assert.equal(targetDb.prepare('SELECT name FROM users').get().name,'Anna');assert.equal(targetDb.prepare('SELECT done FROM shopping').get().done,1);
 const archived=new DatabaseSync(join(result.archive,'calendar.sqlite'),{readOnly:true});assert.equal(archived.prepare('SELECT name FROM users').get().name,'Vorheriger Stand');archived.close();
 assert.notEqual(first,latest);
});

test('Produktivkonfiguration erzeugt ein eigenes Startpasswort und überschreibt keine vorhandene Konfiguration',async t=>{
 const prefix=resolve(tmpdir(),'miteinander-config-'),dir=await mkdtemp(prefix),config=join(dir,'.env.production');
 t.after(async()=>{assert.ok(resolve(dir).startsWith(prefix) && resolve(dir).startsWith(resolve(tmpdir())+sep));await rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100});});
 const args=['scripts/configure-production.mjs','--domain','kalender.example.de','--email','admin@example.de','--output',config];
 const created=await run(args);assert.equal(created.code,0);const contents=await readFile(config,'utf8'),password=contents.match(/^SEED_PASSWORD=(.+)$/m)[1];assert.ok(password.length>=24);assert.ok(!created.output.includes(password));
 assert.equal((await run(['--env-file='+config,'scripts/check-production.mjs'])).code,0);
 assert.equal((await run(args)).code,1);assert.equal(await readFile(config,'utf8'),contents);
 assert.equal((await run(['scripts/check-production.mjs'],{APP_DOMAIN:'',PUBLIC_ORIGIN:'',SEED_PASSWORD:''})).code,1);
});
