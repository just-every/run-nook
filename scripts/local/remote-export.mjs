import {open,unlink} from 'node:fs/promises';
import {constants} from 'node:fs';
import {relative} from 'node:path';
import {Readable} from 'node:stream';
import {readArchive} from '@runeditrun/rer/modules/portability';
import {cookieFile,absent,privateFile,promote} from '@runeditrun/rer/modules/portability/cli-options';
import {RerError,refuse} from '@runeditrun/rer/errors';
import {journalEnvelope} from './erasure-journal.mjs';
const loopback=['localhost','127.0.0.1','[::1]'];
async function* records(path){const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);try{yield* readArchive(Readable.toWeb(file.createReadStream({autoClose:false})))}finally{await file.close()}}
/** rer export --target remote: drive Base's reviewed portability door on a hosted
 * Nook with an owner's session cookie. Writes the same verified archive and
 * erasure journal as a local export, then removes the hosted export job. */
export async function remoteExport({root,path,origin,sessionFile,store}){
 if(!origin||!sessionFile)throw refuse('Hosted export needs --origin https://YOUR-NOOK and --session-file FILE holding an owner session cookie (mode 0600). See docs/backups.md.');
 const base=new URL(origin);
 if(base.protocol!=='https:'&&!loopback.includes(base.hostname))throw refuse('Hosted export needs an https origin.');
 await absent(path);await absent(path+'.journal.rer');
 const cookie=await cookieFile(sessionFile),endpoint=base.origin+'/api/portability/exports';
 async function call(suffix,method='GET',body){
  let response;
  try{response=await fetch(endpoint+suffix,{method,redirect:'error',headers:{Cookie:cookie,Origin:base.origin,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)})}
  catch{throw new RerError('transfer_failed',`Could not reach ${base.origin}.`,1)}
  if(response.ok)return response;
  const reason=(await response.json().catch(()=>null))?.error??'HTTP '+response.status;
  throw new RerError('transfer_refused',`Hosted export refused (${reason}).${response.status===401?' Sign in as an owner and save a fresh session cookie.':''}`,4);
 }
 const {id}=await (await call('','POST',{})).json(),temporary=path+'.partial',journalTemporary=path+'.journal.rer.partial';
 let created=false,journalCreated=false,complete=false;
 try{
  let status=await (await call('/'+id)).json();
  while(status.phase==='building')status=await (await call('/'+id+'/advance','POST',{expectedPart:status.completed,maxParts:16})).json();
  if(status.phase!=='complete')throw new RerError('transfer_failed','The hosted export did not complete.',1);
  const file=await privateFile(temporary,false);created=true;
  try{const reader=(await call('/'+id+'/download')).body.getReader();try{for(;;){const {done,value}=await reader.read();if(done)break;await file.writeFile(value)}}finally{reader.releaseLock()}await file.sync()}finally{await file.close()}
  // Verify every line before promoting, exactly as a local export does.
  let manifest,closing;for await(const record of records(temporary)){if(record.kind==='manifest')manifest=record;if(record.kind==='closing')closing=record}
  const journal=await privateFile(journalTemporary,false);journalCreated=true;try{await journal.writeFile(JSON.stringify(journalEnvelope(manifest))+'\n');await journal.sync()}finally{await journal.close()}
  await promote(journalTemporary,path+'.journal.rer');await promote(temporary,path);complete=true;
  return {target:'remote',origin:base.origin,output:relative(root,path),contentHash:closing.contentHash,tables:manifest.tables.map(({name,count})=>({name,count})),requiredConfiguration:manifest.requiredConfiguration,journal:relative(root,path+'.journal.rer')};
 }finally{
  try{await call('/'+id+'/abort','POST',{})}catch(error){store.report(`The hosted export job ${id} could not be removed (${error.message}).`)}
  for(const [made,file] of [[created&&!complete,temporary],[journalCreated&&!complete,journalTemporary]])if(made)await unlink(file).catch(error=>{if(error.code!=='ENOENT')throw error});
 }
}
