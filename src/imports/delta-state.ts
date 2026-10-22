import {importDigest} from '../family/team-chat/import-capture.mjs';
import {sha256} from './kit';
import {fail} from '../family/team-chat/domain';
import {importedSelect} from './projection';
import type {Context} from '../platform/storage/context';

/** A delta can reuse only the owner's currently readable, published source.
 * File bytes retain their existing private custody; this is never a Slack read. */
export async function deltaState(c:Context, input:any) {
 const {namespace,sourceIds}=input;
 if(typeof namespace!=='string'||!/^[A-Za-z0-9_.-]{1,128}$/.test(namespace)||!Array.isArray(sourceIds)||sourceIds.length>50||sourceIds.some((id:any)=>typeof id!=='string'||!/^[A-Za-z0-9_.-]{1,128}$/.test(id))||new Set(sourceIds).size!==sourceIds.length)fail(400,'Choose a source namespace and conversations');
 const channels=await c.rows(`SELECT ch.source_id,ch.conversation FROM nook_import_channels ch JOIN nook_imports j ON j.id=ch.job WHERE j.namespace=? AND j.owner=? AND substr(j.id,1,6)='slack-' AND j.state='complete' AND ch.source_id IN (SELECT value FROM json_each(?)) ORDER BY ch.source_id`,[namespace,c.uid,JSON.stringify(sourceIds)]);
 let totalBytes=0;
 const conversations=[];
 for(const channel of channels){
  await c.check(channel.conversation);
  const rows=await c.rows(`${importedSelect} WHERE r.conversation=? AND r.erased=0 ORDER BY r.key`,[channel.conversation],channel.conversation),messages=[];
  for(const row of rows){
   const files=await c.rows(`SELECT f.source_id,a.* FROM nook_import_files f JOIN nook_attachments a ON a.id=f.attachment WHERE f.message=? AND a.state='attached' ORDER BY f.position,f.source_id`,[row.id],channel.conversation),copies=[];
   for(const file of files){
    totalBytes+=file.size;if(totalBytes>16*1024*1024)fail(413,'This delta baseline exceeds 16 MiB of private files; select fewer conversations');
    const object=await c.env.FILES.get(file.object_key);if(!object)fail(409,'A retained source file is unavailable');
    const bytes=Buffer.from(await object!.arrayBuffer());if(bytes.length!==file.size||sha256(bytes)!==file.sha256)fail(409,'A retained source file changed');
    copies.push({sourceId:file.source_id,name:file.name,mime:file.mime,size:file.size,sha256:file.sha256,base64:bytes.toString('base64')});
   }
   messages.push({key:row.key,sequence:row.sequence,parent:row.parent,sourceTimestamp:row.source_timestamp,sourceActor:row.source_actor,body:row.body,sourceRecord:JSON.parse(row.source_record),files:copies});
  }
  await c.check(channel.conversation);
  const watermark=messages.map(m=>m.sourceTimestamp).sort((a,b)=>Number(a)-Number(b)).at(-1)??null;
  conversations.push({sourceId:channel.source_id,conversation:channel.conversation,maxSequence:Math.max(0,...messages.map(m=>m.sequence)),watermark,messages});
 }
 const members=[...new Set(conversations.flatMap(channel=>channel.messages.map(message=>message.sourceActor)))].sort();
 return {baseline:{namespace,conversations,members}};
}

export async function validateDeltaBaseline(c:Context,capture:any){
 if(!capture.delta)return;
 const current=await deltaState(c,{namespace:capture.namespace,sourceIds:capture.channels.map((channel:any)=>channel.sourceId)});
 if(importDigest(current.baseline)!==capture.delta.baselineDigest)fail(409,'Imported source changed since this delta preview; preview again');
}
