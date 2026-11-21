import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, sep } from 'node:path';
import assert from 'node:assert/strict';

const root = new URL('..', import.meta.url);
const scratchPrefix = resolve(tmpdir(), 'miteinander-browser-');
const scratch = await mkdtemp(scratchPrefix);
const output = new URL('../tmp/', import.meta.url);
await mkdir(output, {recursive:true});
const children = [];
let cdp;
const delay = ms => new Promise(r=>setTimeout(r,ms));
function launch(command,args,env={}) {
 const child=spawn(command,args,{cwd:root,env:{...process.env,...env},stdio:['ignore','pipe','pipe']});
 child.done=once(child,'exit');children.push(child);return child;
}
async function endpoint(child, pattern) {
 return new Promise((accept,reject)=>{
  let logs='';const timer=setTimeout(()=>reject(new Error('Start-Timeout: '+logs)),15000);
  function read(chunk){logs+=chunk;const match=logs.match(pattern);if(match){clearTimeout(timer);accept(match[1]);}}
  child.stdout.on('data',read);child.stderr.on('data',read);
  child.once('error',err=>{clearTimeout(timer);reject(err);});
  child.once('exit',()=>{clearTimeout(timer);reject(new Error(logs));});
 });
}
class DevTools {
 constructor(ws) {
  this.ws=ws;this.id=0;this.pending=new Map();this.errors=[];
  ws.addEventListener('message',e=>{
   const msg=JSON.parse(e.data);
   if(msg.id){const p=this.pending.get(msg.id);if(p){this.pending.delete(msg.id);clearTimeout(p.timer);msg.error?p.reject(new Error(JSON.stringify(msg.error))):p.accept(msg.result);}}
   if(msg.method==='Runtime.exceptionThrown')this.errors.push(msg.params.exceptionDetails);
  });
 }
 call(method,params={}){return new Promise((accept,reject)=>{const id=++this.id;const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('CDP timeout: '+method));},15000);this.pending.set(id,{accept,reject,timer});this.ws.send(JSON.stringify({id,method,params}));});}
 async run(expression){const r=await this.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
 async wait(expression){for(let n=0;n<100;n++){if(await this.run(expression))return;await delay(100);}throw new Error('Warten fehlgeschlagen: '+expression);}
 async click(selector){await this.wait(`!!document.querySelector(${JSON.stringify(selector)})`);await this.run(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(el.closest('.sidebar')?.hasAttribute('inert'))document.querySelector('.edge-toggle').click();el.click();})()`);}
 async fill(selector,value){await this.run(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('input',{bubbles:true}));})()`);}
 async submit(selector){await this.run(`document.querySelector(${JSON.stringify(selector)}).requestSubmit()`);}
 async screenshot(name){await this.run("window.scrollTo(0,0);document.querySelector('#toast')?.classList.remove('visible')");await this.run('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');const r=await this.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(new URL(name+'.png',output),Buffer.from(r.data,'base64'));}
}
try {
 const server=launch(process.execPath,['server.mjs'],{HOST:'127.0.0.1',PORT:'0',DATA_DIR:resolve(scratch,'data')});
 const port=await endpoint(server,/http:\/\/localhost:(\d+)/);
 const base=`http://127.0.0.1:${port}`;
 const chrome=launch(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',[
  '--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${resolve(scratch,'chrome')}`,'about:blank'
 ]);
 const browserWs=await endpoint(chrome,/DevTools listening on (ws:\/\/[^\s]+)/);
 const host=new URL(browserWs).host;
 const targets=await (await fetch(`http://${host}/json/list`)).json();
 const ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await once(ws,'open');
 cdp=new DevTools(ws);await cdp.call('Runtime.enable');await cdp.call('Page.enable');await cdp.call('Network.enable');
 await cdp.call('Emulation.setDeviceMetricsOverride',{width:1440,height:1050,deviceScaleFactor:1,mobile:false});
 await cdp.call('Page.navigate',{url:base});

 await cdp.wait("!!document.querySelector('#login-form')");
 const overflow=()=>cdp.run('document.documentElement.scrollWidth>innerWidth');
 for(const width of [1440,1024,820,768,430,390,360,320]) {
  await cdp.call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<700});
  assert.equal(await overflow(),false,'Login overflow '+width);
  await cdp.screenshot('login-'+width);
 }
 await cdp.fill('#login-form [name="identifier"]','Bruns');
 await cdp.fill('#login-form [name="password"]','falsch');await cdp.submit('#login-form');
 await cdp.wait("!!document.querySelector('#login-form .form-error').textContent");
 await cdp.fill('#login-form [name="password"]','Test1234');await cdp.submit('#login-form');
 await cdp.wait("document.querySelectorAll('.app-tile').length===7");
 assert.ok(await cdp.run("document.querySelector('h1').textContent.includes('Bruns')"));
 await cdp.wait('!!navigator.serviceWorker.controller');
 // Several profiles and their appointments are managed under this single login.
 await cdp.click('.app-tile[data-action="people"]');await cdp.wait("!!document.querySelector('.person-directory')");
 await cdp.click('.page-heading [data-action="add-person"]');await cdp.fill('#person-form [name="name"]','Anna');
 await cdp.run("document.querySelector('#person-form [name=color][value=rose]').checked=true");await cdp.submit('#person-form');await cdp.wait("!document.querySelector('#modal').open");
 const annaId=await cdp.run("[...document.querySelectorAll('.person-card')].find(el=>el.textContent.includes('Anna')).dataset.id");
 await cdp.click('.person-detail-actions [data-action="new-event"]');
 assert.equal(await cdp.run("document.querySelector('#event-form [name=personId]').value"),annaId,'Person wird beim neuen Termin vorausgewählt');
 await cdp.fill('#event-form [name="title"]','Anna: Arzttermin');await cdp.submit('#event-form');await cdp.wait("!document.querySelector('#modal').open");
 await cdp.click('.person-detail-actions [data-action="new-event"]');await cdp.fill('#event-form [name="title"]','Annas alter Termin');await cdp.fill('#event-form [name="date"]','2000-01-01');await cdp.submit('#event-form');await cdp.wait("!document.querySelector('#modal').open");
 await cdp.click('.page-heading [data-action="add-person"]');await cdp.fill('#person-form [name="name"]','Ben');
 await cdp.run("document.querySelector('#person-form [name=color][value=blue]').checked=true");await cdp.submit('#person-form');await cdp.wait("!document.querySelector('#modal').open");
 const benId=await cdp.run("[...document.querySelectorAll('.person-card')].find(el=>el.textContent.includes('Ben')).dataset.id");
 await cdp.click('.person-detail-actions [data-action="new-event"]');await cdp.fill('#event-form [name="title"]','Ben: Training');await cdp.submit('#event-form');await cdp.wait("!document.querySelector('#modal').open");
 assert.ok(await cdp.run("document.querySelector('.person-event-list').textContent.includes('Ben: Training')"));
 await cdp.click('.person-card[data-id="'+annaId+'"]');
 assert.ok(await cdp.run("document.querySelector('.person-event-list').textContent.includes('Anna: Arzttermin')"));
 assert.ok(await cdp.run("!document.querySelector('.person-event-list').textContent.includes('Ben: Training')"));
 await cdp.click('[data-action="person-period"][data-id="all"]');
 assert.ok(await cdp.run("document.querySelector('.person-event-list').textContent.includes('Annas alter Termin')"));
 await cdp.click('[data-action="person-period"][data-id="past"]');
 assert.ok(await cdp.run("!document.querySelector('.person-event-list').textContent.includes('Anna: Arzttermin')"));
 await cdp.click('[data-action="person-period"][data-id="upcoming"]');
 await cdp.click('.person-detail-header [data-action="edit-person"]');
 await cdp.run("document.querySelector('#person-form [name=color][value=violet]').checked=true");await cdp.submit('#person-form');await cdp.wait("!document.querySelector('#modal').open");
 assert.equal(await cdp.run("document.querySelector('.person-event-list .owner-badge').dataset.color"),'violet');
 assert.equal(await cdp.run("document.querySelector('.person-event-list .owner-badge').textContent.trim()"),'Anna');
 const currentDate=await cdp.run("new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())");
 await cdp.click('.person-detail-actions [data-action="new-birthday"]');
 assert.equal(await cdp.run("document.querySelector('#birthday-form [name=name]').value"),'Anna');
 await cdp.fill('#birthday-form [name="day"]',String(Number(currentDate.slice(8))));await cdp.fill('#birthday-form [name="month"]',String(Number(currentDate.slice(5,7))));await cdp.fill('#birthday-form [name="year"]','1995');
 assert.equal(await overflow(),false,'Geburtstagsformular bei 320px');await cdp.submit('#birthday-form');await cdp.wait("!document.querySelector('#modal').open");
 for(const width of [1440,1024,768,390,320]) {
  await cdp.call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<700});assert.equal(await overflow(),false,'Personen overflow '+width);await cdp.screenshot('people-'+width);
 }
 await cdp.click('a[href="#birthdays"]');await cdp.wait("document.querySelectorAll('.birthday-row').length===1");
 assert.ok(await cdp.run("document.querySelector('.birthday-spotlight').textContent.includes('HEUTE WIRD GEFEIERT')"));
 await cdp.click('.page-heading [data-action="new-birthday"]');await cdp.fill('#birthday-form [name="name"]','Oma Erika');await cdp.fill('#birthday-form [name="day"]','24');await cdp.fill('#birthday-form [name="month"]','12');await cdp.fill('#birthday-form [name="note"]','Blumen nicht vergessen');await cdp.submit('#birthday-form');await cdp.wait("!document.querySelector('#modal').open");
 // Older birthday appointments appear in the new list as well.
 await cdp.click('a[href="#calendar"]');await cdp.wait("!!document.querySelector('.calendar-panel')");await cdp.click('[data-action="new-event"]');await cdp.fill('#event-form [name="title"]','Onkel Max');await cdp.fill('#event-form [name="category"]','Geburtstag');await cdp.fill('#event-form [name="date"]','2020-01-15');await cdp.submit('#event-form');await cdp.wait("!document.querySelector('#modal').open");
 await cdp.click('a[href="#birthdays"]');await cdp.wait("document.querySelectorAll('.birthday-row').length===3");
 await cdp.fill('#birthday-search','Oma');assert.equal(await cdp.run("document.querySelectorAll('.birthday-row').length"),1);await cdp.fill('#birthday-search','');
 for(const width of [1440,1024,768,390,320]) {
  await cdp.call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<700});assert.equal(await overflow(),false,'Geburtstage overflow '+width);await cdp.screenshot('birthdays-'+width);
 }
 await cdp.call('Page.reload');await cdp.wait("document.querySelectorAll('.birthday-row').length===3");
 const omaId=await cdp.run("[...document.querySelectorAll('.birthday-row')].find(el=>el.textContent.includes('Oma Erika')).dataset.id");
 await cdp.click('.birthday-row[data-id="'+omaId+'"]');await cdp.click('#delete-birthday');await cdp.submit('#delete-birthday-form');await cdp.wait("!document.querySelector('#modal').open");
 assert.equal(await cdp.run("document.querySelectorAll('.birthday-row').length"),2);
 await cdp.click('a[href="#home"]');await cdp.wait("document.querySelectorAll('.app-tile').length===7");
 assert.ok(await cdp.run("[...document.querySelectorAll('.upcoming-panel .owner-badge')].some(el=>el.textContent.includes('Anna'))"));
 assert.ok(await cdp.run("[...document.querySelectorAll('.upcoming-panel .owner-badge')].some(el=>el.textContent.includes('Ben'))"));
 for(const width of [1440,1024,820,768,430,390,360,320]) {
  await cdp.call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<700});
  assert.equal(await overflow(),false,'Home overflow '+width);
  const targets=await cdp.run("[...document.querySelectorAll('.app-tile')].map(el=>{const r=el.getBoundingClientRect();return {width:r.width,height:r.height};})");
  assert.ok(targets.every(t=>t.width>=130 && t.height>=180),'Gro?e Kacheln '+width);
  await cdp.screenshot('app-home-'+width);
 }
 await cdp.call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await cdp.click('.app-tile[data-action="calendar"]');await cdp.wait("!!document.querySelector('.calendar-panel')");await cdp.click('[data-action="month-view"]');await cdp.wait("!!document.querySelector('.month-grid')");
 assert.equal(await cdp.run("document.querySelectorAll('.day-cell').length"),42);
 await cdp.click('[data-action="new-event"]');
 await cdp.fill('#event-form [name="title"]','Unser neuer App-Termin');await cdp.fill('#event-form [name="time"]','18:00');await cdp.fill('#event-form [name="endTime"]','19:00');
 assert.equal(await overflow(),false,'Mobile Terminformular');await cdp.screenshot('app-event-mobile');
 await cdp.submit('#event-form');await cdp.wait("!document.querySelector('#modal').open");
 await cdp.click('[data-action="list-view"]');
 assert.ok(await cdp.run("document.querySelector('.month-list').textContent.includes('Unser neuer App-Termin')"));
 await cdp.click('[data-action="calendar-options"]');await cdp.fill('#event-search','neuer App');await cdp.submit('#calendar-options-form');await cdp.wait("!document.querySelector('#modal').open");
 assert.ok(await cdp.run("document.querySelector('.month-list').textContent.includes('Unser neuer App-Termin')"));
 await cdp.click('[data-action="calendar-options"]');await cdp.fill('#event-search','');await cdp.submit('#calendar-options-form');await cdp.wait("!document.querySelector('#modal').open");await cdp.click('[data-action="month-view"]');
 for(const width of [1440,1024,820,768,430,390,360,320]) {
  await cdp.call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<700});
  assert.equal(await overflow(),false,'Calendar overflow '+width);await cdp.screenshot('app-calendar-'+width);
 }
 for(const [width,height] of [[1280,800],[1024,768],[1024,600],[820,1180],[768,1024],[390,844]]){
  await cdp.call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});await delay(160);
  assert.equal(await cdp.run("!!document.querySelector('.topbar,.page-heading,.mobile-nav,.day-panel,.app-footer')"),false,'Only calendar controls in focus view');
  assert.equal(await cdp.run("document.querySelector('.edge-toggle').getAttribute('aria-expanded')"),'false');
  assert.ok(await cdp.run("document.querySelector('.month-grid').getBoundingClientRect().bottom<=innerHeight+1"),'Calendar fits viewport '+width+'x'+height);
  assert.ok(await cdp.run("document.documentElement.scrollHeight<=innerHeight+1"),'No page scroll in calendar '+width+'x'+height);
  assert.ok(await cdp.run("[...document.querySelectorAll('.calendar-event')].every(el=>{const r=el.getBoundingClientRect(),c=el.closest('.day-cell').getBoundingClientRect();return r.bottom<=c.bottom+1 && r.top>=c.top;})"),'Calendar entries are not cut off '+width+'x'+height);
  await cdp.screenshot('focus-calendar-'+width+'x'+height);
 }
 await cdp.click('.edge-toggle');assert.equal(await cdp.run("document.querySelector('.edge-toggle').getAttribute('aria-expanded')"),'true');
 await delay(240);assert.ok(await cdp.run("Math.abs(document.querySelector('#app-sidebar').getBoundingClientRect().left)<1"),'Sidebar fully expands');
 await cdp.screenshot('calendar-menu-open');
 await cdp.click('.edge-toggle');assert.equal(await cdp.run("document.querySelector('#app-sidebar').hasAttribute('inert')"),true);
 await cdp.click('.day-number[data-date="'+currentDate+'"]');await cdp.wait("!!document.querySelector('#calendar-day-modal')");
 assert.ok(await cdp.run("document.querySelector('#calendar-day-modal').textContent.includes('Anna: Arzttermin')"));await cdp.click('.modal-close');
 await cdp.click('a[href="#shopping"]');await cdp.wait("!!document.querySelector('#shopping-add-form')");
 await cdp.fill('#shopping-add-form [name="title"]','Milch');await cdp.fill('#shopping-add-form [name="quantity"]','2 Liter');await cdp.fill('#shopping-add-form [name="personId"]',annaId);await cdp.submit('#shopping-add-form');
 await cdp.wait("document.querySelector('.shopping-list').textContent.includes('Milch')");
 const milkId=await cdp.run("document.querySelector('.shopping-row [data-action=shopping-toggle]').dataset.id");
 assert.ok(await cdp.run("document.querySelector('.shopping-person').textContent.includes('Anna')"));
 await cdp.click('[data-action="shopping-toggle"][data-id="'+milkId+'"]');await cdp.wait("document.querySelector('.shopping-empty')!==null");
 await cdp.click('[data-action="shopping-period"][data-id="done"]');await cdp.wait("!!document.querySelector('.shopping-row.is-done')");
 await cdp.click('[data-action="shopping-toggle"][data-id="'+milkId+'"]');await cdp.wait("!document.querySelector('.shopping-row')");
 await cdp.click('[data-action="shopping-period"][data-id="open"]');await cdp.wait("!!document.querySelector('.shopping-row')");
 await cdp.click('.shopping-item-main');await cdp.fill('#shopping-edit-form [name="quantity"]','3 Liter');await cdp.submit('#shopping-edit-form');await cdp.wait("!document.querySelector('#modal').open");
 const cookies=await cdp.call('Network.getCookies',{urls:[base]});const sessionCookie=cookies.cookies.find(c=>c.name==='session');
 const remote=await fetch(base+'/api/shopping',{method:'POST',headers:{'Content-Type':'application/json',cookie:'session='+sessionCookie.value},body:JSON.stringify({title:'Brot vom Handy',quantity:'1 Laib',personId:benId})});assert.equal(remote.status,201);
 await cdp.fill('#shopping-add-form [name="title"]','Mein noch nicht gespeicherter Eintrag');await cdp.run("document.querySelector('#shopping-add-form [name=title]').focus();document.dispatchEvent(new Event('visibilitychange'))");
 await cdp.wait("document.querySelector('.shopping-list').textContent.includes('Brot vom Handy')");
 assert.equal(await cdp.run("document.querySelector('#shopping-add-form [name=title]').value"),'Mein noch nicht gespeicherter Eintrag');await cdp.fill('#shopping-add-form [name="title"]','');
 for(const width of [1440,1024,768,390,320]){
  await cdp.call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<700});assert.equal(await overflow(),false,'Shopping list overflow '+width);await cdp.screenshot('shopping-'+width);
 }
 await cdp.call('Page.reload');await cdp.wait("document.querySelector('.shopping-list')?.textContent.includes('3 Liter')");
 await cdp.call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await cdp.click('a[href="#meals"]');await cdp.wait("document.querySelectorAll('.meal-day').length===7");
 await cdp.click('.meal-slot[data-slot="dinner"]');
 await cdp.fill('#meal-form [name="title"]','Pasta mit Tomatensauce');await cdp.fill('#meal-form [name="note"]','Mit frischem Basilikum');await cdp.submit('#meal-form');
 await cdp.wait("!document.querySelector('#modal').open");
 assert.ok(await cdp.run("document.querySelector('.meal-plan').textContent.includes('Pasta mit Tomatensauce')"));
 for(const width of [1024,768,390,320]) {
  await cdp.call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<700});
  assert.equal(await overflow(),false,'Meals overflow '+width);await cdp.screenshot('app-meals-'+width);
 }
 await cdp.call('Page.reload');await cdp.wait("document.querySelector('.meal-plan')?.textContent.includes('Pasta mit Tomatensauce')");
 await cdp.click('a[href="#settings"]');await cdp.wait("!!document.querySelector('#email-form')");
 await cdp.fill('#email-form [name="email"]','bruns-browser@example.test');await cdp.fill('#email-form [name="password"]','Test1234');
 await cdp.submit('#email-form');await cdp.wait("!!document.querySelector('#email-form .form-success').textContent");
 assert.ok(await cdp.run("document.querySelector('#email-form [name=email]').value==='bruns-browser@example.test'"));
 // A synchronization must not erase an unfinished settings form.
 await cdp.fill('#space-form [name="name"]','Noch nicht gespeichert');
 await cdp.call('Runtime.evaluate',{expression:"document.querySelector('#space-form [name=name]').focus()"});
 await cdp.run("document.dispatchEvent(new Event('visibilitychange'))");
 await delay(1000);
 assert.equal(await cdp.run("document.querySelector('#space-form [name=name]').value"),'Noch nicht gespeichert');
 await cdp.submit('#space-form');
 for(const width of [1024,768,390,320]) {
  await cdp.call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<700});
  assert.equal(await overflow(),false,'Settings overflow '+width);await cdp.screenshot('app-settings-'+width);
 }
 await cdp.click('[data-action="change-password"]');
 await cdp.fill('#password-form [name="currentPassword"]','Test1234');await cdp.fill('#password-form [name="password"]','BrowserPasswort123');await cdp.fill('#password-form [name="confirmPassword"]','BrowserPasswort123');await cdp.submit('#password-form');
 await cdp.wait("!!document.querySelector('#login-form')");
 await cdp.fill('#login-form [name="identifier"]','Bruns');await cdp.fill('#login-form [name="password"]','BrowserPasswort123');await cdp.submit('#login-form');
 await cdp.wait("document.querySelectorAll('.app-tile').length===7");
 await cdp.click('.app-tile[data-action="weather"]');await cdp.wait("!!document.querySelector('.weather-hero')");
 assert.equal(await overflow(),false,'Weather overflow');await cdp.screenshot('app-weather-mobile');
 await cdp.click('a[href="#settings"]');await cdp.wait("!!document.querySelector('[data-action=logout]')");await cdp.click('[data-action="logout"]');
 await cdp.wait("!!document.querySelector('#login-form')");
 assert.equal(await cdp.run("!!document.querySelector('.mobile-nav')"),false,'Keine App-Navigation vor Anmeldung');
 await cdp.click('[data-action="forgot"]');await cdp.fill('#forgot-form [name="identifier"]','Bruns');await cdp.submit('#forgot-form');
 await cdp.wait("document.querySelector('#forgot-form .form-error').textContent.includes('nicht eingerichtet')");
 await cdp.click('[data-action="login"]');
 await cdp.call('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
 await cdp.call('Page.reload');await cdp.wait("!!document.querySelector('#login-form')");
 assert.equal(await cdp.run("!!document.querySelector('.app-tiles')"),false,'Keine privaten Inhalte nach Abmeldung offline');
 assert.deepEqual(cdp.errors,[],'JavaScript-Fehler im Browser');
 console.log('Browser checks passed: login, multiple people in one account, appointment ownership, all/past appointments, birthdays and recurrence, 320-1440 px, full-viewport calendar and collapsible menu, shared shopping with protected drafts, meals, email settings, password change, session restore and offline login. Screenshots: tmp/');

} finally {
 if(cdp)cdp.ws.close();
 for(const child of children.reverse()){if(child.exitCode===null){child.kill();await child.done;}}
 assert.ok(resolve(scratch).startsWith(scratchPrefix) && resolve(scratch).startsWith(resolve(tmpdir())+sep));
 await rm(scratch,{recursive:true,force:true,maxRetries:10,retryDelay:200});
}
