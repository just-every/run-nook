// A test-only network-edge failure. The actual emitted app, D1, R2 and DO run
// unchanged; post-commit namespace fetches fail only at this test binding edge.
import {readFile,writeFile,unlink} from 'node:fs/promises';
import {relative,resolve} from 'node:path';
export async function hintLossConfig(root,transferFaults=null){
 const directory=resolve(root,'dist/server'),original=JSON.parse(await readFile(resolve(directory,'wrangler.json'),'utf8'));
 // Wrangler's no-bundle modules are named relative to this module directory.
 const entry=resolve(directory,'storage-hint-loss-worker.mjs'),config=resolve(directory,'storage-hint-loss-wrangler.json'),main='./'+relative(directory,resolve(directory,original.main)).split('\\').join('/');
 await writeFile(entry,`import app from ${JSON.stringify(main)};
export {ChatHub} from ${JSON.stringify(main)};
export default {
 fetch(request,env,ctx){
  const real=env.CHAT_HUB;
  const edge={idFromName:name=>real.idFromName(name),get:id=>{
   const stub=real.get(id);
   return {fetch:(input,options)=>{
    if(new URL(typeof input==='string'?input:input.url).pathname==='/hint')return Promise.reject(Error('test-only dropped postcommit network hint'));
    return stub.fetch(input,options);
   }};
  }};
  const mode=${JSON.stringify(transferFaults)},prepared=new WeakMap();
  const wrap=(statement,sql)=>{const proxy=new Proxy(statement,{get(target,key){if(key==='bind')return (...args)=>wrap(target.bind(...args),sql);const value=target[key];return typeof value==='function'?value.bind(target):value}});prepared.set(proxy,{statement,sql});return proxy};
  const DB=mode==='finalize'?new Proxy(env.DB,{get(target,key){if(key==='prepare')return sql=>wrap(target.prepare(sql),sql);if(key==='batch')return async statements=>{const records=statements.map(s=>prepared.get(s)??{statement:s,sql:''}),result=await target.batch(records.map(r=>r.statement));if(records.some(r=>r.sql.startsWith('UPDATE nook_attachments SET state=?'))&&records.some(r=>r.sql.startsWith('DELETE FROM nook_upload_attempts WHERE id=')))throw Error('test-only lost D1 finalize acknowledgement');return result};const value=target[key];return typeof value==='function'?value.bind(target):value}}):env.DB;
  const FILES=mode==='put'?new Proxy(env.FILES,{get(target,key){if(key==='put')return async(...args)=>{await target.put(...args);throw Error('test-only lost R2 put acknowledgement')};const value=target[key];return typeof value==='function'?value.bind(target):value}}):env.FILES;
  return app.fetch(request,{...env,CHAT_HUB:edge,DB,FILES},ctx);
 }
};
`);
 await writeFile(config,JSON.stringify({...original,main:entry}));
 return {path:config,close:async()=>{await unlink(entry);await unlink(config)}};
}
