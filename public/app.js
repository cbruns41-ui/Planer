import { STATES, COLORS, CATEGORIES, MONTHS, firstName, birthdayEntries, birthdayEvents, nextBirthday, dateKey, parseDate, todayKey, sorted } from './domain.js';
import { createScreens } from './screens.js';
import { createShell } from './shell.js';
import { createCalendar } from './calendar.js';

const $ = (q, root=document)=>root.querySelector(q);
const app = $('#app'), modal = $('#modal');
const esc = (v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths = {
 cart:'<path d="M3 3h2l3 12h11l2-8H6M9 20h.01M18 20h.01"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/>',
 filter:'<path d="M4 6h16M7 12h10m-7 6h4"/>',
 expand:'<path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/>',
 minimize:'<path d="M3 9h6V3m6 0v6h6M3 15h6v6m6 0v-6h6"/>',
 trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
 gift:'<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13m0-13H8a2.5 2.5 0 1 1 2.5-2.5ZM12 8h4a2.5 2.5 0 1 0-2.5-2.5Z"/>',
 meal:'<path d="M5 3v7m3-7v7m-6-7v7a3 3 0 0 0 6 0M5 13v8M18 3c-4 3-4 9 0 9h2V3Zm0 9v9"/>',
 mail:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3 7 9 6 9-6"/>',
 lock:'<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
 eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
 drop:'<path d="M12 2s-7 8-7 13a7 7 0 0 0 14 0c0-5-7-13-7-13Z"/>', copy:'<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-14 4h2m3 0h2"/>',
 home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
 cloud:'<path d="M7 18a5 5 0 1 1 1-9 6 6 0 0 1 11 3 3 3 0 0 1 0 6Z"/>',
 rain:'<path d="M6 15a4 4 0 1 1 1-8 5 5 0 0 1 10 2 3 3 0 0 1 1 6M8 18l-1 3m6-3-1 3m6-3-1 3"/>',
 snow:'<path d="M12 2v20M3.4 7l17.2 10M3.4 17 20.6 7M9 4l3 3 3-3M9 20l3-3 3 3"/>',
 users:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m1-17a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v3"/>',
 plus:'<path d="M12 5v14M5 12h14"/>', arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>', chevron:'<path d="m9 5 7 7-7 7"/>',
 search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>', settings:'<path d="m9 3-1 3-3 1 1 3-2 2 2 2-1 3 3 1 1 3h6l1-3 3-1-1-3 2-2-2-2 1-3-3-1-1-3Z"/><circle cx="12" cy="12" r="3"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
 check:'<path d="m5 12 4 4L19 6"/>', close:'<path d="m6 6 12 12M6 18 18 6"/>', leaf:'<path d="M20 3C8 2 2 7 5 15s16 7 15-12ZM5 20 16 9"/>',
 heart:'<path d="m12 21-8-8C-2 6 7-1 12 6c5-7 14 0 8 7Z"/>', logout:'<path d="M10 3H4v18h6m4-15 6 6-6 6m-7-6h13"/>',
 download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>', shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-5"/>',
 edit:'<path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15l-1 6Z"/>',
 list:'<path d="M9 6h12M9 12h12M9 18h12M3 6h1m-1 6h1m-1 6h1"/>', wind:'<path d="M3 8h12a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h6a3 3 0 1 1-3 3"/>',
};
const icon = (name, cls='')=>`<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.calendar}</svg>`;
const fmt = (s,options)=>parseDate(s).toLocaleDateString('de-DE',options);
const today = todayKey();
const state = {page:'home',demo:true,user:null,people:[],events:[],space:{name:'Unser Zuhause',state:'NW'},month:parseDate(today),selected:today,filter:'all',search:'',view:'month',showHolidays:true,holidays:new Map(),holidayErrors:new Set(),weather:null,weatherError:'',weatherLoading:false,location:{name:'Berlin',latitude:52.52,longitude:13.405},online:navigator.onLine,syncError:false};
Object.assign(state,{authReady:false,authView:'login',accountLink:null,mailConfigured:false,meals:[],mealWeek:parseDate(today)});
Object.assign(state,{birthdays:[],personOverviewId:null,personPeriod:'upcoming',birthdaySearch:''});
Object.assign(state,{menuOpen:false,shoppingItems:[],shoppingPeriod:'open'});
try{state.menuOpen=localStorage.getItem('miteinander-menu-open')!=='false';}catch{state.menuOpen=true;}
state.mealWeek.setDate(state.mealWeek.getDate()-(state.mealWeek.getDay()+6)%7);
let installPrompt, toastTimer;
let accountEpoch=0;
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),4500); }
async function api(path, options={}) {
 let response;
 try { response=await fetch(path,{...options,headers:{'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(15000)}); }
 catch { throw new Error('Keine Verbindung. Bitte prüfe dein Internet und versuche es erneut.'); }
 const data = await response.json();
 if(!response.ok) { if(response.status===401 && !state.demo && !path.startsWith('/api/auth/')) { state.syncError=true;clearAccount();render(); } throw new Error(data.error || 'Die Anfrage ist fehlgeschlagen.'); }
 return data;
}
function person(id) { return state.people.find(p=>p.id===id); }
function avatar(p,size='') { return `<span class="avatar ${size}" data-color="${esc(p?.color || 'sage')}">${esc(p?.name?.slice(0,1).toUpperCase() || 'Z') }</span>`; }
function allHolidays() { return [...state.holidays.entries()].filter(([key])=>key.endsWith('-'+state.space.state)).flatMap(([,value])=>value); }
function allBirthdayEntries() { return birthdayEntries(state.birthdays,state.events); }
function eventsForYear(year) { return [...state.events.filter(e=>e.category!=='Geburtstag'),...birthdayEvents(allBirthdayEntries(),year)]; }
function upcomingEvents() {
 const birthdays=allBirthdayEntries().flatMap(b=>{const date=nextBirthday(b,today);return date?birthdayEvents([b],Number(date.slice(0,4))):[];});
 return sorted([...state.events.filter(e=>e.category!=='Geburtstag' && e.date>=today),...birthdays]);
}
function filteredEvents(includeHolidays=true) { const events = eventsForYear(state.month.getFullYear()).filter(e=>(state.filter==='all' || e.personId===state.filter || (!e.personId && state.filter==='together')) && (!state.search || `${e.title} ${person(e.personId)?.name || ''} ${e.location} ${e.category}`.toLowerCase().includes(state.search.toLowerCase()))); return sorted([...events,...(includeHolidays && state.showHolidays && state.filter==='all' ? allHolidays().filter(h=>!state.search || h.title.toLowerCase().includes(state.search.toLowerCase())):[])]); }
function eventAction(e) {return e.holiday?'holiday-detail':e.birthday?'edit-birthday':'edit-event';}
function eventActionId(e) {return e.birthday?e.birthdayId:e.id;}
function ownerBadge(e) { const p=person(e.personId);return `<span class="owner-badge" data-color="${esc(p?.color || 'shared')}">${icon(p?'users':'home')}<span>${esc(p?firstName(p.name):'Alle zusammen')}</span></span>`; }
function statusLabel() { return !state.online ? 'Offline' : state.syncError ? 'Verbindung unterbrochen' : 'Gemeinsam verbunden'; }
function shell(content) { return appShell(content); }
const landscape = `<svg class="landscape" viewBox="0 0 470 280" fill="none" aria-hidden="true"><circle cx="343" cy="65" r="38" fill="#E4BD7E"/><path d="M0 234C100 144 175 115 273 187s153 23 197-9v102H0Z" fill="#BED0B4"/><path d="M0 258c76-16 133-71 219-69s129 67 251 34v57H0Z" fill="#90AF92"/><path d="M131 280c76-59 153-33 214-7l18 7Z" fill="#DDE2CB"/><path d="m237 159 54-45 53 45v67H237Z" fill="#FAF4E6"/><path d="m226 159 65-55 65 55" stroke="#546D59" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/><path d="M279 182h25v44h-25Z" fill="#91A88D"/><path d="M250 174h17v19h-17Zm65 0h16v19h-16Z" fill="#DCC397"/><path d="M380 166v79m-197-82v68" stroke="#6D8063" stroke-width="6"/><ellipse cx="379" cy="145" rx="24" ry="40" fill="#6C8F70"/><ellipse cx="182" cy="151" rx="18" ry="32" fill="#799A75"/><path d="M77 105c7-8 13-8 20 0m11-15c7-8 13-8 20 0" stroke="#899480" stroke-width="2.5" stroke-linecap="round"/><path d="M320 112V91h12v32" fill="#546D59"/></svg>`;
function pageHeading(eyebrow,title,subtitle,action='') { return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${subtitle}</p></div>${action}</div>`; }
function newButton() { return `<button class="button primary" data-action="new-event">${icon('plus')} Neuer Termin</button>`; }
function homePage() { return screens.homePage(); }
function eventRow(e,showDate=false) {
 const p=person(e.personId), color=e.holiday?'amber':p?.color || 'shared';
 return `<button class="event-row" data-action="${eventAction(e)}" data-id="${esc(eventActionId(e))}"><span class="event-marker" data-color="${color}"></span>${showDate?`<span class="event-date"><strong>${parseDate(e.date).getDate()}</strong><span>${fmt(e.date,{month:'short'}).replace('.','')}</span></span>`:`<span class="event-time">${e.time || 'Ganztägig'}</span>`}<span class="event-row-main"><strong>${e.birthday?icon('gift'):''}${esc(e.title)}</strong>${!e.holiday?ownerBadge(e):''}<span>${showDate?(e.time || 'Ganztägig')+(e.endTime?' – '+e.endTime:'')+(e.location?'<span class="separator">·</span>':''):''}${esc(e.holiday?'Feiertag'+(e.note?' · regional beachten':''):e.location || '')}</span></span>${!e.holiday?`<span class="category-tag" data-color="${color}">${esc(e.category)}</span>`:''}${icon('chevron','row-chevron')}</button>`;
}
function empty(title,copy,action,label) { return `<div class="empty-state">${icon('calendar')}<strong>${title}</strong><p>${copy}</p>${action?`<button class="text-button" data-action="${action}">${icon('plus')}${label}</button>`:''}</div>`; }
function calendarPage() { return calendarScreen(); }
function weatherIcon(code,cls='') { return icon(code===undefined?'sun':code<=1?'sun':code<=48?'cloud':code>=71&&code<=77?'snow':'rain',cls); }
function weatherLabel(code) { return code<=1?'Sonnig bis heiter':code<=3?'Wolkig':code<=48?'Neblig':code<=67?'Regnerisch':code<=77?'Schnee':code<=86?'Schauer':'Gewitter'; }
function weatherPage() {
 const w=state.weather;
 return `${pageHeading('FÜR EURE PLÄNE DRAUSSEN','Ein Blick nach draußen<span class="greeting-dot">.</span>','Damit ihr wisst, ob der Regenschirm mit muss.',`<button class="button outline" data-action="location">${icon('pin')}${esc(state.location.name)} ändern</button>`)}
 ${state.weatherError?`<div class="inline-warning spacious">${esc(state.weatherError)} <button class="text-button" data-action="retry-weather">Erneut laden</button></div>`:''}
 <section class="weather-hero"><div><div class="date-pill">${icon('pin')} ${esc(state.location.name)}</div><h2>${w?Math.round(w.current.temperature_2m):'–'}<span>°C</span></h2><h3>${w?weatherLabel(w.current.weather_code):state.weatherLoading?'Wetter wird geladen …':'Noch keine Wetterdaten'}</h3><p>${w?`Gefühlt ${Math.round(w.current.apparent_temperature)} °C · Stand ${esc(w.current.time.slice(11,16))} Uhr (Berlin)`:'Live-Wetter und eine Vorschau für die nächsten 7 Tage.'}</p></div><div class="weather-hero-art">${weatherIcon(w?.current.weather_code)}</div><div class="weather-stats"><div>${icon('wind')}<span>Wind</span><strong>${w?Math.round(w.current.wind_speed_10m):'–'} km/h</strong></div><div>${icon('drop')}<span>Luftfeuchtigkeit</span><strong>${w?w.current.relative_humidity_2m:'–'} %</strong></div><div>${icon('rain')}<span>Regenrisiko heute</span><strong>${w?w.daily.precipitation_probability_max[0] ?? '–':'–'} %</strong></div></div></section>
 <div class="section-heading"><h2>Die nächsten 7 Tage</h2><span>Ein kleiner Ausblick.</span></div><div class="forecast-grid">${w?w.daily.time.map((date,i)=>`<div class="forecast-card ${i===0?'forecast-today':''}"><strong>${i===0?'Heute':fmt(date,{weekday:'short'})}</strong><span>${fmt(date,{day:'numeric',month:'short'})}</span>${weatherIcon(w.daily.weather_code[i])}<div class="forecast-temp"><strong>${Math.round(w.daily.temperature_2m_max[i])}°</strong><span>${Math.round(w.daily.temperature_2m_min[i])}°</span></div><p>${icon('drop')}${w.daily.precipitation_probability_max[i] ?? '–'} %</p></div>`).join(''):`<div class="panel weather-empty">${empty('Das Wetter macht eine kurze Pause','Sobald Daten verfügbar sind, erscheint hier eure Vorhersage.')}</div>`}</div>
 <p class="data-attribution">Wetterdaten: <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> · Standortsuche: GeoNames · Vorhersagen können sich ändern. Kostenlose API für den Prototyp.</p>`;
}
function settingsPage() { return screens.settingsPage(); }
const screens = createScreens({state,icon,esc,fmt,today,pageHeading,newButton,eventRow,empty,avatar,allHolidays,landscape,weatherIcon,weatherLabel,upcomingEvents,allBirthdayEntries});
const appShell=createShell({state,icon,esc,avatar,statusLabel});
const calendarScreen=createCalendar({state,icon,esc,fmt,today,person,filteredEvents,eventRow,eventAction,eventActionId});
function render(force=false) {
 // Refresh the shared list without replacing another person's unfinished input.
 if(!force && state.user && state.page==='shopping' && $('#shopping-add-form',app)) {
  const template=document.createElement('template');template.innerHTML=screens.shoppingPage();
  for(const selector of ['.shopping-list','.shopping-tabs','.shopping-status']){const existing=$(selector,app),updated=$(selector,template.content);if(existing && updated)existing.replaceWith(updated);}
  return;
 }
 // Background synchronization must not replace a form while someone is typing.
 if(!force && state.user && (app.querySelector('form[data-dirty="true"]') || (app.contains(document.activeElement) && /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName)))) return;
 if(!state.authReady) { app.innerHTML='<main class="boot-screen"><img src="/icon.svg" alt=""><p>Dein Zuhause wird geöffnet …</p></main>';return; }
 if(!state.user || state.accountLink) { app.innerHTML=screens.landingPage();document.title='Anmelden · Miteinander';return; }
 const oldPlanner=$('.planner-scroll',app),scroll=oldPlanner?{top:oldPlanner.scrollTop,left:oldPlanner.scrollLeft,month:oldPlanner.dataset.month}:null;
 app.innerHTML=shell(({home:homePage,calendar:calendarPage,people:screens.peoplePage,birthdays:screens.birthdaysPage,meals:screens.mealsPage,shopping:screens.shoppingPage,weather:weatherPage,settings:settingsPage})[state.page]()); document.title=`${({home:'Startseite',calendar:'Kalender',people:'Personen & Termine',birthdays:'Geburtstage',meals:'Essensplan',shopping:'Einkaufsliste',weather:'Wetter',settings:'Einstellungen'})[state.page]} · Miteinander`;
 const planner=$('.planner-scroll',app);
 if(planner){planner.dataset.month=dateKey(state.month).slice(0,7);if(scroll && scroll.month===planner.dataset.month){planner.scrollTop=scroll.top;planner.scrollLeft=scroll.left;}else scrollCalendarTo(state.selected);}
}
function scrollCalendarTo(date) {
 const planner=$('.planner-scroll'),row=$('.planner-row[data-date="'+date+'"]',planner || app);if(!planner || !row)return;
 planner.scrollTop+=row.getBoundingClientRect().top-planner.getBoundingClientRect().top-$('.planner-header',planner).getBoundingClientRect().height-1;
}
function clearAccount() {
 accountEpoch++;state.user=null;state.demo=true;state.events=[];state.people=[];state.meals=[];state.shoppingItems=[];state.birthdays=[];state.personOverviewId=null;state.birthdaySearch='';state.mailConfigured=false;state.authView='login';state.accountLink=null;state.syncError=false;state.filter='all';state.search='';state.page='home';modal.close();
}
function applySpace(space){const changed=state.location.latitude!==space.weatherLat || state.location.longitude!==space.weatherLon;state.space=space;state.location={name:space.weatherName || 'Berlin',latitude:space.weatherLat ?? 52.52,longitude:space.weatherLon ?? 13.405};if(changed)state.weather=null;return changed;}
async function finishLogin(result) {
 const [calendar,meals,shopping]=await Promise.all([api('/api/calendar'),api('/api/meals'),api('/api/shopping')]);
 accountEpoch++;Object.assign(state,{demo:false,user:result.user,people:calendar.people,events:calendar.events,birthdays:calendar.birthdays || [],meals:meals.meals,shoppingItems:shopping.items,mailConfigured:result.mailConfigured,syncError:false,filter:'all',search:'',page:'home'});applySpace(result.space);
 history.replaceState(null,'','#home');render(true);window.scrollTo(0,0);loadHolidays();loadHolidays(parseDate(today).getFullYear()+1);loadWeather();
}
async function loadMeals() {const epoch=accountEpoch;const data=await api('/api/meals');if(epoch===accountEpoch)state.meals=data.meals;}
async function loadShopping() {const epoch=accountEpoch;const data=await api('/api/shopping');if(epoch===accountEpoch)state.shoppingItems=data.items;}
function readAccountLink() {
 const [route,query]=location.hash.slice(1).split('?');
 if(['reset-password','verify-email'].includes(route))state.accountLink={purpose:route==='reset-password'?'reset':'verify',token:new URLSearchParams(query).get('token') || ''};
 else state.accountLink=null;
}
async function loadCalendar() { const data=await api('/api/calendar'); state.people=data.people;state.events=data.events;state.birthdays=data.birthdays || [];state.syncError=false; }
const holidayLoading = new Set();
async function loadHolidays(year=state.month.getFullYear(),force=false) {
 const region=state.space.state, key=`${year}-${region}`; if(holidayLoading.has(key) || (!force && state.holidays.has(key))) return;
 holidayLoading.add(key);
 try { const data=await api(`/api/holidays?year=${year}&state=${region}`); state.holidays.set(key,data.holidays);state.holidayErrors.delete(key); }
 catch { state.holidayErrors.add(key); }
 finally {holidayLoading.delete(key); render();}
}
async function loadWeather(force=false) {
 if(state.weatherLoading || (state.weather && !force)) return;
 state.weatherLoading=true;state.weatherError='';
 const locationKey=`${state.location.latitude},${state.location.longitude}`;
 try { const weather=await api(`/api/weather?lat=${state.location.latitude}&lon=${state.location.longitude}`);if(locationKey===`${state.location.latitude},${state.location.longitude}`)state.weather=weather; }
 catch(e) {state.weatherError=e.message;}
 finally {state.weatherLoading=false;render();if(locationKey!==`${state.location.latitude},${state.location.longitude}` && state.user)loadWeather(true);}
}
function navigate(page) {
 state.page=['home','calendar','people','birthdays','meals','shopping','weather','settings'].includes(page)?page:'home';render(true);
 if(!state.user)return;
 if(state.page==='calendar') loadHolidays();
 if(state.page==='weather') loadWeather();
 if(state.page==='meals') loadMeals().then(()=>render()).catch(e=>toast(e.message));
 if(state.page==='shopping') loadShopping().then(()=>render()).catch(e=>toast(e.message));
}
function openModal(content,cls='') { modal.className=cls;modal.innerHTML=`<button type="button" class="icon-button modal-close" aria-label="Schließen">${icon('close')}</button>${content}`; $('.modal-close',modal).onclick=()=>modal.close();modal.showModal();if(matchMedia('(pointer:fine)').matches)$('[autofocus]',modal)?.focus(); }
modal.addEventListener('click',e=>{if(e.target===modal){const rect=modal.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)modal.close();}});
function formSubmit(form, callback) {
 form.addEventListener('submit',async e=>{e.preventDefault();const button=$('[type="submit"]',form); const error=$('.form-error',form);button.disabled=true; if(error)error.textContent='';try{await callback(Object.fromEntries(new FormData(form)));}catch(err){if(error)error.textContent=err.message;else toast(err.message);}finally{button.disabled=false;}});
}
function eventModal(id,defaults={}) {
 const event=id?state.events.find(e=>e.id===id):{date:state.page==='calendar'?state.selected:today,category:'Alltag',personId:state.page==='people'?(state.personOverviewId==='together'?'':state.personOverviewId || ''):state.filter!=='all' && state.filter!=='together'?state.filter:''};
 if(!event) return;
 if(!id)Object.assign(event,defaults);
 openModal(`<div class="eyebrow">PLATZ FÜR EURE PLÄNE</div><h2>${id?'Termin bearbeiten':'Ein neuer Termin'}</h2><p class="modal-subtitle">Damit alle wissen, was ansteht.</p><form id="event-form"><label>Was habt ihr vor?<input name="title" placeholder="z. B. Gemeinsam essen gehen" maxlength="120" value="${esc(event.title || '')}" required autofocus></label><div class="form-row"><label>Datum<input name="date" type="date" min="1900-01-01" max="2200-12-31" value="${esc(event.date)}" required></label><label>Für wen?<select name="personId"><option value="">Alle zusammen</option>${state.people.map(p=>`<option value="${esc(p.id)}" ${event.personId===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label></div><div class="form-row time-fields"><label>Von <span class="optional">optional</span><input name="time" type="time" value="${esc(event.time || '')}"></label><label>Bis <span class="optional">optional</span><input name="endTime" type="time" value="${esc(event.endTime || '')}"></label></div><p class="field-help time-help">Ohne Uhrzeit erscheint der Termin als ganztägig.</p><div class="form-row"><label>Kategorie<select name="category">${CATEGORIES.map(c=>`<option ${event.category===c?'selected':''}>${c}</option>`).join('')}</select></label><label>Ort <span class="optional">optional</span><input name="location" maxlength="180" placeholder="Wo findet es statt?" value="${esc(event.location || '')}"></label></div><label>Notiz <span class="optional">optional</span><textarea name="note" rows="2" maxlength="2000" placeholder="Was sollte noch jemand wissen?">${esc(event.note || '')}</textarea></label><p class="form-error" role="alert"></p><div class="modal-actions">${id?`<button type="button" class="text-button danger" id="delete-event">Termin löschen</button>`:'<span></span>'}<button class="button primary" type="submit">${icon('check')} Termin speichern</button></div></form>`);
 formSubmit($('#event-form',modal),async data=>{
  if(data.endTime && (!data.time || data.endTime<=data.time)) throw new Error('Bitte wähle ein Ende nach dem Beginn.');
  await api(id?`/api/events/${id}`:'/api/events',{method:id?'PUT':'POST',body:JSON.stringify(data)});await loadCalendar();
  modal.close();render();toast(id?'Termin aktualisiert.':'Der Termin steht im Kalender.');
 });
 $('#delete-event',modal)?.addEventListener('click',()=>{
  const title=event.title;
  openModal(`<div class="eyebrow">TERMIN ENTFERNEN</div><h2>Termin löschen?</h2><p>„${esc(title)}“ wird aus eurem gemeinsamen Kalender entfernt.</p><form id="delete-form"><p class="form-error" role="alert"></p><div class="modal-actions"><button type="button" class="button outline" id="cancel-delete">Behalten</button><button class="button danger-button" type="submit">Termin löschen</button></div></form>`);
  $('#cancel-delete',modal).onclick=()=>{modal.close();eventModal(id);};
  formSubmit($('#delete-form',modal),async()=>{await api(`/api/events/${id}`,{method:'DELETE'});await loadCalendar();modal.close();render(true);toast('Termin gelöscht.');});
 });
}
function personModal(id) {
 const p=person(id),defaultColor=p?.color || COLORS.find(c=>!state.people.some(p=>p.color===c)) || COLORS[state.people.length%COLORS.length];
 openModal(`<div class="eyebrow">EIN ACCOUNT · EURE MENSCHEN</div><h2>${p?'Person bearbeiten':'Wer gehört dazu?'}</h2><p class="modal-subtitle">Ein Vorname und eine Farbe. Ein weiterer Login ist dafür nicht nötig.</p><form id="person-form"><label>Vorname<input name="name" maxlength="60" placeholder="z. B. Anna" value="${esc(p?.name || '')}" required autofocus></label><fieldset class="color-picker"><legend>Eigene Farbe im Kalender</legend>${COLORS.map(color=>`<label class="color-option" data-color="${color}"><input type="radio" name="color" value="${color}" ${color===defaultColor?'checked':''}><span>${icon('check')}</span><span class="sr-only">${({sage:'Grün',blue:'Blau',rose:'Rosa',amber:'Gelb',violet:'Violett'})[color]}</span></label>`).join('')}</fieldset><p class="form-error" role="alert"></p><div class="modal-actions"><span></span><button class="button primary" type="submit">${icon(p?'check':'plus')}${p?'Änderungen speichern':'Person hinzufügen'}</button></div></form>`,'compact-modal');
 formSubmit($('#person-form',modal),async data=>{const result=await api(id?`/api/people/${id}`:'/api/people',{method:id?'PUT':'POST',body:JSON.stringify(data)});await loadCalendar();state.personOverviewId=result.id;modal.close();render(true);toast(p?'Name und Farbe aktualisiert.':`${data.name} ist dabei.`);});
}
function birthdayModal(id,personId='') {
 const entry=id?allBirthdayEntries().find(b=>b.id===id):null;
 if(entry?.legacyEventId){eventModal(entry.legacyEventId);return;}
 const linked=entry?.personId || personId,p=person(linked);
 openModal(`<div class="eyebrow">KEINEN GEBURTSTAG VERGESSEN</div><h2>${entry?'Geburtstag bearbeiten':'Geburtstag hinzufügen'}</h2><p class="modal-subtitle">Einmal eintragen. Jedes Jahr im Blick.</p><form id="birthday-form"><label>Für eine Person aus eurem Account?<select name="personId"><option value="">Freunde & Familie · frei eintragen</option>${state.people.map(p=>`<option value="${esc(p.id)}" ${linked===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label><label>Vorname / Name<input name="name" maxlength="60" value="${esc(entry?.name || p?.name || '')}" placeholder="z. B. Anna oder Oma Erika" required autofocus></label><div class="birthday-date-fields"><label>Tag<input type="number" inputmode="numeric" name="day" min="1" max="31" placeholder="TT" value="${entry?.day || ''}" required></label><label>Monat<select name="month" required><option value="">Monat</option>${MONTHS.map((m,i)=>`<option value="${i+1}" ${entry?.month===i+1?'selected':''}>${m}</option>`).join('')}</select></label><label>Geburtsjahr <span class="optional">optional</span><input type="number" inputmode="numeric" name="year" min="1900" max="${today.slice(0,4)}" placeholder="JJJJ" value="${entry?.year || ''}"></label></div><label>Notiz <span class="optional">optional</span><textarea name="note" rows="2" maxlength="1000" placeholder="z. B. Blumen nicht vergessen">${esc(entry?.note || '')}</textarea></label><p class="field-help">Das Geburtsjahr ist nur für die Altersanzeige nötig. Der Geburtstag erscheint automatisch jedes Jahr im Kalender.</p><p class="form-error" role="alert"></p><div class="modal-actions">${entry?'<button type="button" class="text-button danger" id="delete-birthday">Geburtstag löschen</button>':'<span></span>'}<button class="button primary" type="submit">Geburtstag speichern</button></div></form>`,'compact-modal');
 $('[name="personId"]',modal).onchange=e=>{const p=person(e.target.value);if(p)$('[name="name"]',modal).value=p.name;};
 formSubmit($('#birthday-form',modal),async data=>{await api(entry?`/api/birthdays/${entry.id}`:'/api/birthdays',{method:entry?'PUT':'POST',body:JSON.stringify(data)});await loadCalendar();modal.close();render(true);toast('Geburtstag gespeichert – jedes Jahr im Kalender.');});
 $('#delete-birthday',modal)?.addEventListener('click',()=>{
  openModal(`<div class="eyebrow">GEBURTSTAG ENTFERNEN</div><h2>Geburtstag löschen?</h2><p>Der Geburtstag von ${esc(entry.name)} wird aus eurer Liste und dem Kalender entfernt.</p><form id="delete-birthday-form"><p class="form-error" role="alert"></p><div class="modal-actions"><button type="button" id="keep-birthday" class="button outline">Behalten</button><button type="submit" class="button danger-button">Geburtstag löschen</button></div></form>`,'compact-modal');
  $('#keep-birthday',modal).onclick=()=>birthdayModal(entry.id);
  formSubmit($('#delete-birthday-form',modal),async()=>{await api(`/api/birthdays/${entry.id}`,{method:'DELETE'});await loadCalendar();modal.close();render(true);toast('Geburtstag gelöscht.');});
 });
}
function calendarOptionsModal() {
 openModal(`<div class="eyebrow">KALENDERANZEIGE</div><h2>Was möchtest du sehen?</h2><form id="calendar-options-form"><label>Person<select name="personFilter"><option value="all">Alle Personen</option><option value="together" ${state.filter==='together'?'selected':''}>Alle zusammen</option>${state.people.map(p=>`<option value="${esc(p.id)}" ${state.filter===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label><label>Termine suchen<input type="search" name="search" id="event-search" placeholder="Name, Termin oder Ort" value="${esc(state.search)}"></label><label class="calendar-checkbox"><input type="checkbox" name="holidays" ${state.showHolidays?'checked':''}>Feiertage anzeigen</label><p class="field-help">Feiertage für ${esc(STATES[state.space.state])}.</p><button class="text-button" type="button" id="calendar-region">Bundesland ändern</button><button class="button primary full-width" type="submit">Ansicht übernehmen</button></form>`,'compact-modal');
 $('#calendar-region',modal).onclick=()=>{modal.close();location.hash='settings';navigate('settings');};
 formSubmit($('#calendar-options-form',modal),async data=>{state.filter=data.personFilter;state.search=data.search;state.showHolidays=data.holidays==='on';modal.close();render(true);});
}
function calendarDayModal() {
 const items=filteredEvents().filter(e=>e.date===state.selected);
 openModal(`<div id="calendar-day-modal"><div class="eyebrow">${fmt(state.selected,{weekday:'long'})}</div><h2>${fmt(state.selected,{day:'numeric',month:'long',year:'numeric'})}</h2><div class="day-agenda">${items.length?items.map(e=>eventRow(e)).join(''):empty('Noch keine Termine','Hier ist Platz für eure Pläne.')}</div><button class="button primary full-width" data-action="new-event">${icon('plus')} Termin an diesem Tag hinzufügen</button></div>`);
}
function shoppingModal(id) {
 const item=state.shoppingItems.find(i=>i.id===id);if(!item)return;
 openModal(`<div class="eyebrow">EURE EINKAUFSLISTE</div><h2>Eintrag bearbeiten</h2><form id="shopping-edit-form"><label>Was braucht ihr?<input name="title" maxlength="120" required value="${esc(item.title)}" autofocus></label><label>Menge <span class="optional">optional</span><input name="quantity" maxlength="60" placeholder="z. B. 2 Packungen" value="${esc(item.quantity)}"></label><label>Hinzugefügt von<select name="personId"><option value="">Alle zusammen</option>${state.people.map(p=>`<option value="${esc(p.id)}" ${item.personId===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label><p class="form-error" role="alert"></p><button type="submit" class="button primary full-width">Änderungen speichern</button></form><button class="text-button danger shopping-delete" id="shopping-delete">${icon('trash')} Eintrag löschen</button>`,'compact-modal');
 formSubmit($('#shopping-edit-form',modal),async data=>{await api(`/api/shopping/${id}`,{method:'PUT',body:JSON.stringify(data)});await loadShopping();modal.close();render();toast('Einkaufsliste aktualisiert.');});
 $('#shopping-delete',modal).onclick=()=>{
  openModal(`<h2>Eintrag löschen?</h2><p>„${esc(item.title)}“ wird aus eurer gemeinsamen Einkaufsliste entfernt.</p><form id="shopping-delete-form"><p class="form-error" role="alert"></p><div class="modal-actions"><button type="button" class="button outline" id="shopping-keep">Behalten</button><button type="submit" class="button danger-button">Löschen</button></div></form>`,'compact-modal');
  $('#shopping-keep',modal).onclick=()=>shoppingModal(id);
  formSubmit($('#shopping-delete-form',modal),async()=>{await api(`/api/shopping/${id}`,{method:'DELETE'});await loadShopping();modal.close();render();toast('Eintrag gelöscht.');});
 };
}
function setMenu(open) {
 state.menuOpen=open;try{localStorage.setItem('miteinander-menu-open',String(open));}catch{}
 const layout=$('.layout');if(!layout)return;
 layout.classList.toggle('menu-open',open);layout.classList.toggle('menu-closed',!open);$('#app-sidebar').toggleAttribute('inert',!open);
 const button=$('.edge-toggle');button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',open?'Seitenmenü einklappen':'Seitenmenü ausklappen');
}
function mealModal(date,slot) {
 const meal=state.meals.find(m=>m.date===date && m.slot===slot);
 openModal(`<div class="eyebrow">${fmt(date,{weekday:'long',day:'numeric',month:'long'})}</div><h2>${slot==='lunch'?'Was gibt’s mittags?':'Was gibt’s abends?'}</h2><p class="modal-subtitle">Etwas Leckeres für euren gemeinsamen Plan.</p><form id="meal-form"><label>Gericht<input name="title" maxlength="120" placeholder="z. B. Ofengemüse mit Feta" value="${esc(meal?.title || '')}" autofocus></label><label>Notiz <span class="optional">optional</span><textarea name="note" rows="3" maxlength="1000" placeholder="Zutaten, Wünsche oder ein Rezept …">${esc(meal?.note || '')}</textarea></label><p class="field-help">Ein leeres Gericht entfernt diesen Eintrag aus dem Essensplan.</p><p class="form-error" role="alert"></p><button class="button primary full-width" type="submit">Essensplan speichern</button></form>`,'compact-modal');
 formSubmit($('#meal-form',modal),async data=>{await api('/api/meals',{method:'PUT',body:JSON.stringify({...data,date,slot})});await loadMeals();modal.close();render(true);toast('Euer Essensplan wurde gespeichert.');});
}
function passwordModal() {
 openModal(`<div class="eyebrow">DEIN ZUGANG</div><h2>Passwort ändern</h2><p class="modal-subtitle">Mit deinem aktuellen Passwort oder über einen Link per E-Mail.</p><form id="password-form"><label>Aktuelles Passwort<input name="currentPassword" type="password" maxlength="128" autocomplete="current-password" required></label><label>Neues Passwort<input name="password" type="password" minlength="8" maxlength="128" autocomplete="new-password" placeholder="Mindestens 8 Zeichen" required></label><label>Neues Passwort wiederholen<input name="confirmPassword" type="password" minlength="8" maxlength="128" autocomplete="new-password" required></label><p class="form-error" role="alert"></p><button class="button primary full-width" type="submit">Neues Passwort speichern</button></form><div class="password-email-option"><button id="password-email" class="button outline full-width">${icon('mail')} Lieber einen Link per E-Mail senden</button><p class="field-help">${state.user.emailVerified?'Der Link geht an '+esc(state.user.email)+'.':'Hinterlege und bestätige dafür zuerst deine E-Mail-Adresse in den Einstellungen.'}</p><p id="password-email-message" class="field-help" role="status"></p></div>`,'compact-modal');
 formSubmit($('#password-form',modal),async data=>{if(data.password!==data.confirmPassword)throw new Error('Die neuen Passwörter stimmen nicht überein.');const result=await api('/api/account/password',{method:'PUT',body:JSON.stringify(data)});clearAccount();history.replaceState(null,'',location.pathname);render(true);toast(result.message);});
 $('#password-email',modal).onclick=async()=>{const button=$('#password-email',modal);button.disabled=true;try{if(!state.user.emailVerified)throw new Error('Bitte bestätige zuerst deine E-Mail-Adresse in den Einstellungen.');const result=await api('/api/auth/forgot-password',{method:'POST',body:JSON.stringify({identifier:state.user.username || state.user.email})});$('#password-email-message',modal).textContent=result.message;}catch(e){$('#password-email-message',modal).textContent=e.message;}finally{button.disabled=false;}};
}
function locationModal() {
 openModal(`<div class="eyebrow">DAS WETTER BEI EUCH</div><h2>Wo seid ihr zuhause?</h2><form id="location-form"><label>Stadt oder Ort<input name="q" minlength="2" maxlength="80" placeholder="z. B. Hamburg" autofocus required></label><p class="form-error" role="alert"></p><button class="button primary" type="submit">${icon('search')} Ort suchen</button></form><div id="location-results" class="location-results"></div>`,'compact-modal');
 formSubmit($('#location-form',modal),async data=>{
  const result=await api(`/api/locations?q=${encodeURIComponent(data.q)}`);const places=result.results || [];
  $('#location-results',modal).innerHTML=places.length?places.map((p,i)=>`<button class="location-result" data-index="${i}">${icon('pin')}<span><strong>${esc(p.name)}</strong><span>${esc([p.admin1,p.country].filter(Boolean).join(', '))}</span></span>${icon('chevron')}</button>`).join(''):'<p>Kein Ort gefunden. Versuche eine größere Stadt in der Nähe.</p>';
  $('#location-results',modal).onclick=async e=>{const button=e.target.closest('[data-index]');if(!button)return;button.disabled=true;try{const p=places[Number(button.dataset.index)],result=await api('/api/location',{method:'PUT',body:JSON.stringify({name:p.name,latitude:p.latitude,longitude:p.longitude})});applySpace(result.space);modal.close();render(true);loadWeather(true);}catch(err){toast(err.message);}finally{button.disabled=false;}};
 });
}
async function handleAction(e) {
 const target=e.target.closest('[data-action]');if(!target)return;
 const action=target.dataset.action,id=target.dataset.id;
 try {
  switch(action) {
   case 'menu-toggle':setMenu(!state.menuOpen);break;
   case 'calendar-options':calendarOptionsModal();break;
   case 'calendar-reset':state.filter='all';state.search='';state.showHolidays=true;render(true);break;
   case 'fullscreen':try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('Vollbild ist in diesem Browser gerade nicht verfügbar.');}break;
   case 'shopping':location.hash='shopping';navigate('shopping');break;
   case 'shopping-period':state.shoppingPeriod=id;render();break;
   case 'shopping-edit':shoppingModal(id);break;
   case 'shopping-toggle':{const item=state.shoppingItems.find(i=>i.id===id);if(!item)return;target.disabled=true;try{await api(`/api/shopping/${id}`,{method:'PATCH',body:JSON.stringify({done:!item.done})});await loadShopping();render();}finally{target.disabled=false;}break;}
   case 'login':case 'register':case 'forgot':state.accountLink=null;state.authView=action;history.replaceState(null,'',location.pathname);render(true);window.scrollTo(0,0);break;
   case 'finish-verification':state.accountLink=null;state.authView='login';history.replaceState(null,'',state.user?'#home':location.pathname);if(state.user){const result=await api('/api/me');state.user=result.user;}render(true);break;
   case 'toggle-password':{const input=target.parentElement.querySelector('input');input.type=input.type==='password'?'text':'password';target.setAttribute('aria-pressed',String(input.type==='text'));target.setAttribute('aria-label',input.type==='text'?'Passwort verbergen':'Passwort anzeigen');break;}
   case 'change-password':passwordModal();break;
   case 'resend-verification':{target.disabled=true;try{const result=await api('/api/account/verify-email',{method:'POST',body:'{}'});toast(result.message);}finally{target.disabled=false;}break;}
   case 'meals':location.hash='meals';navigate('meals');break;
   case 'people':location.hash='people';navigate('people');break;
   case 'birthdays':location.hash='birthdays';navigate('birthdays');break;
   case 'view-person':state.personOverviewId=id || null;location.hash='people';navigate('people');break;
   case 'person-period':state.personPeriod=id;render(true);break;
   case 'edit-person':personModal(id);break;
   case 'new-birthday':birthdayModal(undefined,target.dataset.person || '');break;
   case 'edit-birthday':birthdayModal(id);break;
   case 'edit-meal':mealModal(target.dataset.date,target.dataset.slot);break;
   case 'prev-week':case 'next-week':state.mealWeek=new Date(state.mealWeek.getFullYear(),state.mealWeek.getMonth(),state.mealWeek.getDate()+(action==='prev-week'?-7:7),12);render(true);break;
   case 'this-week':state.mealWeek=parseDate(today);state.mealWeek.setDate(state.mealWeek.getDate()-(state.mealWeek.getDay()+6)%7);render(true);break;
   case 'calendar': location.hash='calendar';navigate('calendar');break;
   case 'weather': location.hash='weather';navigate('weather');break;
   case 'settings': location.hash='settings';navigate('settings');break;
   case 'new-event':eventModal();break;
   case 'new-person-event':state.selected=target.dataset.date;eventModal(undefined,{date:target.dataset.date,personId:target.dataset.person==='together'?'':target.dataset.person});break;
   case 'edit-event':eventModal(id);break;
   case 'add-person':personModal();break;
   case 'auth':clearAccount();render(true);break;
   case 'filter':state.filter=id;render(true);break;
   case 'person-filter':state.personOverviewId=id;location.hash='people';navigate('people');break;
   case 'prev-month':case 'next-month':state.month=new Date(state.month.getFullYear(),state.month.getMonth()+(action==='prev-month'?-1:1),1,12);state.selected=dateKey(state.month);render(true);loadHolidays();break;
   case 'today':state.month=parseDate(today);state.selected=today;render(true);scrollCalendarTo(today);loadHolidays();break;
   case 'select-day':state.selected=target.dataset.date;render(true);calendarDayModal();break;
   case 'search':location.hash='calendar';navigate('calendar');calendarOptionsModal();break;
   case 'holiday-detail':{const h=allHolidays().find(h=>h.id===id);if(h)openModal(`<div class="eyebrow">FEIERTAG · ${esc(STATES[state.space.state])}</div><h2>${esc(h.title)}</h2><p>${fmt(h.date,{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p>${h.note?`<div class="holiday-notice">${esc(h.note)}</div>`:''}<p class="field-help">Regional eingeschränkte Feiertage gelten nur in den genannten Orten oder Gemeinden. Bitte beachte diese Hinweise.</p><p class="data-attribution">Quelle: <a href="https://feiertage-api.de/" target="_blank" rel="noreferrer">Feiertage Webservice</a></p>`,'compact-modal');break;}
   case 'retry-holidays':loadHolidays(undefined,true);break;
   case 'retry-weather':loadWeather(true);break;
   case 'location':locationModal();break;
   case 'copy-invite':try{await navigator.clipboard.writeText(state.space.invite);toast('Einladungscode kopiert.');}catch{toast('Bitte markiere und kopiere den Code im Feld.');}break;
   case 'logout':{await api('/api/auth/logout',{method:'POST',body:'{}'});clearAccount();history.replaceState(null,'',location.pathname);render(true);window.scrollTo(0,0);toast('Du bist abgemeldet.');break;}
   case 'install':if(installPrompt){await installPrompt.prompt();installPrompt=null;}else toast(/iPad|iPhone|iPod/.test(navigator.userAgent)?'Safari: „Teilen“ → „Zum Home-Bildschirm“.':'Chrome-Menü → „App installieren“ bzw. „Zum Startbildschirm hinzufügen“.');break;
  }
 }catch(error){toast(error.message);}
}
app.addEventListener('click',handleAction);modal.addEventListener('click',handleAction);
app.addEventListener('input',e=>{if(['profile-form','email-form','space-form'].includes(e.target.form?.id))e.target.form.dataset.dirty='true';if(['event-search','birthday-search'].includes(e.target.id)){const pos=e.target.selectionStart,id=e.target.id;state[id==='event-search'?'search':'birthdaySearch']=e.target.value;render(true);const input=$('#'+id);input.focus();try{input.setSelectionRange(pos,pos);}catch{}}});
app.addEventListener('change',e=>{if(['profile-form','email-form','space-form'].includes(e.target.form?.id))e.target.form.dataset.dirty='true';if(e.target.id==='show-holidays'){state.showHolidays=e.target.checked;render(true);}});
app.addEventListener('submit',async e=>{
 const handlers={
  'profile-form':async data=>{const result=await api('/api/account/profile',{method:'PUT',body:JSON.stringify(data)});state.user=result.user;render(true);toast('Dein Anzeigename wurde gespeichert.');},
  'shopping-add-form':async data=>{await api('/api/shopping',{method:'POST',body:JSON.stringify(data)});await loadShopping();state.shoppingPeriod='open';render(true);$('#shopping-add-form [name="title"]')?.focus();},
  'login-form':async data=>finishLogin(await api('/api/auth/login',{method:'POST',body:JSON.stringify(data)})),
  'registration-form':async data=>finishLogin(await api('/api/auth/register',{method:'POST',body:JSON.stringify(data)})),
  'forgot-form':async(data,form)=>{const result=await api('/api/auth/forgot-password',{method:'POST',body:JSON.stringify(data)});$('.form-success',form).textContent=result.message;},
  'reset-form':async data=>{if(data.password!==data.confirmPassword)throw new Error('Die Passwörter stimmen nicht überein.');const result=await api('/api/auth/reset-password',{method:'POST',body:JSON.stringify({token:state.accountLink.token,password:data.password})});clearAccount();history.replaceState(null,'',location.pathname);render(true);toast(result.message);},
  'verify-form':async(data,form)=>{const result=await api('/api/auth/verify-email',{method:'POST',body:JSON.stringify({token:state.accountLink.token})});$('.form-success',form).textContent=result.message;$('[type="submit"]',form).hidden=true;history.replaceState(null,'',location.pathname);},
  'email-form':async data=>{const result=await api('/api/account/email',{method:'PUT',body:JSON.stringify(data)});state.user=result.user;state.mailConfigured=result.mailConfigured;render(true);$('#email-form .form-success').textContent=result.verificationSent?'Adresse gespeichert. Bitte öffne den Bestätigungslink in deiner E-Mail.':result.deliveryError?'Adresse gespeichert. Der Bestätigungslink konnte gerade nicht versendet werden. Bitte versuche es später erneut.':result.user.emailVerified?'Deine bestätigte E-Mail-Adresse ist gespeichert.':'Adresse gespeichert. Der E-Mail-Versand muss auf dem Server noch eingerichtet werden.';}
 };
 if(handlers[e.target.id]) {
  e.preventDefault();const form=e.target,button=$('[type="submit"]',form);button.disabled=true;$('.form-error',form).textContent='';
  try{await handlers[form.id](Object.fromEntries(new FormData(form)),form);}catch(err){$('.form-error',form).textContent=err.message;}finally{button.disabled=false;}return;
 }
 if(e.target.id!=='space-form')return;e.preventDefault();const form=e.target,data=Object.fromEntries(new FormData(form)),button=$('[type="submit"]',form);button.disabled=true;
 try {const result=await api('/api/space',{method:'PATCH',body:JSON.stringify(data)});applySpace(result.space);render(true);loadHolidays();loadHolidays(parseDate(today).getFullYear()+1);toast('Einstellungen gespeichert.');}
 catch(err){$('.form-error',form).textContent=err.message;}finally{button.disabled=false;}
});
window.addEventListener('hashchange',()=>{readAccountLink();navigate(location.hash.slice(1));window.scrollTo(0,0);});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});
for(const event of ['online','offline']) window.addEventListener(event,()=>{state.online=navigator.onLine;render();if(state.online && state.user){loadWeather(true);loadHolidays(undefined,true);sync();}});
let syncing=false;
async function sync() {
 if(!state.user || !state.online || syncing)return;syncing=true;const epoch=accountEpoch;
 try {const [account,calendar,meals,shopping]=await Promise.all([api('/api/me'),api('/api/calendar'),api('/api/meals'),api('/api/shopping')]);if(epoch!==accountEpoch)return;state.user=account.user;const locationChanged=applySpace(account.space);state.mailConfigured=account.mailConfigured;state.events=calendar.events;state.people=calendar.people;state.birthdays=calendar.birthdays || [];state.meals=meals.meals;state.shoppingItems=shopping.items;state.syncError=false;render();loadHolidays();if(locationChanged)loadWeather(true);}
 catch{state.syncError=true;render();}finally{syncing=false;}
}
setInterval(()=>{if(!document.hidden)sync();},15000);
setInterval(()=>{if(!document.hidden && state.page==='shopping')sync();},5000);
document.addEventListener('fullscreenchange',()=>render(true));
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(state.user && state.page==='calendar')render();},100);});
document.addEventListener('visibilitychange',()=>{if(!document.hidden && state.user){sync();loadWeather(true);}});
async function boot() {
 readAccountLink();render();
 try {const account=await api('/api/me');const [calendar,meals,shopping]=await Promise.all([api('/api/calendar'),api('/api/meals'),api('/api/shopping')]);state.demo=false;state.user=account.user;applySpace(account.space);state.mailConfigured=account.mailConfigured;state.people=calendar.people;state.events=calendar.events;state.birthdays=calendar.birthdays || [];state.meals=meals.meals;state.shoppingItems=shopping.items;}catch{}
 state.authReady=true;navigate(location.hash.slice(1));
 if(state.user){loadHolidays();loadHolidays(parseDate(today).getFullYear()+1);loadWeather();}
 if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
}
boot();
