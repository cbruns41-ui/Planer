import {writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {resolve} from 'node:path';

function option(name){const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:undefined;}
const domain=option('--domain')?.toLowerCase(),email=option('--email'),output=resolve(option('--output') || '.env.production');
if(!domain || !/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain) || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
 console.error('Aufruf: node scripts/configure-production.mjs --domain kalender.deine-domain.de --email deine@email.de');process.exit(1);
}
const password=randomBytes(24).toString('base64url');
const config=`APP_DOMAIN=${domain}\nACME_EMAIL=${email}\nPUBLIC_ORIGIN=https://${domain}\nNODE_ENV=production\nCOOKIE_SECURE=true\nTRUST_PROXY=true\nSEED_BRUNS=true\nSEED_PASSWORD=${password}\nSMTP_HOST=\nSMTP_PORT=587\nSMTP_SECURE=false\nSMTP_USER=\nSMTP_PASSWORD=\nMAIL_FROM=\nSMTP_LOCAL_RELAY=false\n`;
try{await writeFile(output,config,{flag:'wx',mode:0o600});}
catch(e){if(e.code==='EEXIST'){console.error('Die Konfiguration existiert bereits und wurde nicht verändert.');process.exit(1);}throw e;}
console.log('Produktivkonfiguration erstellt. Der Nutzername bleibt Bruns.');
console.log('Das einmalige Startpasswort steht in der geschützten Datei unter SEED_PASSWORD.');
console.log('Bestehende Konten und Passwörter werden nicht überschrieben.');
