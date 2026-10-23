import {fail} from '../family/team-chat/domain'
import type {Context} from '../platform/storage/context'
import {send} from '../platform/storage/messages'
import {channelManagement} from './channel-policy'
import {savedId} from './saved-policy'
import {POLL_OPTIONS_MAX} from './poll-limits'

export const POLL_QUESTION_MAX=500,POLL_LABEL_MAX=120
type Spec={question:string;options:string[];multiple:boolean;anonymous:boolean;closes:number|null}
const object=(value:unknown)=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:fail(400,'Expected a JSON object')

/** Exact JSON: {question,options:[2..20 labels],multiple,anonymous,closes:epoch ms|null,intent}. */
export function pollSpec(value:unknown):Spec&{intent:string}{
 const input=object(value)
 if(Object.keys(input).some(key=>!['question','options','multiple','anonymous','closes','intent'].includes(key)))fail(400,'Unexpected poll field')
 const question=typeof input.question==='string'?input.question.trim():''
 if(!question||question.length>POLL_QUESTION_MAX)fail(400,`Ask a question of up to ${POLL_QUESTION_MAX} characters`)
 if(!Array.isArray(input.options)||input.options.length<2||input.options.length>POLL_OPTIONS_MAX)fail(400,`A poll has 2 to ${POLL_OPTIONS_MAX} options`)
 const options=(input.options as unknown[]).map(option=>typeof option==='string'?option.trim():'')
 if(options.some(label=>!label||label.length>POLL_LABEL_MAX))fail(400,`Each option is 1 to ${POLL_LABEL_MAX} characters`)
 if(new Set(options.map(label=>label.toLowerCase())).size!==options.length)fail(400,'Options must be different')
 if(typeof input.multiple!=='boolean'||typeof input.anonymous!=='boolean')fail(400,'Choose single or multiple choice and named or anonymous votes')
 const closes=input.closes??null
 if(closes!==null&&(!Number.isSafeInteger(closes)||(closes as number)<=Date.now()||(closes as number)>8.64e15))fail(400,'Choose a future close time')
 if(typeof input.intent!=='string'||!input.intent||input.intent.length>128)fail(400,'Invalid intent')
 return {question,options,multiple:input.multiple as boolean,anonymous:input.anonymous as boolean,closes:closes as number|null,intent:input.intent as string}
}

/** The poll is its question message: one posting-fenced batch writes the message and the poll, so a poll appears only where the person may post. */
export async function createPoll(c:Context,conversation:string,input:unknown){
 const {intent,...spec}=pollSpec(input),now=Date.now()
 // A retry of the same intent must carry the same poll; the message payload does not hold the options.
 const prior=await c.one('SELECT m.id,p.multiple,p.anonymous,p.closes,(SELECT json_group_array(label) FROM (SELECT label FROM nook_poll_options WHERE message=m.id ORDER BY position)) AS options FROM nook_messages m LEFT JOIN nook_polls p ON p.message=m.id WHERE m.conversation=? AND m.author=? AND m.intent=?',[conversation,c.uid,intent],conversation)
 if(prior&&(prior.multiple!==+spec.multiple||prior.anonymous!==+spec.anonymous||prior.closes!==spec.closes||prior.options!==JSON.stringify(spec.options)))fail(409,'Intent payload changed')
 return send(c,conversation,{body:spec.question,intent},{
  statements:mid=>[
   c.sql('INSERT INTO nook_polls(message,conversation,creator,multiple,anonymous,closes,created) VALUES(?,?,?,?,?,?,?)',mid,conversation,c.uid,+spec.multiple,+spec.anonymous,spec.closes,now),
   ...spec.options.map((label,index)=>c.sql('INSERT INTO nook_poll_options VALUES(?,?,?)',mid,index+1,label)),
  ],
 })
}

const openFence=`EXISTS(SELECT 1 FROM nook_polls WHERE message=? AND closed_at IS NULL AND (closes IS NULL OR closes>?))`
// A vote moves the conversation frontier so every open tab refreshes its counts. The event names no actor: an anonymous poll must not reveal who voted.
const pollEvent=(c:Context,conversation:string,message:string)=>[c.sql('UPDATE nook_conversations SET seq=seq+1 WHERE id=?',conversation),c.sql("INSERT INTO nook_events SELECT id,seq,'poll',?,NULL FROM nook_conversations WHERE id=?",message,conversation)]
async function find(c:Context,value:unknown){
 const message=savedId(value),poll=await c.one('SELECT message,conversation,creator,multiple,anonymous,closes,closed_at,created FROM nook_polls WHERE message=?',[message])
 if(!poll)fail(404,'Poll unavailable')
 await c.check(poll.conversation)
 return poll
}
const isOpen=(poll:{closes:number|null;closed_at:number|null})=>poll.closed_at===null&&(poll.closes===null||poll.closes>Date.now())

/** Counts for every current member; voters only when the poll is named. An anonymous poll shows each member only their own vote, to owners and admins as well. */
export async function readPoll(c:Context,value:unknown){
 const poll=await find(c,value),conversation=poll.conversation as string,message=poll.message as string
 const [message_,options,mine,voters,total,manage]=await Promise.all([
  c.one('SELECT body FROM nook_messages WHERE id=? AND deleted=0',[message],conversation),
  c.rows('SELECT o.position,o.label,(SELECT count(*) FROM nook_poll_votes v WHERE v.message=o.message AND v.position=o.position) AS count FROM nook_poll_options o WHERE o.message=? ORDER BY o.position',[message],conversation),
  c.rows('SELECT position FROM nook_poll_votes WHERE message=? AND voter=? ORDER BY position',[message,c.uid],conversation),
  poll.anonymous?Promise.resolve([]):c.rows('SELECT v.position,v.voter AS id,a.name FROM nook_poll_votes v JOIN nook_actors a ON a.id=v.voter WHERE v.message=? ORDER BY v.position,v.created,v.voter LIMIT 2000',[message],conversation),
  c.one('SELECT count(DISTINCT voter) AS n FROM nook_poll_votes WHERE message=?',[message],conversation),
  c.one(`SELECT (? OR ${channelManagement('?','?')}) AS can`,[poll.creator===c.uid?1:0,c.uid,conversation],conversation),
 ])
 if(!message_)fail(404,'Poll unavailable')
 const open=isOpen(poll)
 return {message,question:message_.body,multiple:!!poll.multiple,anonymous:!!poll.anonymous,closes:poll.closes,closedAt:poll.closed_at,open,voters:total!.n,
  options:options.map(o=>({...o,...(poll.anonymous?{}:{voters:voters.filter((v:any)=>v.position===o.position).map((v:any)=>({id:v.id,name:v.name}))})})),
  mine:mine.map((row:any)=>row.position),canClose:open&&!!manage?.can}
}

/** Exact JSON: {choices:[positions]}. The member's whole vote set is replaced until the poll closes; an empty set withdraws it. */
export async function vote(c:Context,value:unknown,input:unknown){
 const body=object(input)
 if(Object.keys(body).some(key=>key!=='choices')||!Array.isArray(body.choices)||body.choices.length>POLL_OPTIONS_MAX||body.choices.some(x=>!Number.isSafeInteger(x)||(x as number)<1||(x as number)>POLL_OPTIONS_MAX)||new Set(body.choices).size!==body.choices.length)fail(400,'Choose options by their position')
 const choices=body.choices as number[],poll=await find(c,value),conversation=poll.conversation as string,message=poll.message as string
 if(!poll.multiple&&choices.length>1)fail(400,'This poll takes one choice')
 if(!isOpen(poll))fail(409,'This poll is closed')
 const known=await c.one('SELECT count(*) AS n FROM nook_poll_options WHERE message=? AND position IN (SELECT value FROM json_each(?))',[message,JSON.stringify(choices)],conversation)
 if(known!.n!==choices.length)fail(400,'Unknown option')
 const now=Date.now(),fence=`${openFence} AND (SELECT count(*) FROM nook_poll_options WHERE message=? AND position IN (SELECT value FROM json_each(?)))=? AND EXISTS(SELECT 1 FROM nook_polls WHERE message=? AND (multiple=1 OR ?<=1))`
 await c.writeBatch([
  ...pollEvent(c,conversation,message),
  c.sql('DELETE FROM nook_poll_votes WHERE message=? AND voter=?',message,c.uid),
  ...choices.map(position=>c.sql('INSERT INTO nook_poll_votes VALUES(?,?,?,?,?)',message,conversation,c.uid,position,now)),
 ],conversation,fence,[message,now,message,JSON.stringify(choices),choices.length,message,choices.length])
 await c.hint()
 return readPoll(c,message)
}

/** The poll's creator, the channel manager and owners and admins may close it early; closing is final and counts stay. */
export async function closePoll(c:Context,value:unknown,input:unknown){
 if(Object.keys(object(input)).length)fail(400,'Unexpected field')
 const poll=await find(c,value),conversation=poll.conversation as string,message=poll.message as string
 if(!isOpen(poll))fail(409,'This poll is already closed')
 const allowed=poll.creator===c.uid||await c.one(`SELECT 1 WHERE ${channelManagement('?','?')}`,[c.uid,conversation],conversation)
 if(!allowed)fail(403,'Only the poll creator or a channel manager can close this poll')
 const now=Date.now()
 await c.writeBatch([
  ...pollEvent(c,conversation,message),
  c.sql('UPDATE nook_polls SET closed_at=?,closed_by=? WHERE message=? AND closed_at IS NULL',now,c.uid,message),
 ],conversation,`${openFence} AND (EXISTS(SELECT 1 FROM nook_polls WHERE message=? AND creator=?) OR ${channelManagement('?','?')})`,[message,now,message,c.uid,c.uid,conversation])
 await c.hint()
 return readPoll(c,message)
}
