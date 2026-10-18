import {allowedGrant,fullMember} from '../team/access'
import {Fault,fail} from '../family/team-chat/domain'
import type {Context,MessageWriter} from '../platform/storage/context'
import {broadcastSuppressed,canBroadcast,everyoneAllowed,literal} from './policy'
export type BroadcastKind='channel'|'here'|'everyone'
export function broadcastKind(body:string):BroadcastKind|null{
 const kinds=[...new Set([...body.matchAll(/(?:^|[^\p{L}\p{N}_])@(channel|here|everyone)(?![\p{L}\p{N}_])|<!(channel|here|everyone)>/gu)].map(match=>match[1]??match[2]))]
 if(kinds.length>1)fail(400,'Use one channel-wide mention type per message')
 return kinds.length?kinds[0] as BroadcastKind:null
}
// Evaluated again inside the commit transaction. Presence belongs to a current
// session, works without a push subscription and expires after ten minutes.
export function audience(conversation:string,sender:string,kind:BroadcastKind){return `SELECT o.id AS user FROM oa_operators o WHERE o.status='active' AND o.id<>${sender} AND ${allowedGrant('o.id',conversation)} AND ${kind==='everyone'?fullMember('o.id'):`EXISTS(SELECT 1 FROM nook_members m WHERE m.user=o.id AND m.conversation=${conversation})`} AND NOT ${broadcastSuppressed('o.id',conversation)} AND ${kind==='here'?`COALESCE((SELECT away FROM nook_broadcast_choices WHERE user=o.id),0)=0 AND EXISTS(SELECT 1 FROM nook_broadcast_presence p JOIN oa_sessions s ON s.id=p.session WHERE p.user=o.id AND p.heartbeat>CAST(unixepoch('subsec')*1000 AS INTEGER)-600000 AND s.operator_id=o.id AND s.operator_version=o.version AND s.revoked_at IS NULL AND s.expires_at>CAST(unixepoch('subsec')*1000 AS INTEGER))`:'1'}`}
export function broadcastFence(conversation:string,sender:string,kind:BroadcastKind,confirmed:boolean){return `${canBroadcast(conversation,sender)} AND EXISTS(SELECT 1 FROM nook_conversations WHERE id=${conversation} AND kind<>'dm') AND ${kind==='everyone'?everyoneAllowed(conversation):'1'} AND (${confirmed?1:0}=1 OR (SELECT count(*) FROM (${audience(conversation,sender,kind)}))<6)`}
export class BroadcastConfirmation extends Fault{
 constructor(readonly broadcast:{kind:BroadcastKind;recipients:number;quiet:number;otherZones:number}){super(409,`Confirm @${broadcast.kind} to notify ${broadcast.recipients} people (${broadcast.quiet} in quiet time, ${broadcast.otherZones} in other time zones)`)}
}
export async function previewBroadcast(c:Context,id:string,body:string){
 await c.check(id)
 const kind=broadcastKind(body);if(!kind)return null
 const conversation=literal(id),sender=literal(c.uid)
 if(!await c.one(`SELECT 1 FROM nook_conversations WHERE id=? AND kind<>'dm'`,[id],id))fail(400,'Channel-wide mentions are available in channels only')
 if(!await c.one(`SELECT 1 WHERE ${canBroadcast(conversation,sender)}`,[],id))fail(403,'You cannot broadcast under this channel’s policy')
 if(kind==='everyone'&&!await c.one(`SELECT 1 WHERE ${everyoneAllowed(conversation)}`,[],id))fail(403,'@everyone is only available in the designated organization-wide default channel; use @channel here')
 const row=await c.one(`SELECT count(*) AS recipients,COALESCE(sum(COALESCE((SELECT dnd_until FROM nook_settings WHERE user=r.user),0)>CAST(unixepoch('subsec')*1000 AS INTEGER)),0) AS quiet,COALESCE(sum(COALESCE((SELECT zone FROM nook_broadcast_choices WHERE user=r.user),'UTC')<>COALESCE((SELECT zone FROM nook_broadcast_choices WHERE user=${sender}),'UTC')),0) AS otherZones FROM (${audience(conversation,sender,kind)}) r`,[],id)
 return {kind,...row} as {kind:BroadcastKind;recipients:number;quiet:number;otherZones:number}
}
// Called intrinsically by messageStatements, including durable scheduled sends.
// No JavaScript recipient list is accepted from the caller.
export function broadcastStatements(c:MessageWriter,id:string,mid:string,kind:BroadcastKind){
 const conversation=literal(id),sender=literal(c.uid),message=literal(mid)
 return [
  ...(kind==='everyone'?[c.sql(`INSERT OR IGNORE INTO nook_members SELECT ${conversation},o.id FROM oa_operators o WHERE o.status='active' AND ${fullMember('o.id')}`)]:[]),
  c.sql(`INSERT INTO nook_broadcast_recipients SELECT ${message},user FROM (${audience(conversation,sender,kind)})`),
  c.sql(`INSERT INTO nook_broadcasts SELECT ${message},?,count(*),COALESCE(sum(COALESCE((SELECT dnd_until FROM nook_settings WHERE user=r.user),0)>CAST(unixepoch('subsec')*1000 AS INTEGER)),0),COALESCE(sum(COALESCE((SELECT zone FROM nook_broadcast_choices WHERE user=r.user),'UTC')<>COALESCE((SELECT zone FROM nook_broadcast_choices WHERE user=${sender}),'UTC')),0) FROM nook_broadcast_recipients r WHERE r.message=${message}`,kind),
 ]
}
export const broadcastRecipient=(message:string,user:string)=>`EXISTS(SELECT 1 FROM nook_broadcast_recipients br WHERE br.message=${message} AND br.user=${user})`
