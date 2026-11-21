import {DatabaseSync,backup} from 'node:sqlite';
import {mkdir,rename,stat,unlink} from 'node:fs/promises';
import {resolve,basename} from 'node:path';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';

export async function restoreDatabase({file,dataDir=process.env.DATA_DIR || 'data',confirmStopped=false}) {
 if(!confirmStopped)throw new Error('App und Sicherungsdienst zuerst stoppen und --confirm-stopped angeben.');
 const source=resolve(file),directory=resolve(dataDir),target=resolve(directory,'calendar.sqlite');
 if(source===target)throw new Error('Sicherung und Zieldatenbank müssen verschieden sein.');
 await mkdir(directory,{recursive:true});
 const stage=resolve(directory,`.restore-${randomUUID()}.sqlite`),db=new DatabaseSync(source,{readOnly:true});
 try {
  if(db.prepare('PRAGMA quick_check').get().quick_check!=='ok' || !db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get())throw new Error('Die Datei ist keine gültige Miteinander-Sicherung.');
  await backup(db,stage);
 }finally{db.close();}
 const archive=resolve(directory,'before-restore-'+Date.now()+'-'+randomUUID()),moved=[];
 try {
  await mkdir(archive,{recursive:false,mode:0o700});
  for(const name of ['calendar.sqlite','calendar.sqlite-wal','calendar.sqlite-shm']) {
   const old=resolve(directory,name),saved=resolve(archive,basename(name));
   try{await stat(old);}catch(e){if(e.code==='ENOENT')continue;throw e;}
   await rename(old,saved);moved.push([old,saved]);
  }
  await rename(stage,target);
 }catch(e){for(const [old,saved] of moved.reverse())await rename(saved,old);await unlink(stage).catch(()=>{});throw e;}
 return {target,archive};
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const i=process.argv.indexOf('--file');if(i<0 || !process.argv[i+1])throw new Error('Aufruf: node scripts/restore.mjs --file /app/backups/DATEI.sqlite --confirm-stopped');
 const result=await restoreDatabase({file:process.argv[i+1],confirmStopped:process.argv.includes('--confirm-stopped')});console.log('Datenbank wiederhergestellt. Vorheriger Stand bleibt erhalten: '+basename(result.archive));
}
