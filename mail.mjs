// SMTP credentials stay on the server. No messages or reset links are logged.
export function mailConfigured() {
 return Boolean(process.env.SMTP_HOST && process.env.MAIL_FROM && process.env.PUBLIC_ORIGIN);
}
let transport;
export async function sendAccountMail(to, purpose, secret) {
 if (!mailConfigured()) throw new Error('MAIL_NOT_CONFIGURED');
 const origin = new URL(process.env.PUBLIC_ORIGIN);
 const local = ['localhost','127.0.0.1','[::1]'].includes(origin.hostname);
 if (origin.protocol !== 'https:' && !local) throw new Error('HTTPS_REQUIRED');
 if (!transport) {
  const { default:nodemailer } = await import('nodemailer');
  const secure = process.env.SMTP_SECURE === 'true' || Number(process.env.SMTP_PORT) === 465;
  const localRelay = ['localhost','127.0.0.1','::1'].includes(process.env.SMTP_HOST);
  transport = nodemailer.createTransport({
   host:process.env.SMTP_HOST, port:Number(process.env.SMTP_PORT || 587), secure,
   requireTLS: !secure && !(localRelay && process.env.SMTP_LOCAL_RELAY === 'true'),
   ...(process.env.SMTP_USER ? {auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD}} : {}),
   connectionTimeout:8000, greetingTimeout:8000, socketTimeout:10000,
   disableFileAccess:true, disableUrlAccess:true
  });
 }
 const verify = purpose === 'verify';
 const url = new URL('/', origin); url.hash = `${verify?'verify-email':'reset-password'}?token=${secret}`;
 await transport.sendMail({
  from:process.env.MAIL_FROM,to,
  subject:verify?'Miteinander: E-Mail-Adresse bestätigen':'Miteinander: Passwort ändern',
  text:`${verify?'Bitte bestätige deine E-Mail-Adresse für Miteinander.':'Du hast einen Link zum Ändern deines Passworts angefordert.'}\n\n${url.href}\n\nDieser Link ist ${verify?'24 Stunden':'30 Minuten'} gültig und kann nur einmal verwendet werden.\n\nFalls du diese Anfrage nicht gestellt hast, ignoriere diese Nachricht. Dein Passwort bleibt unverändert.`
 });
}
