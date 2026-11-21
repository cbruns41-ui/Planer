// Uses the existing Git credential manager. Tokens stay in memory and are never printed.
import {spawn} from 'node:child_process';
const [command='inspect',name='miteinander-kalender']=process.argv.slice(2);
const credential=await new Promise((accept,reject)=>{
 const child=spawn('git',['credential','fill'],{env:{...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'never'},stdio:['pipe','pipe','pipe']});
 let output='';child.stdout.on('data',c=>output+=c);child.stderr.resume();child.once('error',()=>reject(new Error('Git-Anmeldeverwaltung nicht erreichbar.')));child.once('exit',code=>{if(code!==0)return reject(new Error('GitHub-Anmeldung über Git erforderlich.'));const values=Object.fromEntries(output.split(/\r?\n/).filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1)];}));if(!values.password)return reject(new Error('Kein GitHub-Zugang verfügbar.'));accept(values);});
 child.stdin.end('protocol=https\nhost=github.com\n\n');
});
async function api(path,options={}) {
 const response=await fetch('https://api.github.com'+path,{...options,headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+credential.password,'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(20000)});
 const data=await response.json();if(!response.ok)throw new Error(`GitHub ${response.status}: ${String(data.message || 'Anfrage fehlgeschlagen').slice(0,180)}`);return data;
}
const user=await api('/user');
if(command==='inspect') {
 const matches=[];for(let page=1;page<=5;page++){const repos=await api(`/user/repos?affiliation=owner&per_page=100&page=${page}`);for(const repo of repos)if(/kalender|calendar|miteinander/i.test(repo.name))matches.push({name:repo.name,url:repo.html_url,private:repo.private,size:repo.size,branch:repo.default_branch});if(repos.length<100)break;}
 console.log(JSON.stringify({login:user.login,id:user.id,name:user.name,repositories:matches}));
}else if(command==='repo') {
 if(!/^[a-zA-Z0-9_.-]{1,100}$/.test(name))throw new Error('Ungültiger Repository-Name.');
 const repo=await api(`/repos/${user.login}/${name}`);let files=[];
 if(repo.size>0){const contents=await api(`/repos/${user.login}/${name}/contents`);files=Array.isArray(contents)?contents.map(f=>({name:f.name,type:f.type})):[];}
 console.log(JSON.stringify({name:repo.name,url:repo.html_url,remote:repo.clone_url,private:repo.private,size:repo.size,branch:repo.default_branch,files,login:user.login,id:user.id}));
}else if(command==='create') {
 if(!/^[a-zA-Z0-9_.-]{1,100}$/.test(name))throw new Error('Ungültiger Repository-Name.');
 const repo=await api('/user/repos',{method:'POST',body:JSON.stringify({name,private:true,auto_init:false,description:'Gemeinsame Tablet-App: Kalender, Personen, Geburtstage, Essensplan und Einkaufsliste. Hetzner-Deployment mit Docker.'})});
 console.log(JSON.stringify({name:repo.name,url:repo.html_url,remote:repo.clone_url,private:repo.private,login:user.login,id:user.id}));
}else if(command==='status') {
 if(!/^[a-zA-Z0-9_.-]{1,100}$/.test(name))throw new Error('Ungültiger Repository-Name.');
 const runs=await api(`/repos/${user.login}/${name}/actions/runs?per_page=5`);
 console.log(JSON.stringify(runs.workflow_runs.map(r=>({name:r.name,status:r.status,conclusion:r.conclusion,url:r.html_url,sha:r.head_sha}))));
}else throw new Error('Erlaubt: inspect, repo NAME, create NAME, status NAME');
