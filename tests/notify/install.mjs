import {mkdtemp,readdir,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {mailRuntime} from '../mail-runtime.mjs';
import {mailEdge} from '../mail-edge.mjs';
import {freePort} from '../worker-ports.mjs';
import {devKey} from '../dev-key.mjs';
const require=createRequire(import.meta.url);
// Real emitted app, migrations, R2 and ChatHub alarms; fake only the provider.
export async function notifyInstallation(root){
 const directory=await mkdtemp(join(tmpdir(),'nook-notify-'));
 const origin='http://127.0.0.1:'+await freePort(),edge=mailEdge();
 const bindings={OWNER_EMAIL:'sam@example.test',SESSION_SECRET:crypto.randomUUID()+crypto.randomUUID(),SETUP_TOKEN:crypto.randomUUID()+crypto.randomUUID(),RER_DEV_KEY:devKey};
 let runtime;
 const start=async()=>{runtime=await mailRuntime({root,state:directory,origin,bindings,edge})};
 const stop=async()=>{if(runtime){const current=runtime;runtime=undefined;await current.close()}};
 try{
  await start();const {unstable_splitSqlQuery}=require('wrangler');
  for(const name of (await readdir(join(root,'migrations'))).filter(name=>name.endsWith('.sql')).sort()){
   await runtime.db.batch(unstable_splitSqlQuery(await readFile(join(root,'migrations',name),'utf8')).map(query=>runtime.db.prepare(query)));
  }
  const boot=await fetch(origin+'/auth/bootstrap',{method:'POST',redirect:'manual',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({token:bindings.SETUP_TOKEN,displayName:'Sam'})});
  if(boot.status!==303)throw Error('Notification fixture owner bootstrap failed');
  return {origin,directory,start,stop,messages:()=>edge.messages,setMailStatus:value=>edge.setStatus(value),
   async read(statement,...values){return (await runtime.db.prepare(statement).bind(...values).all()).results},
   close:async()=>{await stop();await rm(directory,{recursive:true,force:true})}};
 }catch(error){await stop();await rm(directory,{recursive:true,force:true});throw error}
}
