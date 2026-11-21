const errors=[];
const domain=process.env.APP_DOMAIN;
if(!domain || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain))errors.push('APP_DOMAIN muss eine Domain ohne Protokoll oder Pfad sein.');
if(process.env.PUBLIC_ORIGIN!==`https://${domain}`)errors.push('PUBLIC_ORIGIN muss https://APP_DOMAIN entsprechen.');
if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.ACME_EMAIL || ''))errors.push('ACME_EMAIL für HTTPS-Zertifikate fehlt.');
if(process.env.COOKIE_SECURE!=='true')errors.push('COOKIE_SECURE muss true sein.');
if(process.env.NODE_ENV!=='production')errors.push('NODE_ENV muss production sein.');
if(process.env.SEED_BRUNS!=='false' && (!process.env.SEED_PASSWORD || process.env.SEED_PASSWORD.length<12 || process.env.SEED_PASSWORD.startsWith('replace-')))errors.push('Ein eigenes SEED_PASSWORD mit mindestens 12 Zeichen fehlt.');
if(process.env.SMTP_HOST && (!process.env.MAIL_FROM || !process.env.SMTP_PORT))errors.push('Für SMTP auch MAIL_FROM und SMTP_PORT eintragen.');
if(errors.length){for(const error of errors)console.error(error);process.exitCode=1;}else{console.log('Produktivkonfiguration gültig.');if(!process.env.SMTP_HOST)console.log('E-Mail-Versand ist noch nicht konfiguriert; direkter Passwortwechsel bleibt möglich.');}
