import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function launch(t,env={}) {
 const prefix=resolve(tmpdir(),'miteinander-account-'),dir=await mkdtemp(prefix);
 let child,base;
 async function start() {
  child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,HOST:'127.0.0.1',PORT:'0',DATA_DIR:dir,...env},stdio:['ignore','pipe','pipe']});
  child.done=once(child,'exit');let logs='';child.stderr.on('data',c=>logs+=c);
  base=await new Promise((accept,reject)=>{const timeout=setTimeout(()=>reject(new Error(logs)),10000);child.stdout.on('data',c=>{const m=String(c).match(/http:\/\/localhost:(\d+)/);if(m){clearTimeout(timeout);accept(`http://127.0.0.1:${m[1]}`);}});child.once('error',reject);child.once('exit',()=>{clearTimeout(timeout);reject(new Error(logs));});});
 }
 async function stop(){if(child && child.exitCode===null){child.kill();await child.done;}}
 await start();
 t.after(async()=>{await stop();assert.ok(resolve(dir).startsWith(prefix) && resolve(dir).startsWith(resolve(tmpdir())+sep));await rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100});});
 return {dir,restart:async()=>{await stop();await start();},request:async(path,method='GET',data,cookie)=>{
  const res=await fetch(base+path,{method,headers:{...(data?{'Content-Type':'application/json'}:{}),...(cookie?{cookie}:{})},body:data?JSON.stringify(data):undefined});return {status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};
 }};
}

test('Bruns: Nutzername, E-Mail-Einstellungen, Passwortwechsel und Neustart',async t=>{
 const server=await launch(t,{SMTP_HOST:'',PUBLIC_ORIGIN:''}),request=server.request;
 let bruns=await request('/api/auth/login','POST',{identifier:'bruns',password:'Test1234'});
 assert.equal(bruns.status,200);assert.equal(bruns.data.user.username,'Bruns');assert.equal(bruns.data.user.email,'');
 assert.equal(bruns.data.mailConfigured,false);
 assert.equal((await request('/api/account/email','PUT',{email:'bruns@example.test',password:'falsch'},bruns.cookie)).status,400);
 const saved=await request('/api/account/email','PUT',{email:'bruns@example.test',password:'Test1234'},bruns.cookie);
 assert.equal(saved.status,200);assert.equal(saved.data.user.email,'bruns@example.test');assert.equal(saved.data.user.emailVerified,false);assert.equal(saved.data.verificationSent,false);
 assert.equal((await request('/api/auth/forgot-password','POST',{identifier:'Bruns'})).status,503);
 assert.equal((await request('/api/account/password','PUT',{currentPassword:'falsch',password:'NeuesTestpasswort'},bruns.cookie)).status,400);
 const changed=await request('/api/account/password','PUT',{currentPassword:'Test1234',password:'NeuesTestpasswort'},bruns.cookie);
 assert.equal(changed.status,200);assert.equal((await request('/api/me','GET',undefined,bruns.cookie)).status,401);
 assert.equal((await request('/api/auth/login','POST',{identifier:'Bruns',password:'Test1234'})).status,401);
 await server.restart();
 bruns=await request('/api/auth/login','POST',{identifier:'Bruns',password:'NeuesTestpasswort'});
 assert.equal(bruns.status,200);assert.equal(bruns.data.user.email,'bruns@example.test');
 assert.equal((await request('/api/auth/login','POST',{identifier:'bruns@example.test',password:'NeuesTestpasswort'})).status,200);
});

test('Anzeigename bleibt gespeichert, ändert nur das eigene Konto und erhält den Login',async t=>{
 const {request,restart}=await launch(t);
 const owner=await request('/api/auth/login','POST',{identifier:'Bruns',password:'Test1234'});
 const guest=await request('/api/auth/register','POST',{name:'Gast',email:'profile-guest@example.test',password:'GemeinsamesPasswort',invite:owner.data.space.invite});
 assert.equal((await request('/api/account/profile','PUT',{name:'Christian'})).status,401);
 assert.equal((await request('/api/account/profile','PUT',{name:'   '},owner.cookie)).status,400);
 assert.equal((await request('/api/account/profile','PUT',{name:'A'.repeat(61)},owner.cookie)).status,400);
 const saved=await request('/api/account/profile','PUT',{name:' Christian ',id:guest.data.user.id,username:'Christian'},owner.cookie);
 assert.equal(saved.status,200);assert.equal(saved.data.user.name,'Christian');assert.equal(saved.data.user.username,'Bruns');
 assert.equal((await request('/api/me','GET',undefined,guest.cookie)).data.user.name,'Gast');
 assert.equal((await request('/api/calendar','GET',undefined,owner.cookie)).data.people[0].name,'Bruns');
 await restart();
 const login=await request('/api/auth/login','POST',{identifier:'Bruns',password:'Test1234'});
 assert.equal(login.status,200);assert.equal(login.data.user.name,'Christian');
});

test('Essensplan wird gespeichert und nach gemeinsamem Kalender getrennt',async t=>{
 const {request}=await launch(t);
 const owner=await request('/api/auth/login','POST',{identifier:'Bruns',password:'Test1234'});
 const member=await request('/api/auth/register','POST',{username:'Gast',name:'Gast',email:'guest@example.test',password:'GemeinsamesPasswort',invite:owner.data.space.invite});
 const other=await request('/api/auth/register','POST',{username:'AnderesZuhause',name:'Andere',email:'other@example.test',password:'EinAnderesPasswort'});
 const meal={date:'2026-11-19',slot:'dinner',title:'Ofengemüse',note:'Mit Feta'};
 assert.equal((await request('/api/meals','PUT',meal,owner.cookie)).status,200);
 assert.equal((await request('/api/meals','GET',undefined,member.cookie)).data.meals[0].title,meal.title);
 assert.equal((await request('/api/meals','GET',undefined,other.cookie)).data.meals.length,0);
 assert.equal((await request('/api/meals','PUT',{...meal,title:'Pasta'},member.cookie)).status,200);
 assert.equal((await request('/api/meals','GET',undefined,owner.cookie)).data.meals.length,1);
 assert.equal((await request('/api/meals','GET',undefined,owner.cookie)).data.meals[0].title,'Pasta');
 assert.equal((await request('/api/meals','PUT',{...meal,date:'2026-02-30'},owner.cookie)).status,400);
 assert.equal((await request('/api/meals','PUT',{...meal,slot:'invalid'},owner.cookie)).status,400);
 assert.equal((await request('/api/meals','PUT',meal)).status,401);
 assert.equal((await request('/api/meals','PUT',{...meal,title:''},owner.cookie)).status,200);
 assert.equal((await request('/api/meals','GET',undefined,owner.cookie)).data.meals.length,0);
});

test('E-Mail-Bestätigung und Passwort-Link: echter SMTP-Ablauf, Einmalnutzung, Ablauf und Sitzungswiderruf',async t=>{
 let db; t.after(()=>db?.close());
 const messages=[],connections=new Set();
 // Local SMTP receiver: all messages stay inside this test process.
 const smtp=createServer(socket=>{
  connections.add(socket);socket.on('close',()=>connections.delete(socket));socket.write('220 localhost test SMTP\r\n');let buffer='',dataMode=false,message='';
  socket.on('data',chunk=>{buffer+=chunk.toString();let end;while((end=buffer.indexOf('\r\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+2);
   if(dataMode){if(line==='.') {messages.push(message.replace(/=\r\n/g,'').replace(/=3D/g,'='));dataMode=false;message='';socket.write('250 message accepted\r\n');}else message+=line+'\r\n';continue;}
   if(/^EHLO|^HELO/.test(line))socket.write('250-localhost\r\n250 8BITMIME\r\n');
   else if(line==='DATA'){dataMode=true;socket.write('354 end with dot\r\n');}
   else if(line==='QUIT'){socket.end('221 bye\r\n');}
   else socket.write('250 ok\r\n');
  }});
 });
 smtp.listen(0,'127.0.0.1');await once(smtp,'listening');
 t.after(async()=>{for(const socket of connections)socket.destroy();smtp.close();await once(smtp,'close');});
 const {request,dir}=await launch(t,{SMTP_HOST:'127.0.0.1',SMTP_PORT:String(smtp.address().port),SMTP_LOCAL_RELAY:'true',SMTP_SECURE:'false',SMTP_USER:'',MAIL_FROM:'Miteinander <app@example.test>',PUBLIC_ORIGIN:'http://localhost:3100'});
 async function waitMail(count){for(let n=0;n<100;n++){if(messages.length>=count)return messages[count-1];await delay(30);}throw new Error('SMTP-Nachricht fehlt.');}
 const bruns=await request('/api/auth/login','POST',{identifier:'Bruns',password:'Test1234'});
 const saved=await request('/api/account/email','PUT',{email:'bruns@example.test',password:'Test1234'},bruns.cookie);
 assert.equal(saved.status,200);assert.equal(saved.data.verificationSent,true);
 const verifyMessage=await waitMail(1),verifyToken=verifyMessage.match(/verify-email\?token=([a-f0-9]{48})/)?.[1];assert.ok(verifyToken,verifyMessage);
 db=new DatabaseSync(join(dir,'calendar.sqlite'));
 assert.ok(db.prepare('SELECT token FROM account_tokens').all().every(row=>row.token!==verifyToken),'Nur Token-Hashes in der Datenbank');
 assert.equal((await request('/api/auth/verify-email','POST',{token:verifyToken})).status,200);
 assert.equal((await request('/api/auth/verify-email','POST',{token:verifyToken})).status,400);
 assert.equal((await request('/api/me','GET',undefined,bruns.cookie)).data.user.emailVerified,true);
 const unknown=await request('/api/auth/forgot-password','POST',{identifier:'unbekannt'});
 const known=await request('/api/auth/forgot-password','POST',{identifier:'Bruns'});
 assert.deepEqual(known.data,unknown.data);
 const resetMessage=await waitMail(2),resetToken=resetMessage.match(/reset-password\?token=([a-f0-9]{48})/)?.[1];assert.ok(resetToken);
 db.prepare('UPDATE account_tokens SET expires=0 WHERE purpose=?').run('reset');
 assert.equal((await request('/api/auth/reset-password','POST',{token:resetToken,password:'NeuesPasswort123'})).status,400);
 db.prepare('DELETE FROM account_tokens WHERE purpose=?').run('reset');
 await request('/api/auth/forgot-password','POST',{identifier:'Bruns'});
 const validToken=(await waitMail(3)).match(/reset-password\?token=([a-f0-9]{48})/)?.[1];assert.ok(validToken);
 assert.equal((await request('/api/auth/reset-password','POST',{token:validToken,password:'NeuesPasswort123'})).status,200);
 assert.equal((await request('/api/me','GET',undefined,bruns.cookie)).status,401);
 assert.equal((await request('/api/auth/reset-password','POST',{token:validToken,password:'AnderesPasswort123'})).status,400);
 assert.equal((await request('/api/auth/login','POST',{identifier:'Bruns',password:'NeuesPasswort123'})).status,200);
});
