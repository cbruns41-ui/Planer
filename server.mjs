import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mailConfigured, sendAccountMail } from './mail.mjs';
import { isIP } from 'node:net';

const root = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(process.env.DATA_DIR || resolve(root, 'data'));
await mkdir(dataDir, { recursive: true });
const db = new DatabaseSync(resolve(dataDir, 'calendar.sqlite'));
db.exec('PRAGMA busy_timeout=5000');
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS spaces(id TEXT PRIMARY KEY, name TEXT NOT NULL, invite TEXT UNIQUE NOT NULL, state TEXT NOT NULL DEFAULT 'NW');
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, password TEXT NOT NULL, space_id TEXT NOT NULL REFERENCES spaces(id));
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS people(id TEXT PRIMARY KEY, space_id TEXT NOT NULL REFERENCES spaces(id), name TEXT NOT NULL, color TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY, space_id TEXT NOT NULL REFERENCES spaces(id), title TEXT NOT NULL, date TEXT NOT NULL, time TEXT NOT NULL, end_time TEXT NOT NULL, person_id TEXT REFERENCES people(id), category TEXT NOT NULL, location TEXT NOT NULL, note TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS event_space ON events(space_id, date);
 CREATE INDEX IF NOT EXISTS session_expiry ON sessions(expires);`);
// Add account fields without replacing existing calendars or user data.
const userColumns = new Set(db.prepare('PRAGMA table_info(users)').all().map(c=>c.name));
if (!userColumns.has('username')) db.exec('ALTER TABLE users ADD COLUMN username TEXT COLLATE NOCASE');
if (!userColumns.has('email_verified')) db.exec('ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0');
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS user_username ON users(username COLLATE NOCASE);
 CREATE TABLE IF NOT EXISTS account_tokens(token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), purpose TEXT NOT NULL, email TEXT NOT NULL, expires INTEGER NOT NULL, created INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS meals(id TEXT PRIMARY KEY, space_id TEXT NOT NULL REFERENCES spaces(id), date TEXT NOT NULL, slot TEXT NOT NULL, title TEXT NOT NULL, note TEXT NOT NULL, UNIQUE(space_id,date,slot));`);
db.exec(`CREATE TABLE IF NOT EXISTS birthdays(id TEXT PRIMARY KEY, space_id TEXT NOT NULL REFERENCES spaces(id), name TEXT NOT NULL, month INTEGER NOT NULL, day INTEGER NOT NULL, year INTEGER, person_id TEXT REFERENCES people(id), note TEXT NOT NULL);
 CREATE UNIQUE INDEX IF NOT EXISTS birthday_person ON birthdays(person_id) WHERE person_id IS NOT NULL;
 CREATE INDEX IF NOT EXISTS birthday_space ON birthdays(space_id,month,day);`);
const spaceColumns=new Set(db.prepare('PRAGMA table_info(spaces)').all().map(c=>c.name));
for(const [name,type,value] of [['weather_name','TEXT',"'Berlin'"],['weather_lat','REAL','52.52'],['weather_lon','REAL','13.405']])if(!spaceColumns.has(name))db.exec(`ALTER TABLE spaces ADD COLUMN ${name} ${type} NOT NULL DEFAULT ${value}`);
db.exec(`CREATE TABLE IF NOT EXISTS shopping(id TEXT PRIMARY KEY, space_id TEXT NOT NULL REFERENCES spaces(id), title TEXT NOT NULL, quantity TEXT NOT NULL, person_id TEXT REFERENCES people(id), done INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS shopping_space ON shopping(space_id,done,created_at);`);
const derive = promisify(scrypt);
const hash = (s) => createHash('sha256').update(s).digest('hex');
const token = () => randomBytes(24).toString('hex');
async function passwordHash(password) { const salt=randomBytes(16).toString('hex');return `${salt}:${(await derive(password,salt,64)).toString('hex')}`; }
async function passwordMatches(password, encoded) { const [salt,expected]=encoded?.split(':') || ['dummy-salt','00'.repeat(64)];return timingSafeEqual(await derive(password,salt,64),Buffer.from(expected,'hex')); }
function validPassword(password) { if(typeof password!=='string' || password.length<8 || password.length>128) throw new ApiError(400,'Das Passwort muss 8 bis 128 Zeichen lang sein.');return password; }
// The requested starter account is created once; a changed password is never reset at startup.
if (process.env.SEED_BRUNS !== 'false' && !db.prepare('SELECT id FROM users WHERE username=? COLLATE NOCASE').get('Bruns')) {
 if(process.env.NODE_ENV==='production' && (!process.env.SEED_PASSWORD || process.env.SEED_PASSWORD.length<12))throw new Error('Für das erste Produktivkonto SEED_PASSWORD mit mindestens 12 Zeichen konfigurieren.');
 const id=randomUUID(), spaceId=randomUUID(), password=await passwordHash(process.env.SEED_PASSWORD || 'Test1234');
 db.exec('BEGIN');
 try {
  db.prepare('INSERT INTO spaces(id,name,invite) VALUES(?,?,?)').run(spaceId,'Zuhause Bruns',token());
  db.prepare('INSERT INTO users(id,email,name,password,space_id,username) VALUES(?,?,?,?,?,?)').run(id,'','Bruns',password,spaceId,'Bruns');
  db.prepare('INSERT INTO people VALUES(?,?,?,?)').run(randomUUID(),spaceId,'Bruns','sage');
  db.exec('COMMIT');
 } catch(e) {db.exec('ROLLBACK');throw e;}
}
const states = ['BW','BY','BE','BB','HB','HH','HE','MV','NI','NW','RP','SL','SN','ST','SH','TH'];
const colors = ['sage','blue','rose','amber','violet'];
const categories = ['Alltag','Arbeit','Gesundheit','Freizeit','Geburtstag'];
const rates = new Map();
const cache = new Map();
class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }
const isConstraint=e=>e.code?.includes('CONSTRAINT') || (Number(e.errcode)&255)===19;
function text(value, max, required = false) {
 if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) throw new ApiError(400, 'Bitte prüfe die Eingaben.');
 return value.trim();
}
function json(res, status, data) { res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store' }); res.end(JSON.stringify(data)); }
async function body(req) {
 if (!req.headers['content-type']?.startsWith('application/json')) throw new ApiError(415, 'JSON erwartet.');
 let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 20000) throw new ApiError(413, 'Die Eingabe ist zu groß.'); }
 try { const b = JSON.parse(raw); if (!b || Array.isArray(b) || typeof b !== 'object') throw 0; return b; } catch { throw new ApiError(400, 'Ungültige Eingabe.'); }
}
function session(req) {
 const value = req.headers.cookie?.match(/(?:^|;\s*)session=([a-f0-9]{48})(?:;|$)/)?.[1];
 const user = value && db.prepare('SELECT u.id,u.name,u.username,u.email,u.email_verified,u.space_id FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.token=? AND s.expires>?').get(hash(value), Date.now());
 if (!user) throw new ApiError(401, 'Bitte melde dich an.');
 return user;
}
function cookie(res, value, maxAge = 2592000) { res.setHeader('Set-Cookie', `session=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${process.env.COOKIE_SECURE === 'true' ? '; Secure' : ''}`); }
function account(user) { return { user: { id:user.id, name:user.name, username:user.username || '', email:user.email, emailVerified:Boolean(user.email_verified) }, space:db.prepare('SELECT id,name,invite,state,weather_name AS weatherName,weather_lat AS weatherLat,weather_lon AS weatherLon FROM spaces WHERE id=?').get(user.space_id), mailConfigured:mailConfigured() }; }
function rate(req) {
 const forwarded=req.headers['x-real-ip'];
 const key = process.env.TRUST_PROXY==='true' && typeof forwarded==='string' && isIP(forwarded) ? forwarded : req.socket.remoteAddress;
 const now = Date.now(); const entry = rates.get(key);
 if (!entry || entry.until < now) rates.set(key, { count:1, until:now + 60000 });
 else if (++entry.count > 12) throw new ApiError(429, 'Zu viele Versuche. Bitte warte eine Minute.');
}
async function signIn(res, user) { const key = token(); db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(key), user.id, Date.now()+2592000000); cookie(res,key); json(res,200,account(db.prepare('SELECT * FROM users WHERE id=?').get(user.id))); }
function validDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number(value.slice(0,4))>=1900 && Number(value.slice(0,4))<=2200 && Number.isFinite(Date.parse(value)) && new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value; }
async function issueMail(user,purpose) {
 if(!mailConfigured()) throw new ApiError(503,'Der E-Mail-Versand ist auf dem Server noch nicht eingerichtet.');
 const latest=db.prepare('SELECT created FROM account_tokens WHERE user_id=? AND purpose=? ORDER BY created DESC LIMIT 1').get(user.id,purpose);
 if(latest && Date.now()-latest.created<60000) throw new ApiError(429,'Ein Link wurde gerade versendet. Bitte warte eine Minute.');
 const secret=token(), digest=hash(secret), now=Date.now();
 db.prepare('INSERT INTO account_tokens VALUES(?,?,?,?,?,?)').run(digest,user.id,purpose,user.email,now+(purpose==='verify'?86400000:1800000),now);
 try {await sendAccountMail(user.email,purpose,secret);}catch {db.prepare('DELETE FROM account_tokens WHERE token=?').run(digest);throw new ApiError(503,'Die E-Mail konnte nicht versendet werden. Bitte versuche es später erneut.');}
 db.prepare('DELETE FROM account_tokens WHERE user_id=? AND purpose=? AND token<>? AND created<=?').run(user.id,purpose,digest,now);
}
function findAccountToken(secret,purpose) {
 if(typeof secret!=='string' || !/^[a-f0-9]{48}$/.test(secret)) throw new ApiError(400,'Dieser Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.');
 const row=db.prepare('SELECT t.*,u.email AS current_email,u.email_verified FROM account_tokens t JOIN users u ON u.id=t.user_id WHERE t.token=? AND t.purpose=? AND t.expires>?').get(hash(secret),purpose,Date.now());
 if(!row || row.email!==row.current_email || (purpose==='reset' && !row.email_verified)) throw new ApiError(400,'Dieser Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.');return row;
}
function validateEvent(b, user) {
 const title = text(b.title,120,true), date = text(b.date,10,true), time = text(b.time ?? '',5), endTime = text(b.endTime ?? '',5);
 if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number(date.slice(0,4)) < 1900 || Number(date.slice(0,4)) > 2200 || !Number.isFinite(Date.parse(date)) || new Date(date+'T12:00:00Z').toISOString().slice(0,10) !== date) throw new ApiError(400,'Ungültiges Datum.');
 if ([time,endTime].some(t => t && !/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) || (endTime && (!time || endTime <= time))) throw new ApiError(400,'Das Ende muss nach dem Beginn liegen.');
 const personId = b.personId || null;
 if (personId && !db.prepare('SELECT id FROM people WHERE id=? AND space_id=?').get(personId,user.space_id)) throw new ApiError(400,'Person nicht gefunden.');
 if (!categories.includes(b.category)) throw new ApiError(400,'Ungültige Kategorie.');
 return [title,date,time,endTime,personId,b.category,text(b.location ?? '',180),text(b.note ?? '',2000)];
}
function validateBirthday(b,user) {
 const name=text(b.name,60,true),month=Number(b.month),day=Number(b.day),year=b.year==='' || b.year==null?null:Number(b.year),personId=b.personId || null;
 const checkYear=year ?? 2000, date=new Date(checkYear,month-1,day,12);
 if(!Number.isInteger(month) || !Number.isInteger(day) || month<1 || month>12 || day<1 || day>31 || (year!==null && (!Number.isInteger(year) || year<1900 || year>Number(new Intl.DateTimeFormat('en',{timeZone:'Europe/Berlin',year:'numeric'}).format(new Date())))) || date.getMonth()!==month-1 || date.getDate()!==day) throw new ApiError(400,'Bitte gib ein gültiges Geburtsdatum ein. Das Geburtsjahr ist optional.');
 if(personId && !db.prepare('SELECT id FROM people WHERE id=? AND space_id=?').get(personId,user.space_id))throw new ApiError(400,'Person nicht gefunden.');
 return [name,month,day,year,personId,text(b.note ?? '',1000)];
}
function writeBirthday(b,user,id=null) {
 const values=validateBirthday(b,user);
 try {
  if(id)db.prepare('UPDATE birthdays SET name=?,month=?,day=?,year=?,person_id=?,note=? WHERE id=? AND space_id=?').run(...values,id,user.space_id);
  else {id=randomUUID();db.prepare('INSERT INTO birthdays VALUES(?,?,?,?,?,?,?,?)').run(id,user.space_id,...values);}
 }catch(e){if(isConstraint(e))throw new ApiError(409,'Für diese Person ist bereits ein Geburtstag eingetragen. Du kannst ihn in der Geburtstagsliste bearbeiten.');throw e;}
 return id;
}
function shoppingValues(b,user) {
 const title=text(b.title,120,true),quantity=text(b.quantity ?? '',60),personId=b.personId || null;
 if(personId && !db.prepare('SELECT id FROM people WHERE id=? AND space_id=?').get(personId,user.space_id))throw new ApiError(400,'Person nicht gefunden.');
 return [title,quantity,personId];
}
async function external(url, ttl) {
 const key = url.toString(); const saved = cache.get(key); if (saved && saved.until > Date.now()) return saved.data;
 try { const response = await fetch(url, { signal:AbortSignal.timeout(9000) }); if (!response.ok) throw 0; const data = await response.json(); cache.set(key,{data,until:Date.now()+ttl}); return data; }
 catch { throw new ApiError(503,'Der Datendienst ist gerade nicht erreichbar. Bitte versuche es später erneut.'); }
}
async function api(req,res,url) {
 const path = url.pathname, method = req.method;
 if (!['GET','HEAD'].includes(method)) {
  const origin = req.headers.origin;
  const expected = process.env.PUBLIC_ORIGIN || `http://${req.headers.host}`;
  if (origin && origin !== expected) throw new ApiError(403,'Diese Anfrage ist nicht erlaubt.');
 }
 if (path === '/api/health' && method === 'GET') return json(res,200,{status:'ok'});
 if (path === '/api/auth/register' && method === 'POST') {
  rate(req); const b = await body(req); const name = text(b.name,60,true), email = text(b.email,254,true).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof b.password !== 'string' || b.password.length < 12 || b.password.length > 128) throw new ApiError(400,'Bitte verwende eine gültige E-Mail und mindestens 12 Zeichen als Passwort.');
  const username=b.username ? text(b.username,40,true) : null;
  if(username && !/^[\p{L}\p{N}_.-]{3,40}$/u.test(username)) throw new ApiError(400,'Der Nutzername braucht 3 bis 40 Buchstaben, Zahlen, Punkte, Unterstriche oder Bindestriche.');
  const password = await passwordHash(b.password);
  const invite = text(b.invite ?? '',48); let space;
  if (invite) { space = db.prepare('SELECT * FROM spaces WHERE invite=?').get(invite); if (!space) throw new ApiError(400,'Der Einladungscode ist ungültig.'); }
  const id = randomUUID(), spaceId = space?.id || randomUUID();
  db.exec('BEGIN');
  try {
   if (!space) db.prepare('INSERT INTO spaces(id,name,invite) VALUES(?,?,?)').run(spaceId,'Unser Zuhause',token());
   db.prepare('INSERT INTO users(id,email,name,password,space_id,username) VALUES(?,?,?,?,?,?)').run(id,email,name,password,spaceId,username);
   const count = db.prepare('SELECT COUNT(*) AS n FROM people WHERE space_id=?').get(spaceId).n;
   db.prepare('INSERT INTO people VALUES(?,?,?,?)').run(randomUUID(),spaceId,name,colors[count%colors.length]);
   db.exec('COMMIT');
  } catch(e) { db.exec('ROLLBACK'); if (e.code?.includes('CONSTRAINT')) throw new ApiError(409,'Dieses Konto kann nicht angelegt werden. Nutze gegebenenfalls die Anmeldung.'); throw e; }
  return signIn(res,{id,name,email,space_id:spaceId});
 }
 if (path === '/api/auth/login' && method === 'POST') {
  rate(req); const b = await body(req); const identifier = text(b.identifier ?? b.email,254,true).toLowerCase();
  if (typeof b.password !== 'string' || !b.password.length || b.password.length > 128) throw new ApiError(400,'Bitte prüfe die Eingaben.');
  const password = b.password;
  const user = identifier.includes('@') ? db.prepare('SELECT * FROM users WHERE email=?').get(identifier) : db.prepare('SELECT * FROM users WHERE username=? COLLATE NOCASE').get(identifier);
  if (!await passwordMatches(password,user?.password) || !user) throw new ApiError(401,'Nutzername oder Passwort stimmt nicht.');
  return signIn(res,user);
 }
 if (path === '/api/auth/logout' && method === 'POST') { const key = req.headers.cookie?.match(/session=([a-f0-9]{48})/)?.[1]; if(key) db.prepare('DELETE FROM sessions WHERE token=?').run(hash(key)); cookie(res,'',0); return json(res,200,{ok:true}); }
 if (path === '/api/auth/forgot-password' && method === 'POST') {
  rate(req);const b=await body(req), identifier=text(b.identifier,254,true).toLowerCase();
  if(!mailConfigured()) throw new ApiError(503,'Der E-Mail-Versand ist auf dem Server noch nicht eingerichtet. Du kannst dein Passwort nach der Anmeldung in den Einstellungen ändern.');
  const user=identifier.includes('@')?db.prepare('SELECT * FROM users WHERE email=?').get(identifier):db.prepare('SELECT * FROM users WHERE username=? COLLATE NOCASE').get(identifier);
  // Same response and asynchronous delivery for existing and unknown accounts.
  if(user?.email && user.email_verified) issueMail(user,'reset').catch(()=>{});
  return json(res,200,{message:'Wenn zu diesem Konto eine bestätigte E-Mail-Adresse hinterlegt ist, erhältst du einen Link zum Ändern deines Passworts.'});
 }
 if (path === '/api/auth/reset-password' && method === 'POST') {
  rate(req);const b=await body(req), row=findAccountToken(b.token,'reset'), password=await passwordHash(validPassword(b.password));
  db.exec('BEGIN');
  try {findAccountToken(b.token,'reset');db.prepare('UPDATE users SET password=? WHERE id=?').run(password,row.user_id);db.prepare('DELETE FROM account_tokens WHERE user_id=?').run(row.user_id);db.prepare('DELETE FROM sessions WHERE user_id=?').run(row.user_id);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
  cookie(res,'',0);return json(res,200,{message:'Dein Passwort wurde geändert. Bitte melde dich neu an.'});
 }
 if (path === '/api/auth/verify-email' && method === 'POST') {
  rate(req);const b=await body(req), row=findAccountToken(b.token,'verify');
  db.exec('BEGIN');try{db.prepare('UPDATE users SET email_verified=1 WHERE id=?').run(row.user_id);db.prepare('DELETE FROM account_tokens WHERE user_id=? AND purpose=?').run(row.user_id,'verify');db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
  return json(res,200,{message:'Deine E-Mail-Adresse ist bestätigt. Du kannst jetzt Passwort-Links anfordern.'});
 }
 if (path === '/api/holidays' && method === 'GET') {
  const year = Number(url.searchParams.get('year')), state = url.searchParams.get('state');
  if (!Number.isInteger(year) || year < 1900 || year > 2200 || !states.includes(state)) throw new ApiError(400,'Ungültiges Jahr oder Bundesland.');
  const data = await external(`https://feiertage-api.de/api/?jahr=${year}&nur_land=${state}`,86400000);
  return json(res,200,{holidays:Object.entries(data).map(([title,v])=>({id:`holiday-${v.datum}-${title}`,title,date:v.datum,note:v.hinweis || '',holiday:true,category:'Feiertag'})).filter(h=>/^\d{4}-\d{2}-\d{2}$/.test(h.date)),source:'feiertage-api.de'});
 }
 if (path === '/api/weather' && method === 'GET') {
  const lat = Number(url.searchParams.get('lat')), lon = Number(url.searchParams.get('lon'));
  if (!url.searchParams.has('lat') || !url.searchParams.has('lon') || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat)>90 || Math.abs(lon)>180) throw new ApiError(400,'Ungültiger Standort.');
  return json(res,200,await external(`https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=7&timezone=Europe%2FBerlin`,600000));
 }
 if (path === '/api/locations' && method === 'GET') { const q = text(url.searchParams.get('q'),80,true); return json(res,200,await external(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=de&format=json`,3600000)); }
 const user = session(req);
 if (path === '/api/me' && method === 'GET') return json(res,200,account(user));
 if(path==='/api/location' && method==='PUT') {
  const b=await body(req),name=text(b.name,80,true),latitude=b.latitude,longitude=b.longitude;
  if(typeof latitude!=='number' || typeof longitude!=='number' || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude)>90 || Math.abs(longitude)>180)throw new ApiError(400,'Ungültiger Standort.');
  db.prepare('UPDATE spaces SET weather_name=?,weather_lat=?,weather_lon=? WHERE id=?').run(name,latitude,longitude,user.space_id);
  return json(res,200,account(user));
 }
 if(path==='/api/shopping' && method==='GET')return json(res,200,{items:db.prepare('SELECT id,title,quantity,person_id AS personId,done,created_at AS createdAt,updated_at AS updatedAt FROM shopping WHERE space_id=? ORDER BY done,created_at,id').all(user.space_id).map(item=>({...item,done:Boolean(item.done)}))});
 if(path==='/api/shopping' && method==='POST') {
  const values=shoppingValues(await body(req),user),id=randomUUID(),now=Date.now();
  db.prepare('INSERT INTO shopping VALUES(?,?,?,?,?,0,?,?)').run(id,user.space_id,...values,now,now);return json(res,201,{id});
 }
 const shoppingMatch=path.match(/^\/api\/shopping\/([a-f0-9-]{36})$/);
 if(shoppingMatch && ['PUT','PATCH','DELETE'].includes(method)) {
  const id=shoppingMatch[1];if(!db.prepare('SELECT id FROM shopping WHERE id=? AND space_id=?').get(id,user.space_id))throw new ApiError(404,'Eintrag nicht gefunden.');
  if(method==='DELETE')db.prepare('DELETE FROM shopping WHERE id=? AND space_id=?').run(id,user.space_id);
  else if(method==='PATCH') {const b=await body(req);if(typeof b.done!=='boolean')throw new ApiError(400,'Ungültiger Erledigt-Status.');db.prepare('UPDATE shopping SET done=?,updated_at=? WHERE id=? AND space_id=?').run(b.done?1:0,Date.now(),id,user.space_id);}
  else db.prepare('UPDATE shopping SET title=?,quantity=?,person_id=?,updated_at=? WHERE id=? AND space_id=?').run(...shoppingValues(await body(req),user),Date.now(),id,user.space_id);
  return json(res,200,{ok:true});
 }
 if (path === '/api/account/email' && method === 'PUT') {
  rate(req);const b=await body(req), email=text(b.email,254,true).toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400,'Bitte gib eine gültige E-Mail-Adresse ein.');
  const current=db.prepare('SELECT * FROM users WHERE id=?').get(user.id);
  if(typeof b.password!=='string' || b.password.length>128 || !await passwordMatches(b.password,current.password)) throw new ApiError(400,'Das aktuelle Passwort stimmt nicht.');
  if(email!==current.email) {
   try{db.prepare('UPDATE users SET email=?,email_verified=0 WHERE id=?').run(email,user.id);}catch(e){if(e.code?.includes('CONSTRAINT'))throw new ApiError(409,'Diese E-Mail-Adresse kann nicht verwendet werden.');throw e;}
   db.prepare('DELETE FROM account_tokens WHERE user_id=?').run(user.id);
  }
  const updated=db.prepare('SELECT * FROM users WHERE id=?').get(user.id);let verificationSent=false, deliveryError=false;
  if(mailConfigured() && !updated.email_verified) {try{await issueMail(updated,'verify');verificationSent=true;}catch{deliveryError=true;}}
  return json(res,200,{...account(updated),verificationSent,deliveryError});
 }
 if (path === '/api/account/verify-email' && method === 'POST') {
  rate(req);if(!user.email) throw new ApiError(400,'Bitte hinterlege zuerst eine E-Mail-Adresse.');if(user.email_verified) return json(res,200,{message:'Deine Adresse ist bereits bestätigt.'});await issueMail(user,'verify');return json(res,200,{message:'Der Bestätigungslink wurde versendet. Er ist 24 Stunden gültig.'});
 }
 if (path === '/api/account/password' && method === 'PUT') {
  rate(req);const b=await body(req),current=db.prepare('SELECT password FROM users WHERE id=?').get(user.id);
  if(typeof b.currentPassword!=='string' || b.currentPassword.length>128 || !await passwordMatches(b.currentPassword,current.password)) throw new ApiError(400,'Das aktuelle Passwort stimmt nicht.');
  const encoded=await passwordHash(validPassword(b.password));
  db.exec('BEGIN');try{db.prepare('UPDATE users SET password=? WHERE id=?').run(encoded,user.id);db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);db.prepare('DELETE FROM account_tokens WHERE user_id=?').run(user.id);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
  cookie(res,'',0);return json(res,200,{message:'Passwort gespeichert. Bitte melde dich neu an.'});
 }
 if (path === '/api/meals' && method === 'GET') return json(res,200,{meals:db.prepare('SELECT id,date,slot,title,note FROM meals WHERE space_id=? ORDER BY date,slot').all(user.space_id)});
 if (path === '/api/meals' && method === 'PUT') {
  const b=await body(req),date=text(b.date,10,true),title=text(b.title,120),note=text(b.note ?? '',1000),slot=text(b.slot,20,true);
  if(!validDate(date) || !['lunch','dinner'].includes(slot)) throw new ApiError(400,'Bitte prüfe Datum und Mahlzeit.');
  if(!title) db.prepare('DELETE FROM meals WHERE space_id=? AND date=? AND slot=?').run(user.space_id,date,slot);
  else db.prepare('INSERT INTO meals VALUES(?,?,?,?,?,?) ON CONFLICT(space_id,date,slot) DO UPDATE SET title=excluded.title,note=excluded.note').run(randomUUID(),user.space_id,date,slot,title,note);
  return json(res,200,{ok:true});
 }
 if (path === '/api/calendar' && method === 'GET') return json(res,200,{people:db.prepare('SELECT id,name,color FROM people WHERE space_id=? ORDER BY rowid').all(user.space_id),events:db.prepare('SELECT id,title,date,time,end_time AS endTime,person_id AS personId,category,location,note FROM events WHERE space_id=? ORDER BY date,time').all(user.space_id),birthdays:db.prepare('SELECT id,name,month,day,year,person_id AS personId,note FROM birthdays WHERE space_id=? ORDER BY month,day,name').all(user.space_id)});
 if (path === '/api/space' && method === 'PATCH') { const b = await body(req); const name = text(b.name,60,true); if(!states.includes(b.state)) throw new ApiError(400,'Ungültiges Bundesland.'); db.prepare('UPDATE spaces SET name=?,state=? WHERE id=?').run(name,b.state,user.space_id); return json(res,200,account(user)); }
 if (path === '/api/people' && method === 'POST') { const b = await body(req); const name = text(b.name,60,true); if(!colors.includes(b.color)) throw new ApiError(400,'Ungültige Farbe.'); const id = randomUUID(); db.prepare('INSERT INTO people VALUES(?,?,?,?)').run(id,user.space_id,name,b.color); return json(res,201,{id,name,color:b.color}); }
 const personMatch=path.match(/^\/api\/people\/([a-f0-9-]{36})$/);
 if(personMatch && method==='PUT') {
  if(!db.prepare('SELECT id FROM people WHERE id=? AND space_id=?').get(personMatch[1],user.space_id))throw new ApiError(404,'Person nicht gefunden.');
  const b=await body(req),name=text(b.name,60,true);if(!colors.includes(b.color))throw new ApiError(400,'Ungültige Farbe.');
  db.exec('BEGIN');try{db.prepare('UPDATE people SET name=?,color=? WHERE id=? AND space_id=?').run(name,b.color,personMatch[1],user.space_id);db.prepare('UPDATE birthdays SET name=? WHERE person_id=? AND space_id=?').run(name,personMatch[1],user.space_id);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
  return json(res,200,{id:personMatch[1],name,color:b.color});
 }
 if(path==='/api/birthdays' && method==='POST')return json(res,201,{id:writeBirthday(await body(req),user)});
 const birthdayMatch=path.match(/^\/api\/birthdays\/([a-f0-9-]{36})$/);
 if(birthdayMatch && ['PUT','DELETE'].includes(method)) {
  if(!db.prepare('SELECT id FROM birthdays WHERE id=? AND space_id=?').get(birthdayMatch[1],user.space_id))throw new ApiError(404,'Geburtstag nicht gefunden.');
  if(method==='DELETE')db.prepare('DELETE FROM birthdays WHERE id=? AND space_id=?').run(birthdayMatch[1],user.space_id);
  else writeBirthday(await body(req),user,birthdayMatch[1]);
  return json(res,200,{ok:true});
 }
 if (path === '/api/events' && method === 'POST') { const b = await body(req), values = validateEvent(b,user), id = randomUUID(); db.prepare('INSERT INTO events VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,user.space_id,...values); return json(res,201,{id}); }
 const match = path.match(/^\/api\/events\/([a-f0-9-]{36})$/);
 if (match && ['PUT','DELETE'].includes(method)) {
  if (!db.prepare('SELECT id FROM events WHERE id=? AND space_id=?').get(match[1],user.space_id)) throw new ApiError(404,'Termin nicht gefunden.');
  if(method==='DELETE') db.prepare('DELETE FROM events WHERE id=? AND space_id=?').run(match[1],user.space_id);
  else { const values = validateEvent(await body(req),user); db.prepare('UPDATE events SET title=?,date=?,time=?,end_time=?,person_id=?,category=?,location=?,note=? WHERE id=? AND space_id=?').run(...values,match[1],user.space_id); }
  return json(res,200,{ok:true});
 }
 throw new ApiError(404,'Nicht gefunden.');
}
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.png':'image/png'};
const allowed = new Set(['index.html','app.js','screens.js','shell.js','calendar.js','mobile.css','people.css','viewport.css','styles.css','domain.js','manifest.webmanifest','sw.js','icon.svg','icon-192.png','icon-512.png']);
const server = http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff'); res.setHeader('Referrer-Policy','no-referrer'); res.setHeader('X-Frame-Options','DENY');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
 try {
  const url = new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/api/')) return await api(req,res,url);
  if(!['GET','HEAD'].includes(req.method)) throw new ApiError(405,'Methode nicht erlaubt.');
  const file = url.pathname==='/' ? 'index.html' : url.pathname.slice(1);
  if(!allowed.has(file)) throw new ApiError(404,'Nicht gefunden.');
  const data = await readFile(resolve(root,'public',file));
  res.writeHead(200,{'Content-Type':mime[extname(file)] || 'application/octet-stream','Cache-Control':'no-cache'}); res.end(req.method==='HEAD' ? undefined : data);
 } catch(e) { if(e.code==='ENOENT') e=new ApiError(404,'Nicht gefunden.'); if(!e.status) console.error(e); json(res,e.status || 500,{error:e.status ? e.message : 'Ein Serverfehler ist aufgetreten.'}); }
});
const housekeeping = setInterval(()=>{ db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now()); db.prepare('DELETE FROM account_tokens WHERE expires<?').run(Date.now());for(const [k,v] of rates) if(v.until<Date.now()) rates.delete(k); for(const [k,v] of cache) if(v.until<Date.now()) cache.delete(k); },60000).unref();
server.requestTimeout=20000;server.headersTimeout=15000;
server.listen(Number(process.env.PORT || 3100),process.env.HOST || '0.0.0.0',()=>console.log(`Miteinander läuft auf http://localhost:${server.address().port}`));
for(const signal of ['SIGTERM','SIGINT']) process.on(signal,()=>{clearInterval(housekeeping);server.close(()=>{db.close();process.exit(0);});});
