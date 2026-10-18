import {broadcastKind,broadcastFence,previewBroadcast,BroadcastConfirmation} from '../../broadcast/audience'
import {literal} from '../../broadcast/policy'
import {messageStatements} from './message-statements'
import {canPost,adminPoster} from '../../team/posting-policy'
import {erasedIntent} from '../../team/erasure/intent.mjs'
import {erase} from '../../team/erasure/service'
import {allowedGrant} from '../../team/access'
import {fail,text,messageBody} from '../../family/team-chat/domain'
import {messageAttentionInput} from '../../family/team-chat/attention'
import {Context,indexMessage} from './context'
import {message} from './read'
import {historyPage} from './history'
import {liveThreadRoots} from './threads'
export async function send(c:Context,id:string,input:Record<string,any>){
 if(input.confirmBroadcast!==undefined&&typeof input.confirmBroadcast!=='boolean')fail(400,'confirmBroadcast must be boolean')
 if(input.adminOverride!==undefined&&typeof input.adminOverride!=='boolean')fail(400,'adminOverride must be boolean')
 const body=messageBody(input.body),intent=text(input.intent,128);if(input.parent!==undefined&&input.parent!==null&&typeof input.parent!=='string')fail(400,'Invalid parent');const parent=input.parent||null;
 const ids=input.attachments??[];if(!Array.isArray(ids)||ids.length>5||ids.some(x=>typeof x!=='string')||new Set(ids).size!==ids.length)fail(400,'Invalid attachment IDs');const attention=messageAttentionInput(input),payload=JSON.stringify({body,parent,attachments:ids,...attention,...(input.adminOverride?{adminOverride:true}:{})});
 const digest=await erasedIntent(c.uid,intent,id)
 const [erased,old]=await Promise.all([
  c.one('SELECT 1 FROM nook_erased_messages WHERE intent_digest=?',[digest],id),
  c.one('SELECT id,payload FROM nook_messages WHERE conversation=? AND author=? AND intent=?',[id,c.uid,intent],id),
 ])
 if(erased)fail(409,'Message intent was erased')
 if(old){if(old.payload!==payload)fail(409,'Intent payload changed');return sentMessage(c,id,old.id)}

 const broadcast=await previewBroadcast(c,id,body)
 if(broadcast&&broadcast.recipients>=6&&input.confirmBroadcast!==true)throw new BroadcastConfirmation(broadcast)
 const broadcastCondition=broadcast?broadcastFence(literal(id),literal(c.uid),broadcast.kind,input.confirmBroadcast===true):'1'
 const permission=`(${canPost('?','?','?')} OR (?=1 AND ${adminPoster('?')}))`,permissionValues=[id,parent,c.uid,input.adminOverride?1:0,c.uid]
 if(!await c.one(`SELECT 1 WHERE ${permission}`,permissionValues,id))fail(403,'Posting is restricted in this channel; ask a channel manager')
 if(input.adminOverride&&!await c.one(`SELECT 1 WHERE ${adminPoster('?')}`,[c.uid],id))fail(403,'Only owners and admins may use a labelled override')
 if(parent&&!await c.one(`SELECT id FROM (${liveThreadRoots}) WHERE id=? AND conversation=?`,[parent,id],id))fail(400,'Thread root unavailable');for(const uid of attention.mentions)if(!await c.one(`SELECT user FROM nook_members m WHERE conversation=? AND user=? AND ${allowedGrant('m.user','m.conversation')}`,[id,uid],id))fail(400,'Mention recipient must be a current member');for(const aid of ids)if(!await c.one("SELECT id FROM nook_attachments WHERE id=? AND author=? AND conversation=? AND state='staged' AND expires>?",[aid,c.uid,id,Date.now()],id))fail(400,'Attachment must be uploader-owned staged file in this conversation');
 const mid=crypto.randomUUID(),now=new Date().toISOString();const statements=messageStatements(c,{id,mid,body,parent,ids,attention,intent,payload,now,confirmBroadcast:input.confirmBroadcast===true});
 const condition=`NOT EXISTS(SELECT 1 FROM nook_erased_messages WHERE intent_digest=?) AND NOT EXISTS(SELECT 1 FROM nook_messages WHERE conversation=? AND author=? AND intent=?) AND (? IS NULL OR EXISTS(SELECT 1 FROM (${liveThreadRoots}) WHERE id=? AND conversation=?)) AND NOT EXISTS(SELECT 1 FROM json_each(?) j WHERE NOT EXISTS(SELECT 1 FROM nook_members m JOIN oa_operators o ON o.id=m.user AND o.status='active' WHERE m.conversation=? AND m.user=j.value AND ${allowedGrant('m.user','m.conversation')})) AND NOT EXISTS(SELECT 1 FROM json_each(?) j WHERE NOT EXISTS(SELECT 1 FROM nook_attachments a WHERE a.id=j.value AND a.conversation=? AND a.author=? AND a.state='staged' AND a.expires>CAST(unixepoch('subsec')*1000 AS INTEGER)))`;
 try{await c.writeBatch(statements,id,`${broadcastCondition} AND ${permission} AND (?=0 OR ${adminPoster('?')}) AND (${condition})`,[...permissionValues,input.adminOverride?1:0,c.uid,digest,id,c.uid,intent,parent,parent,id,JSON.stringify(attention.mentions),id,JSON.stringify(ids),id,c.uid])}catch(error){const committed=await c.one('SELECT id,payload FROM nook_messages WHERE conversation=? AND author=? AND intent=?',[id,c.uid,intent],id);if(committed){if(committed.payload!==payload)fail(409,'Intent payload changed');return sentMessage(c,id,committed.id)}const refreshed=await previewBroadcast(c,id,body);if(refreshed&&refreshed.recipients>=6&&input.confirmBroadcast!==true)throw new BroadcastConfirmation(refreshed);throw error}
 await c.hint();return sentMessage(c,id,mid)
}
// The send already knows its conversation. Read its committed row and ordered
// attachments together under that current membership, including retry replies.
async function sentMessage(c:Context,conversation:string,id:string){
 return (await historyPage(c,conversation,'m.id=?',[id],1))[0]??fail(404,'Message unavailable')
}
export async function edit(c:Context,id:string,input:Record<string,any>){
 if(input.delete!==undefined&&typeof input.delete!=='boolean')fail(400,'delete must be boolean');if(!Number.isSafeInteger(input.version))fail(400,'Version required');const old=await message(c,id);if(old.author!==c.uid)fail(403,'Only author may edit');if(old.deleted||old.version!==input.version)fail(409,'Message changed; reload');const body=input.delete?'':messageBody(input.body),now=new Date().toISOString();
 if(input.delete){const receipt=await erase(c,'message',id,{confirmation:'ERASE',version:input.version},true);return {...await message(c,id),receipt}}
 const editedBroadcast=broadcastKind(body)
 if(editedBroadcast&&editedBroadcast!==broadcastKind(old.body))fail(400,'Send a new message to add or change a channel-wide mention; edits never notify a new audience')
 const posting=canPost('?','?','?'),postingValues=[old.conversation,old.parent,c.uid]
 if(!await c.one(`SELECT 1 WHERE ${posting}`,postingValues,old.conversation))fail(403,'Posting is restricted in this channel; ask a channel manager')
 const statements=[...c.event(old.conversation,'edit',id),c.sql('UPDATE nook_messages SET body=?,body_lower=?,version=version+1 WHERE id=?',body,body.toLowerCase(),id),c.sql('DELETE FROM nook_search WHERE message=?',id),indexMessage(c,id,old.conversation,body),c.sql('INSERT INTO nook_revisions VALUES(?,?,?,?)',id,input.version+1,body,now)];
 await c.writeBatch(statements,old.conversation,`${posting} AND EXISTS(SELECT 1 FROM nook_messages WHERE id=? AND author=? AND version=? AND deleted=0)`,[...postingValues,id,c.uid,input.version]);await c.hint();return message(c,id)
}
