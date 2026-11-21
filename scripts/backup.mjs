import {DatabaseSync,backup} from 'node:sqlite';
import {mkdir,readdir,rename,unlink} from 'node:fs/promises';
import {resolve,basename} from 'node:path';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';

export async function backupDatabase({dataDir=process.env.DATA_DIR || 'data',outputDir=process.env.BACKUP_DIR || 'backups',keep=Number(process.env.BACKUP_KEEP || 14)}={}) {
 if(!Number.isInteger(keep) || keep<1 || keep>365)throw new Error('BACKUP_KEEP muss zwischen 1 und 365 liegen.');
 const source=resolve(dataDir,'calendar.sqlite'),destination=resolve(outputDir);
 await mkdir(destination,{recursive:true,mode:0o700});
 const name=`miteinander-${new Date().toISOString().replaceAll(':','-')}-${randomUUID()}.sqlite`,file=resolve(destination,name),partial=file+'.partial';
 const db=new DatabaseSync(source,{readOnly:true});db.exec('PRAGMA busy_timeout=5000');
 try{await backup(db,partial);}catch(e){await unlink(partial).catch(()=>{});throw e;}finally{db.close();}
 const verified=new DatabaseSync(partial,{readOnly:true});let valid;
 try{valid=verified.prepare('PRAGMA quick_check').get().quick_check==='ok';}finally{verified.close();}
 if(!valid){await unlink(partial);throw new Error('Die Sicherung hat die Integritätsprüfung nicht bestanden.');}
 await rename(partial,file);
 const files=(await readdir(destination,{withFileTypes:true})).filter(f=>f.isFile() && /^miteinander-\d{4}-\d{2}-\d{2}T[\d.Z-]+-[a-f0-9-]{36}\.sqlite$/.test(f.name)).map(f=>f.name).sort().reverse();
 for(const old of files.filter(f=>f!==name).slice(keep-1)){const target=resolve(destination,old);if(resolve(target)!==resolve(destination,basename(target)))throw new Error('Ungültiger Sicherungspfad.');await unlink(target);}
 return file;
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
 const run=async()=>{const file=await backupDatabase();console.log('Sicherung erstellt: '+basename(file));};
 if(process.argv.includes('--watch')) {
  const hours=Number(process.env.BACKUP_INTERVAL_HOURS || 24);if(!Number.isFinite(hours) || hours<1 || hours>168)throw new Error('BACKUP_INTERVAL_HOURS muss zwischen 1 und 168 liegen.');
  await run();let running=false;
  setInterval(async()=>{if(running)return;running=true;try{await run();}catch{console.error('Die planmäßige Datenbanksicherung ist fehlgeschlagen.');}finally{running=false;}},hours*3600000);
 }else await run();
}
