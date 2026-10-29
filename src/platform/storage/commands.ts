import {creationAllowed} from '../../team/workspace-policy.server'
import {actOnSavedReminder} from '../../team/saved-reminders.server'
import {changeChannelMember} from '../../team/channel-membership.server'
import {fullMember} from '../../team/access'
import {fail,text} from '../../family/team-chat/domain'
import {Context} from './context'
import {read} from './read'
import {send,edit} from './messages'
import {createOutcome,reviseOutcome} from './outcomes'
import {followThread,readThread} from './threads'
import {muteConversationNotify,updateConversationNotify} from '../../team/conversation-notify.server'
import {PUSH_GATHER_MS} from '../../push/queue'
const future=(value:any)=>Number.isSafeInteger(value)&&value>Date.now()&&value<=Date.now()+7*86400000?value:fail(400,'Choose a future time within seven days')
export async function write(c:Context,action:string,id:string,input:Record<string,any>):Promise<any>{
 if(action==='messages')return send(c,id,input);if(action==='edit')return edit(c,id,input);if(action==='outcomes')return createOutcome(c,id,input);if(action==='reviseOutcome')return reviseOutcome(c,id,input)
 if(action==='conversations'){if(!await c.one(`SELECT 1 WHERE ${fullMember('?')}`,[c.uid]))fail(403,'Guests cannot create conversations');const name=text(input.name,80),kind=input.kind??'channel';if(!['channel','private','dm'].includes(kind)||input.participants!==undefined&&(!Array.isArray(input.participants)||input.participants.some((v:any)=>typeof v!=='string')))fail(400,'Invalid conversation');const members=[...new Set<string>([c.uid,...(input.participants??[])])];if(members.length>(kind==='dm'?50:1000)||kind==='dm'&&members.length<2)fail(400,'Invalid participants');if(!await c.one(`SELECT 1 WHERE ${creationAllowed('?',kind)}`,[c.uid]))fail(403,'Workspace channel policy does not allow you to create this channel type');const cid=crypto.randomUUID();await c.batch([c.sql('INSERT INTO nook_conversations(id,name,kind,owner) VALUES(?,?,?,?)',cid,name,kind,c.uid),c.sql('INSERT INTO nook_members SELECT ?,value FROM json_each(?)',cid,JSON.stringify(members)),...(kind==='dm'?[c.sql('INSERT INTO nook_dm_roster SELECT ?,value FROM json_each(?)',cid,JSON.stringify(members))]:[]),...c.attribution(cid)],undefined,`${creationAllowed('?',kind)} AND NOT EXISTS(SELECT 1 FROM json_each(?) j WHERE NOT EXISTS(SELECT 1 FROM oa_operators o WHERE o.id=j.value AND o.status='active' AND ${fullMember('o.id')}))`,[c.uid,JSON.stringify(members)]);await c.hint();return {id:cid,name,kind,owner:c.uid,seq:0,version:1,manager:kind==='dm'?null:c.uid,topic:'',archived:false}}
 if(action==='conversationNotify')return updateConversationNotify(c,id,input)
 if(action==='members')return changeChannelMember(c,id,input)
 // The transaction admits the frontier; only a refusal needs classification.
 if(action==='read'){if(!Number.isSafeInteger(input.seq)||input.seq<0)fail(400,'Invalid read frontier');try{await c.batch([c.sql('UPDATE nook_read_generations SET generation=generation+1 WHERE conversation=? AND user=? AND EXISTS(SELECT 1 FROM nook_reads WHERE conversation=? AND user=? AND seq>=?)',id,c.uid,id,c.uid,input.seq),c.sql(`INSERT INTO nook_reads SELECT ?,?,?,COALESCE((SELECT ordinal FROM nook_message_history WHERE conversation=? AND sequence<=? ORDER BY sequence DESC LIMIT 1),0),COALESCE((SELECT author_ordinal FROM nook_message_history WHERE conversation=? AND author=? AND sequence<=? ORDER BY sequence DESC LIMIT 1),0) ON CONFLICT(conversation,user) DO UPDATE SET seq=excluded.seq,total=excluded.total,own=excluded.own WHERE excluded.seq>nook_reads.seq`,id,c.uid,input.seq,id,input.seq,id,c.uid,input.seq)],id,'? <= (SELECT seq FROM nook_conversations WHERE id=?)',[input.seq,id])}catch(error){if(input.seq>(await c.one('SELECT seq FROM nook_conversations WHERE id=?',[id],id)).seq)fail(400,'Invalid read frontier');throw error}await c.hint();return {ok:true}}
 if(action==='preferences'){
  if(Object.entries(input).some(([k,v])=>!['muted','followed'].includes(k)||typeof v!=='boolean'))fail(400,'Only boolean muted/followed preferences are supported')
  await c.batch([c.sql('INSERT INTO nook_preferences(user,conversation,muted,followed) VALUES(?,?,COALESCE(?,0),COALESCE(?,0)) ON CONFLICT(user,conversation) DO UPDATE SET muted=COALESCE(?,muted),followed=COALESCE(?,followed)',c.uid,id,input.muted===undefined?null:+input.muted,input.followed===undefined?null:+input.followed,input.muted===undefined?null:+input.muted,input.followed===undefined?null:+input.followed),...(input.muted?[muteConversationNotify(c,id)]:[])],id)
  await c.hint();return read(c,'preferences',id)
 }
 if(action==='settings'){
  if(Object.keys(input).some(k=>k!=='dndUntil'))fail(400,'Unsupported setting')
  const until=input.dndUntil===null?null:future(input.dndUntil),wake=until??Date.now()
  await c.batch([c.sql('INSERT INTO nook_settings VALUES(?,?) ON CONFLICT(user) DO UPDATE SET dnd_until=excluded.dnd_until',c.uid,until),
   // Releasing quiet time must not advance a new push past its initial gather.
   c.sql("UPDATE nook_notify_queue SET due=CASE WHEN channel='push' THEN max(created+?,?) ELSE ? END WHERE user=? AND state='pending' AND due>?",PUSH_GATHER_MS,wake,wake,c.uid,wake)])
  await c.hint();return {dndUntil:until}
 }
 if(action==='follow')return followThread(c,id,input)
 if(action==='threadRead')return readThread(c,id,input)
 if(action==='attentionAction'&&id.startsWith('saved:'))return actOnSavedReminder(c,id.slice(6),input)
 if(action==='attentionAction'){if(!['done','snooze'].includes(input.action))fail(400,'Choose done or snooze');const a=await c.one('SELECT conversation FROM nook_attention WHERE id=? AND user=?',[id,c.uid]);if(!a)fail(404,'Attention item unavailable');await c.batch([c.sql('UPDATE nook_attention SET state=?,snooze_until=? WHERE id=? AND user=?',input.action==='done'?'done':'snoozed',input.action==='snooze'?future(input.until):null,id,c.uid)],a.conversation);await c.hint();return {ok:true}}
 return fail(404,'Not found')
}
