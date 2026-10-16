import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtemp,readdir,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {createHash,randomUUID} from 'node:crypto';
import {mailRuntime} from '../mail-runtime.mjs';
import {mailEdge,mailBindings} from '../mail-edge.mjs';
import {devKey} from '../dev-key.mjs';

export async function run(root,args) {
 return new Promise((ok,bad)=>{
  const child=spawn(process.execPath,args,{cwd:root,env:{...process.env,WRANGLER_SEND_METRICS:'false',CI:'true'},stdio:['ignore','pipe','pipe']});
  let output='';child.stdout.on('data',bytes=>output+=bytes);child.stderr.on('data',bytes=>output+=bytes);
  child.once('error',bad);child.once('exit',code=>code===0?ok(output):bad(Error(`Local command failed (${code}); diagnostics retained in memory to avoid credential output.`)));
 });
}
export async function availablePort() {
 const server=createServer();await new Promise((ok,bad)=>{server.once('error',bad);server.listen(0,'127.0.0.1',ok)});
 const port=server.address().port;await new Promise(ok=>server.close(ok));return port;
}
export async function nativeRuntime(root,settings={}) {
 const state=await mkdtemp(resolve(tmpdir(),'nook-part6-state-'));
 const port=await availablePort(),origin=`http://127.0.0.1:${port}`;
 const secret=randomUUID()+randomUUID(),setupToken=randomUUID()+randomUUID();
 const vars={AUTH_ORIGIN:origin,RER_DEV_ORIGIN:origin,AUTH_LOCAL:'true',OWNER_EMAIL:'nativeowner@example.test',SESSION_SECRET:secret,SETUP_TOKEN:setupToken,...mailBindings,RER_DEV_KEY:devKey,...settings};
 if(vars.RER_OWNER_CLAIM_APP_ORIGIN==='native')vars.RER_OWNER_CLAIM_APP_ORIGIN=origin;
 const args=['node_modules/wrangler/bin/wrangler.js'],edge=mailEdge(request=>fetch(request));let worker,db;
 async function stop(){if(worker){const current=worker;worker=undefined;await current.close()}}
 async function start(){worker=await mailRuntime({root,state,origin,bindings:vars,edge})}
 const close=async()=>{await stop();db?.close();await rm(state,{recursive:true,force:true})};
 try {
  await run(root,[...args,'d1','migrations','apply','DB','--local','--config','dist/server/wrangler.json','--persist-to',state]);
  const names=await readdir(state,{recursive:true});const name=names.find(name=>name.endsWith('.sqlite')&&!name.endsWith('.sqlite-shm'));
  if(!name)throw Error('Native D1 file missing');db=new DatabaseSync(resolve(state,name));
  await start();
  return {origin,vars,setupToken,db,stop,start,close,
   snapshot(){const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND substr(name,1,4)<>'_cf_' ORDER BY name").all();return createHash('sha256').update(JSON.stringify(tables.map(({name})=>[name,db.prepare(`SELECT * FROM "${name}"`).all().map(row=>JSON.stringify(row)).sort()]))).digest('hex')},
   async request(path,{method='GET',body,cookie='',headers={}}={}){return fetch(origin+path,{method,redirect:'manual',headers:{Origin:origin,...(cookie?{Cookie:cookie}:{}),...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},body:body===undefined?undefined:JSON.stringify(body)})},
  };
 }catch(error){await close();throw error}
}
