import type {Context} from '../platform/storage/context'
import {allowedGrant} from '../team/access'
import {pushCancellation} from './policy'
const active=`SELECT DISTINCT q.email AS id FROM nook_notify_queue q WHERE channel='push' AND q.user=? AND q.state IN ('sent','folded') AND (${pushCancellation}) IS NULL`
const attention=`SELECT count(*) AS n FROM nook_attention a WHERE a.user=? AND a.state<>'done' AND (a.snooze_until IS NULL OR a.snooze_until<=?) AND EXISTS(SELECT 1 FROM nook_members m WHERE m.user=a.user AND m.conversation=a.conversation AND ${allowedGrant('m.user','m.conversation')}) AND (a.message IS NULL OR EXISTS(SELECT 1 FROM nook_messages s WHERE s.id=a.message AND s.deleted=0)) AND NOT EXISTS(SELECT 1 FROM nook_reads r WHERE r.user=a.user AND r.conversation=a.conversation AND r.seq>=a.event_seq AND a.message IS NOT NULL) AND NOT EXISTS(SELECT 1 FROM nook_messages s JOIN nook_thread_reads r ON r.message=COALESCE(s.parent,s.id) AND r.user=a.user WHERE s.id=a.message AND r.seq>=a.event_seq)`
const direct=`SELECT count(DISTINCT q.conversation||':'||q.event_seq) AS n FROM nook_notify_queue q WHERE q.channel='push' AND q.user=? AND q.attention IS NULL AND q.state<>'cancelled' AND (${pushCancellation}) IS NULL`
const snapshotSql=`SELECT (SELECT json_group_array(id) FROM (${active})) AS active,(${attention})+(${direct}) AS badge`
const values=(user:string,now:number)=>[user,now,now,user,now,user,now,now]
type SnapshotRow={active:string;badge:number}
const decode=(row:SnapshotRow)=>({active:JSON.parse(row.active) as string[],badge:Number(row.badge)})
// Internal delivery has its own authorization immediately before egress.
export async function pushSnapshot(env:any,user:string,now=Date.now()){
 return decode(await env.DB.prepare(snapshotSql).bind(...values(user,now)).first())
}
// HTTP projections use the same SQL with the request's current session and,
// for read acknowledgements, conversation membership in that data snapshot.
export async function authorizedPushSnapshot(c:Context,conversation?:string){
 return decode((await c.one<SnapshotRow>(snapshotSql,values(c.uid,Date.now()),conversation))!)
}
