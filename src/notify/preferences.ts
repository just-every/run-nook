import {pushSettings,pushPreferenceStatements} from '../push/preferences'
import type {Context} from '../platform/storage/context'
import {fail} from '../family/team-chat/domain'
import {sendingSetup} from './sender'
import {GATHER_MS} from './queue'
// Visible failure (C14): a send that is being retried or was given up shows to
// its recipient, to the person whose message caused it and to the owner for a week.
const PROBLEM_MS=7*86400_000,problem="q.channel='email' AND q.state IN ('retrying','failed') AND q.updated>?"
export async function notifySettings(c:Context){
 const since=Date.now()-PROBLEM_MS,owner=c.session.operator.role==='owner'
 const [p,mine,caused]=await Promise.all([
  c.one('SELECT mentions,urgent,urgent_quiet FROM nook_notify_preferences WHERE user=?',[c.uid]),
  c.one(`SELECT q.error,q.state,q.updated FROM nook_notify_queue q WHERE q.user=? AND ${problem} ORDER BY q.updated DESC LIMIT 1`,[c.uid,since]),
  c.rows(`SELECT q.error,q.state,q.updated,o.display_name AS recipient FROM nook_notify_queue q JOIN oa_operators o ON o.id=q.user WHERE q.actor=? AND ${problem} ORDER BY q.updated DESC LIMIT 5`,[c.uid,since]),
 ])
 const workspace=owner?{sending:sendingSetup(c.env),notDelivered:await c.one(`SELECT count(*) AS count,max(q.updated) AS latest,(SELECT error FROM nook_notify_queue q WHERE ${problem} ORDER BY q.updated DESC LIMIT 1) AS error FROM nook_notify_queue q WHERE ${problem}`,[since,since])}:null
 return {push:await pushSettings(c),mentions:!!p?.mentions,urgent:!!p?.urgent,urgentQuiet:!!p?.urgent_quiet,address:c.session.operator.email,
  problem:mine?{error:mine.error,retrying:mine.state==='retrying',at:mine.updated}:null,
  notDelivered:caused.map(r=>({recipient:r.recipient,error:r.error,retrying:r.state==='retrying',at:r.updated})),
  workspace:workspace&&{sending:workspace.sending,notDelivered:workspace.notDelivered?.count?{count:workspace.notDelivered.count,error:workspace.notDelivered.error,at:workspace.notDelivered.latest}:null}}
}
/** Turning a choice off stops the next email: every queued item is checked again when it is built.
 * Wake only the changed channel, preserving initial gathering and retry backoff. */
export async function updateNotifySettings(c:Context,input:Record<string,any>){
 if(!Object.keys(input).length||Object.entries(input).some(([k,v])=>!['mentions','urgent','urgentQuiet','push'].includes(k)||(k!=='push'&&typeof v!=='boolean')))fail(400,'Only boolean mentions, urgent and urgentQuiet choices are supported')
 const value=(k:string)=>input[k]===undefined?null:+input[k]
 const now=Date.now(),email=['mentions','urgent','urgentQuiet'].some(k=>Object.hasOwn(input,k)),push=Object.hasOwn(input,'push')
 const wake=(channel:string)=>c.sql("UPDATE nook_notify_queue SET due=max(created+?,min(due,?)) WHERE user=? AND channel=? AND state='pending'",GATHER_MS,now,c.uid,channel)
 await c.batch([...(push?[...pushPreferenceStatements(c,input.push),wake('push')]:[]),...(email?[c.sql('INSERT INTO nook_notify_preferences(user,mentions,urgent,urgent_quiet,updated) VALUES(?,COALESCE(?,0),COALESCE(?,0),COALESCE(?,0),?) ON CONFLICT(user) DO UPDATE SET mentions=COALESCE(?,mentions),urgent=COALESCE(?,urgent),urgent_quiet=COALESCE(?,urgent_quiet),updated=excluded.updated',c.uid,value('mentions'),value('urgent'),value('urgentQuiet'),now,value('mentions'),value('urgent'),value('urgentQuiet')),wake('email')]:[])])
 await c.hint();return notifySettings(c)
}
