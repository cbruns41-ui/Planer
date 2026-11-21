export const STATES = {BW:'Baden-Württemberg',BY:'Bayern',BE:'Berlin',BB:'Brandenburg',HB:'Bremen',HH:'Hamburg',HE:'Hessen',MV:'Mecklenburg-Vorpommern',NI:'Niedersachsen',NW:'Nordrhein-Westfalen',RP:'Rheinland-Pfalz',SL:'Saarland',SN:'Sachsen',ST:'Sachsen-Anhalt',SH:'Schleswig-Holstein',TH:'Thüringen'};
export const COLORS = ['sage','blue','rose','amber','violet'];
export const CATEGORIES = ['Alltag','Arbeit','Gesundheit','Freizeit','Geburtstag'];
export function dateKey(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
export function parseDate(s) { return new Date(`${s}T12:00:00`); }
export function todayKey() { return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()); }
export function monthDays(year, month) { const first = new Date(year,month,1,12), offset = (first.getDay()+6)%7; return Array.from({length:42},(_,i)=>new Date(year,month,i-offset+1,12)); }
export function sorted(events) { return [...events].sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'').localeCompare(b.time||'')); }
export const MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
export function firstName(name) { return String(name || '').trim().split(/\s+/)[0]; }
export function birthdayDate(birthday,year) {
 if(birthday.year && year<birthday.year)return null;
 const date=new Date(year,birthday.month-1,birthday.day,12);
 return date.getMonth()===birthday.month-1 && date.getDate()===birthday.day ? dateKey(date) : null;
}
export function nextBirthday(birthday,from=todayKey()) {
 for(let year=Number(from.slice(0,4));year<=Number(from.slice(0,4))+8;year++){const date=birthdayDate(birthday,year);if(date && date>=from)return date;}
 return null;
}
export function birthdayEntries(birthdays,events) {
 return [...birthdays,...events.filter(e=>e.category==='Geburtstag').map(e=>({id:'legacy-'+e.id,legacyEventId:e.id,name:e.title,month:Number(e.date.slice(5,7)),day:Number(e.date.slice(8,10)),year:null,personId:e.personId,note:e.note}))];
}
export function birthdayEvents(entries,year) {
 return entries.map(b=>({id:'birthday-'+b.id,birthdayId:b.id,legacyEventId:b.legacyEventId,birthday:true,title:b.legacyEventId?b.name:`${b.name} hat Geburtstag`,date:birthdayDate(b,year),time:'',endTime:'',personId:b.personId,category:'Geburtstag',note:b.note || '',location:''})).filter(e=>e.date);
}
export function daysUntil(date,from=todayKey()) { const utc=s=>Date.UTC(...s.split('-').map((n,i)=>Number(n)-(i===1?1:0)));return Math.round((utc(date)-utc(from))/86400000); }
export function demoData() {
 const base = parseDate(todayKey()); const day = (offset)=>dateKey(new Date(base.getFullYear(),base.getMonth(),base.getDate()+offset,12));
 return { people:[{id:'p1',name:'Anna',color:'sage'},{id:'p2',name:'Ben',color:'blue'},{id:'p3',name:'Lina',color:'rose'}], events:[
  {id:'demo-1',title:'Gemeinsam frühstücken',date:day(0),time:'09:00',endTime:'10:00',personId:'',category:'Alltag',location:'Zuhause',note:'Zeit für uns. Mit frischen Brötchen!'},
  {id:'demo-2',title:'Eine Runde ins Grüne',date:day(0),time:'14:00',endTime:'16:00',personId:'p1',category:'Freizeit',location:'Stadtpark',note:''},
  {id:'demo-3',title:'Team-Meeting',date:day(1),time:'09:30',endTime:'10:30',personId:'p2',category:'Arbeit',location:'Büro',note:''},
  {id:'demo-4',title:'Zahnarzt',date:day(2),time:'15:00',endTime:'15:30',personId:'p1',category:'Gesundheit',location:'Praxis am Markt',note:''},
  {id:'demo-5',title:'Tanzkurs',date:day(3),time:'16:00',endTime:'17:00',personId:'p3',category:'Freizeit',location:'Tanzstudio',note:''},
  {id:'demo-6',title:'Pizza & Spieleabend',date:day(5),time:'18:30',endTime:'',personId:'',category:'Freizeit',location:'Zuhause',note:'Jeder bringt sein Lieblingsspiel mit.'},
  {id:'demo-7',title:'Omas Geburtstag',date:day(8),time:'',endTime:'',personId:'',category:'Geburtstag',location:'Bei Oma',note:'Blumen nicht vergessen.'},
  {id:'demo-8',title:'Wochenmarkt',date:day(6),time:'10:00',endTime:'11:00',personId:'p2',category:'Alltag',location:'Marktplatz',note:''}
 ], space:{name:'Unser Zuhause',state:'NW'} };
}
