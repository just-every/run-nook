import type {Context} from '../platform/storage/context'
import {memberFence} from '../platform/storage/context'
import {message} from '../platform/storage/read'
import {messageStatements} from '../platform/storage/message-statements'
import {erasedIntent} from '../team/erasure/intent.mjs'
import {canPost} from '../team/posting-policy'
import {channelWritable} from '../team/channel-policy'
import {fullMember,allowedGrant} from '../team/access'
import {fail,text} from '../family/team-chat/domain'
import {copyFiles} from './files'
import {forwardProjection,effectiveBody} from './projection'
import {policy,digest,previewForward} from './plan'
export async function forwardingRoute(c:Context,method:string,p:string[],input:Record<string,unknown>){
 if(p[1]!=='forwards')return null
 if(!await c.one(`SELECT 1 WHERE ${fullMember('?')}`,[c.uid]))fail(403,'Forwarding is for signed-in members')
 if(p.length===2&&method==='GET')return policy(c)
 if(p.length===4&&p[3]==='source'&&method==='GET'){const copy=await message(c,p[2]),forward=await c.one('SELECT source FROM nook_forwards WHERE message=?',[copy.id],copy.conversation);if(!forward)fail(404,'Message unavailable');try{return await message(c,forward.source)}catch{fail(404,'Message unavailable')}}
 if(p[2]==='policy'&&p.length===3){
  if(!await c.one("SELECT 1 FROM oa_operators WHERE id=? AND role='owner' AND status='active'",[c.uid]))fail(403,'Only owners manage forwarding')
  if(method==='GET')return policy(c)
  if(method!=='POST'||!['allow','link-only','blocked'].includes(String(input.mode)))fail(400,'Choose a forwarding policy')
  const old=await policy(c);if(input.version!==old.version)fail(409,'Policy changed; reload')
  await c.batch([c.sql('INSERT INTO nook_forward_policy VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET mode=excluded.mode,version=excluded.version',input.mode,old.version+1),c.sql('INSERT INTO nook_audit VALUES(?,?,?,?,?,?,?,?,?,?)',crypto.randomUUID(),c.uid,'forwarding',Date.now(),'forward.policy','workspace',old.version+1,'Owner changed forwarding policy','confirmed',1)],undefined,'COALESCE((SELECT version FROM nook_forward_policy WHERE id=1),0)=?',[old.version]);return policy(c)
 }
 if(method!=='POST'||p.length>3||p.length===3&&p[2]!=='preview')fail(404,'Not found')
 if(Object.keys(input).some(k=>!['source','mode','note','destinations','confirmation','intent','schedule'].includes(k)))fail(400,'Unsupported forward field')
 const v=await previewForward(c,input)
 if(p[2]==='preview')return {mode:v.mode,note:v.note,author:v.original.authorName,time:v.original.created,source:v.original.id,sourceName:(await c.one('SELECT name FROM nook_conversations WHERE id=?',[v.original.conversation],v.original.conversation)).name,body:v.mode==='show'?await effectiveBody(c,v.original.id):null,files:v.mode==='show'?v.files:[],audiences:v.audiences.map(({members,...a})=>({...a,readers:members.length})),confirmation:v.confirmation}
 if(v.mode==='show'&&input.confirmation!==v.confirmation)fail(409,'Review the current disclosure preview before sending')
 if(input.schedule){const {createSchedule}=await import('../scheduled/service');return createSchedule(c,v.destinations[0].conversation,{...(input.schedule as object),body:v.note||'Forwarded message',parent:v.destinations[0].thread,forward:input,intent:input.intent})}
 return sendForward(c,input)
}

export async function sendForward(c:Context,input:Record<string,unknown>,completion?:{condition:string;values:any[];statements:(ids:string[])=>D1PreparedStatement[]}){
 const v=await previewForward(c,input)
 if(v.mode==='show'&&input.confirmation!==v.confirmation)fail(409,'Review the current disclosure preview before sending')
 const intent=text(input.intent,128),requestHash=await digest({source:input.source,mode:v.mode,note:v.note,destinations:v.destinations}),prior=await c.rows('SELECT f.message,f.request_hash FROM nook_forwards f JOIN nook_messages m ON m.id=f.message WHERE m.author=? AND f.intent=?',[c.uid,intent])
 if(prior.length){if(prior.some(p=>p.request_hash!==requestHash)||prior.length!==v.destinations.length)fail(409,'Forward intent changed');return {messages:await Promise.all(prior.map(async p=>(await forwardProjection(c,[await message(c,p.message)]))[0]))}}
 const statements=[],conditions=[`${fullMember('?')} AND COALESCE((SELECT version FROM nook_forward_policy WHERE id=1),0)=?`,`(SELECT json_group_array(user) FROM (SELECT user FROM nook_members m WHERE conversation=? AND ${allowedGrant('m.user','m.conversation')} ORDER BY user))=?`],values:any[]=[c.uid,v.rules.version,v.original.conversation,JSON.stringify(v.binding.sourceAudience)],ids=[]
 const sourceNative=await c.one('SELECT version FROM nook_messages WHERE id=?',[v.original.id]),sourceImport=await c.one('SELECT source_record FROM nook_import_records WHERE id=?',[v.original.id]);conditions.push(sourceNative?'EXISTS(SELECT 1 FROM nook_messages WHERE id=? AND version=? AND deleted=0)':'EXISTS(SELECT 1 FROM nook_import_records WHERE id=? AND source_record=?)');values.push(v.original.id,sourceNative?v.original.version:sourceImport?.source_record)
 for(const destination of v.destinations){
  const mid=crypto.randomUUID(),nativeIntent='forward:'+intent+':'+destination.conversation+':'+(destination.thread??''),erased=await erasedIntent(c.uid,nativeIntent,destination.conversation);if(await c.one('SELECT 1 FROM nook_erased_messages WHERE intent_digest=?',[erased]))fail(409,'Forward intent was erased')
  const copies=v.mode==='show'?await copyFiles(c,destination.conversation,v.original.attachments,intent+':'+(destination.thread??'')):[],body=v.note||'Forwarded message',attention={mentions:[],urgent:false,urgentReason:null},payload=JSON.stringify({body,parent:destination.thread,attachments:copies.map(f=>f.id),...attention}),now=new Date().toISOString()
  statements.push(...messageStatements(c,{id:destination.conversation,mid,body,parent:destination.thread,ids:copies.map(f=>f.id),attention,intent:nativeIntent,payload,now,resolveBroadcasts:false}),c.sql('INSERT INTO nook_forwards VALUES(?,?,?,?,?,?,?,?,?)',mid,destination.conversation,v.original.id,v.original.conversation,v.mode,v.note,intent,requestHash,Date.now()),...copies.map(f=>c.sql('INSERT INTO nook_forward_files VALUES(?,?,?,?)',f.id,f.source,mid,destination.conversation)))
  if(v.mode==='show')statements.push(c.sql('INSERT INTO nook_audit VALUES(?,?,?,?,?,?,?,?,?,?)',crypto.randomUUID(),c.uid,'forwarding',Date.now(),'forward.show',destination.conversation,v.original.version,'Explicit disclosure confirmed; '+v.audiences.find(a=>a.conversation===destination.conversation&&a.thread===destination.thread)!.newReaders.length+' additional readers','confirmed',1))
  conditions.push(`(${memberFence}) AND ${channelWritable('?')} AND ${canPost('?','?','?')} AND NOT EXISTS(SELECT 1 FROM nook_notification_sharing WHERE conversation=? AND state<>'local') AND NOT EXISTS(SELECT 1 FROM nook_erased_messages WHERE intent_digest=?) AND (? IS NULL OR EXISTS(SELECT 1 FROM nook_message_history WHERE id=? AND conversation=? AND parent IS NULL AND deleted=0))`);values.push(destination.conversation,c.uid,destination.conversation,destination.conversation,destination.thread,c.uid,destination.conversation,erased,destination.thread,destination.thread,destination.conversation)
  for(const file of copies){conditions.push("EXISTS(SELECT 1 FROM nook_attachments WHERE id=? AND conversation=? AND author=? AND state='staged' AND expires>CAST(unixepoch('subsec')*1000 AS INTEGER))");values.push(file.id,destination.conversation,c.uid)}
  const audience=v.audiences.find(a=>a.conversation===destination.conversation&&a.thread===destination.thread)!;conditions.push(`(SELECT json_group_array(user) FROM (SELECT user FROM nook_members m WHERE conversation=? AND ${allowedGrant('m.user','m.conversation')} ORDER BY user))=?`);values.push(destination.conversation,JSON.stringify(audience.members))
  ids.push(mid)
 }
 for(const file of v.files){conditions.push("EXISTS(SELECT 1 FROM nook_attachments WHERE id=? AND sha256=? AND state='attached')");values.push(file.id,file.sha256)}
 if(completion){statements.push(...completion.statements(ids));conditions.push(completion.condition);values.push(...completion.values)}
 await c.batch(statements,v.original.conversation,conditions.join(' AND '),values);await c.hint()
 return {messages:await Promise.all(ids.map(async id=>(await forwardProjection(c,[await message(c,id)]))[0]))}
}
