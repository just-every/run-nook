import {enqueuePushMessage} from '../../push/queue'
import {erasedIntent} from '../../team/erasure/intent.mjs'
import {erase} from '../../team/erasure/service'
import {allowedGrant} from '../../team/access'
import {fail,text} from '../../family/team-chat/domain'
import {messageAttentionInput} from '../../family/team-chat/attention'
import {Context,indexMessage} from './context'
import {message} from './read'
import {historyPage} from './history'
import {enqueueMessage} from '../../notify/queue'
export async function send(c:Context,id:string,input:Record<string,any>){
 const body=text(input.body),intent=text(input.intent,128);if(input.parent!==undefined&&input.parent!==null&&typeof input.parent!=='string')fail(400,'Invalid parent');const parent=input.parent||null;
 const ids=input.attachments??[];if(!Array.isArray(ids)||ids.length>5||ids.some(x=>typeof x!=='string')||new Set(ids).size!==ids.length)fail(400,'Invalid attachment IDs');const attention=messageAttentionInput(input),payload=JSON.stringify({body,parent,attachments:ids,...attention});
 const digest=await erasedIntent(c.uid,intent,id)
 const [erased,old]=await Promise.all([
  c.one('SELECT 1 FROM nook_erased_messages WHERE intent_digest=?',[digest],id),
  c.one('SELECT id,payload FROM nook_messages WHERE conversation=? AND author=? AND intent=?',[id,c.uid,intent],id),
 ])
 if(erased)fail(409,'Message intent was erased')
 if(old){if(old.payload!==payload)fail(409,'Intent payload changed');return sentMessage(c,id,old.id)}

 if(parent&&!await c.one('SELECT id FROM nook_messages WHERE id=? AND conversation=? AND parent IS NULL AND deleted=0',[parent,id],id))fail(400,'Thread root unavailable');for(const uid of attention.mentions)if(!await c.one(`SELECT user FROM nook_members m WHERE conversation=? AND user=? AND ${allowedGrant('m.user','m.conversation')}`,[id,uid],id))fail(400,'Mention recipient must be a current member');for(const aid of ids)if(!await c.one("SELECT id FROM nook_attachments WHERE id=? AND author=? AND conversation=? AND state='staged' AND expires>?",[aid,c.uid,id,Date.now()],id))fail(400,'Attachment must be uploader-owned staged file in this conversation');
 const mid=crypto.randomUUID(),now=new Date().toISOString();const statements=[...c.event(id,'message',mid),c.sql('UPDATE nook_conversations SET message_count=message_count+1 WHERE id=?',id),c.sql('INSERT INTO nook_author_counts VALUES(?,?,1) ON CONFLICT(conversation,user) DO UPDATE SET total=total+1',id,c.uid),c.sql(`INSERT INTO nook_messages SELECT ?,id,?,?,?, ?,1,0,?,?,?,seq,message_count,(SELECT total FROM nook_author_counts WHERE conversation=? AND user=?) FROM nook_conversations WHERE id=?`,mid,c.uid,body,body.toLowerCase(),parent,now,intent,payload,id,c.uid,id),c.sql('INSERT INTO nook_revisions VALUES(?,1,?,?)',mid,body,now),indexMessage(c,mid,id,body),...ids.map((aid:string,i:number)=>c.sql("UPDATE nook_attachments SET state='attached',message=?,position=? WHERE id=?",mid,i,aid)),c.sql(`INSERT INTO nook_attention SELECT ?||'.'||m.user,m.user,m.conversation,v.seq,?,NULL,CASE WHEN j.value IS NOT NULL THEN CASE WHEN ? THEN 'urgent-request' ELSE 'mention' END WHEN f.message IS NOT NULL THEN 'thread-follow' ELSE 'conversation-follow' END,'open',NULL,? FROM nook_members m JOIN nook_conversations v ON v.id=m.conversation LEFT JOIN nook_preferences p ON p.user=m.user AND p.conversation=m.conversation LEFT JOIN nook_thread_follows f ON f.user=m.user AND f.message=? LEFT JOIN json_each(?) j ON j.value=m.user WHERE m.conversation=? AND m.user<>? AND ${allowedGrant('m.user','m.conversation')} AND (j.value IS NOT NULL OR (COALESCE(p.muted,0)=0 AND (f.message IS NOT NULL OR p.followed=1)))`,mid,mid,attention.urgent?1:0,now,parent,JSON.stringify(attention.mentions),id,c.uid),enqueueMessage(c,mid,Date.parse(now)),enqueuePushMessage(c,mid,Date.parse(now))];
 const condition=`NOT EXISTS(SELECT 1 FROM nook_erased_messages WHERE intent_digest=?) AND NOT EXISTS(SELECT 1 FROM nook_messages WHERE conversation=? AND author=? AND intent=?) AND (? IS NULL OR EXISTS(SELECT 1 FROM nook_messages WHERE id=? AND conversation=? AND parent IS NULL AND deleted=0)) AND NOT EXISTS(SELECT 1 FROM json_each(?) j WHERE NOT EXISTS(SELECT 1 FROM nook_members m JOIN oa_operators o ON o.id=m.user AND o.status='active' WHERE m.conversation=? AND m.user=j.value AND ${allowedGrant('m.user','m.conversation')})) AND NOT EXISTS(SELECT 1 FROM json_each(?) j WHERE NOT EXISTS(SELECT 1 FROM nook_attachments a WHERE a.id=j.value AND a.conversation=? AND a.author=? AND a.state='staged' AND a.expires>CAST(unixepoch('subsec')*1000 AS INTEGER)))`;
 try{await c.batch(statements,id,condition,[digest,id,c.uid,intent,parent,parent,id,JSON.stringify(attention.mentions),id,JSON.stringify(ids),id,c.uid])}catch(error){const committed=await c.one('SELECT id,payload FROM nook_messages WHERE conversation=? AND author=? AND intent=?',[id,c.uid,intent],id);if(committed){if(committed.payload!==payload)fail(409,'Intent payload changed');return sentMessage(c,id,committed.id)}throw error}
 await c.hint();return sentMessage(c,id,mid)
}
// The send already knows its conversation. Read its committed row and ordered
// attachments together under that current membership, including retry replies.
async function sentMessage(c:Context,conversation:string,id:string){
 return (await historyPage(c,conversation,'m.id=?',[id],1))[0]??fail(404,'Message unavailable')
}
export async function edit(c:Context,id:string,input:Record<string,any>){
 if(input.delete!==undefined&&typeof input.delete!=='boolean')fail(400,'delete must be boolean');if(!Number.isSafeInteger(input.version))fail(400,'Version required');const old=await message(c,id);if(old.author!==c.uid)fail(403,'Only author may edit');if(old.deleted||old.version!==input.version)fail(409,'Message changed; reload');const body=input.delete?'':text(input.body),now=new Date().toISOString();
 if(input.delete){const receipt=await erase(c,'message',id,{confirmation:'ERASE',version:input.version},true);return {...await message(c,id),receipt}}
 const statements=[...c.event(old.conversation,'edit',id),c.sql('UPDATE nook_messages SET body=?,body_lower=?,version=version+1 WHERE id=?',body,body.toLowerCase(),id),c.sql('DELETE FROM nook_search WHERE message=?',id),indexMessage(c,id,old.conversation,body),c.sql('INSERT INTO nook_revisions VALUES(?,?,?,?)',id,input.version+1,body,now)];
 await c.batch(statements,old.conversation,'EXISTS(SELECT 1 FROM nook_messages WHERE id=? AND author=? AND version=? AND deleted=0)',[id,c.uid,input.version]);await c.hint();return message(c,id)
}
