import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { once } from 'node:events';
import { monthDays, dateKey, sorted, demoData, todayKey } from '../public/domain.js';

test('Monatsraster beginnt montags und enthält den vollständigen Schaltmonat', () => {
 const days = monthDays(2028, 1);
 assert.equal(days.length, 42);
 assert.equal(days[0].getDay(), 1);
 assert.equal(dateKey(days[0]), '2028-01-31');
 assert.equal(days.filter(d => d.getMonth() === 1).length, 29);
 assert.equal(dateKey(days[41]), '2028-03-12');
});

test('Termine werden nach Datum und Uhrzeit sortiert, ohne das Original zu ändern', () => {
 const events = [{date:'2026-11-09',time:'09:00'}, {date:'2026-11-08',time:'14:00'}, {date:'2026-11-08',time:''}];
 assert.deepEqual(sorted(events), [events[2], events[1], events[0]]);
 assert.equal(events[0].date, '2026-11-09');
 const demo = demoData();
 assert.equal(demo.events[0].date, todayKey());
 assert.ok(demo.events.every(e => !e.personId || demo.people.some(p => p.id === e.personId)));
});

test('Server: Konten, gemeinsame Kalender, Isolation und Eingabeprüfung', async t => {
 const prefix = resolve(tmpdir(), 'miteinander-test-');
 const dataDir = await mkdtemp(prefix);
 const child = spawn(process.execPath, ['server.mjs'], {cwd:new URL('..', import.meta.url), env:{...process.env, HOST:'127.0.0.1', PORT:'0', DATA_DIR:dataDir}, stdio:['ignore','pipe','pipe']});
 const exited = once(child, 'exit');
 let logs = '';
 child.stderr.on('data', chunk => { logs += chunk; });
 t.after(async () => {
  child.kill();
  await exited;
  assert.ok(resolve(dataDir).startsWith(prefix) && resolve(dataDir).startsWith(resolve(tmpdir()) + sep));
  await rm(dataDir, {recursive:true, force:true, maxRetries:5, retryDelay:100});
 });
 const base = await new Promise((accept, reject) => {
  const timeout = setTimeout(() => reject(new Error('Serverstart fehlgeschlagen: ' + logs)), 10000);
  child.stdout.on('data', chunk => {
   const match = String(chunk).match(/http:\/\/localhost:(\d+)/);
   if(match){clearTimeout(timeout);accept(`http://127.0.0.1:${match[1]}`);}
  });
  child.once('error', error => { clearTimeout(timeout);reject(error); });
  child.once('exit', () => { clearTimeout(timeout);reject(new Error(logs)); });
 });
 const request = async (path, method='GET', data, cookie, origin) => {
  const res = await fetch(base + path, {method, headers:{...(data ? {'Content-Type':'application/json'} : {}), ...(cookie ? {cookie} : {}), ...(origin ? {origin} : {})}, body:data ? JSON.stringify(data) : undefined});
  return {status:res.status, data:await res.json(), cookie:res.headers.get('set-cookie')?.split(';')[0]};
 };
 let anna, ben, other, eventId, personId;
 const password = '  langes Passwort mit Leerzeichen  ';
 await t.test('Alle Shell-Dateien und App-Symbole sind erreichbar', async () => {
  const sw = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
  const paths = sw.match(/const ASSETS = \[([^\]]+)\]/)[1].match(/'([^']+)'/g).map(p => p.slice(1,-1));
  for(const path of paths){const res=await fetch(base+path);assert.equal(res.status,200,path);assert.ok((await res.arrayBuffer()).byteLength>0,path);}
  for(const size of [192,512]) {
   const png = Buffer.from(await (await fetch(`${base}/icon-${size}.png`)).arrayBuffer());
   assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);
  }
  assert.equal((await request('/api/calendar')).status,401);
  assert.equal((await fetch(base+'/server.mjs')).status,404);
  assert.equal((await fetch(base+'/.env')).status,404);
 });
 await t.test('Registrierung und Anmeldung erhalten das vollständige Passwort', async () => {
  anna = await request('/api/auth/register','POST',{name:'Anna',email:'anna@example.test',password});
  assert.equal(anna.status,200);assert.ok(anna.cookie);assert.equal(anna.data.space.name,'Unser Zuhause');
  const login = await request('/api/auth/login','POST',{email:'ANNA@example.test',password});
  assert.equal(login.status,200);
  assert.equal((await request('/api/auth/login','POST',{email:'anna@example.test',password:password.trim()})).status,401);
 });
 await t.test('Einladung verbindet zwei Konten; andere Haushalte bleiben getrennt', async () => {
  ben=await request('/api/auth/register','POST',{name:'Ben',email:'ben@example.test',password,invite:anna.data.space.invite});
  other=await request('/api/auth/register','POST',{name:'Lina',email:'lina@example.test',password});
  assert.equal(ben.status,200);assert.equal(other.status,200);
  assert.equal(anna.data.space.id,ben.data.space.id);assert.notEqual(anna.data.space.id,other.data.space.id);
  const people=await request('/api/calendar','GET',undefined,ben.cookie);
  assert.deepEqual(people.data.people.map(p=>p.name),['Anna','Ben']);
  personId=people.data.people[0].id;
 });
 const event = {title:'Gemeinsam essen',date:'2026-11-08',time:'18:00',endTime:'19:00',category:'Alltag',location:'Zuhause',note:'Brot mitbringen'};
 await t.test('Termine lassen sich gemeinsam anlegen, bearbeiten und lesen', async () => {
  const created=await request('/api/events','POST',{...event,personId},anna.cookie);
  assert.equal(created.status,201);eventId=created.data.id;
  const shared=await request('/api/calendar','GET',undefined,ben.cookie);
  assert.equal(shared.data.events[0].title,event.title);assert.equal(shared.data.events[0].personId,personId);
  assert.equal((await request(`/api/events/${eventId}`,'PUT',{...event,title:'Gemeinsam kochen',personId},ben.cookie)).status,200);
  assert.equal((await request('/api/calendar','GET',undefined,anna.cookie)).data.events[0].title,'Gemeinsam kochen');
 });
 await t.test('Kein Zugriff auf fremde Termine oder Personen', async () => {
  assert.equal((await request('/api/calendar','GET',undefined,other.cookie)).data.events.length,0);
  assert.equal((await request(`/api/events/${eventId}`,'DELETE',undefined,other.cookie)).status,404);
  assert.equal((await request('/api/events','POST',{...event,personId},other.cookie)).status,400);
 });
 await t.test('Ungültige Daten, Uhrzeiten und fremde Origins werden abgewiesen', async () => {
  for(const patch of [{date:'2026-02-30'},{endTime:'17:00'},{time:'25:00'},{title:' '},{category:'unbekannt'}]) {
   assert.equal((await request('/api/events','POST',{...event,...patch},anna.cookie)).status,400);
  }
  assert.equal((await request('/api/events','POST',event,anna.cookie,'https://fremde-seite.example')).status,403);
  assert.equal((await request('/api/weather?lat=91&lon=0')).status,400);
  assert.equal((await request('/api/holidays?year=2026&state=XX')).status,400);
 });
 await t.test('Einstellungen und Personen werden für alle Mitglieder gespeichert', async () => {
  assert.equal((await request('/api/space','PATCH',{name:'Unser Familienplan',state:'BY'},anna.cookie)).status,200);
  assert.equal((await request('/api/me','GET',undefined,ben.cookie)).data.space.state,'BY');
  assert.equal((await request('/api/me','GET',undefined,ben.cookie)).data.space.name,'Unser Familienplan');
  assert.equal((await request('/api/people','POST',{name:'Oma',color:'violet'},ben.cookie)).status,201);
  assert.ok((await request('/api/calendar','GET',undefined,anna.cookie)).data.people.some(p=>p.name==='Oma'));
 });
 await t.test('Löschen und Abmelden werden serverseitig wirksam', async () => {
  assert.equal((await request(`/api/events/${eventId}`,'DELETE',undefined,ben.cookie)).status,200);
  assert.equal((await request('/api/calendar','GET',undefined,anna.cookie)).data.events.length,0);
  assert.equal((await request('/api/auth/logout','POST',{},anna.cookie)).status,200);
  assert.equal((await request('/api/me','GET',undefined,anna.cookie)).status,401);
 });
});
