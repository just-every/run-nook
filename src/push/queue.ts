import type {Context} from '../platform/storage/context'
import {allowedGrant} from '../team/access'
import {GATHER_MS,FOLD_MS} from '../notify/queue'
export const PUSH_GATHER_MS=GATHER_MS,PUSH_FOLD_MS=FOLD_MS
// Native events alone call these, in their event transaction. A direct message
// needs no in-app attention row: channel policy is independent of C13 and C14.
export function enqueuePushMessage(c:Context,message:string,now:number){return c.sql(`INSERT OR IGNORE INTO nook_notify_queue(id,dedupe,user,conversation,actor,message,reason,due,created,updated,channel,device,event_seq,attention)
 SELECT 'push:'||s.id||':'||m.user||':'||d.id,'push:'||s.id||':'||m.user||':'||d.id,m.user,m.conversation,s.author,s.id,
 CASE WHEN j.value IS NOT NULL AND json_extract(s.payload,'$.urgent')=1 THEN 'urgent-request' WHEN j.value IS NOT NULL THEN 'mention' WHEN t.message IS NOT NULL AND p.push_threads=1 THEN 'thread-follow' ELSE 'direct-message' END,
 ?,?,?,'push',d.id,s.sequence,a.id
 FROM nook_messages s JOIN nook_conversations v ON v.id=s.conversation JOIN nook_members m ON m.conversation=s.conversation
 JOIN nook_notify_preferences p ON p.user=m.user JOIN nook_push_devices d ON d.user=m.user
 LEFT JOIN nook_preferences f ON f.user=m.user AND f.conversation=m.conversation
 LEFT JOIN nook_thread_follows t ON t.user=m.user AND t.message=s.parent
 LEFT JOIN json_each(s.payload,'$.mentions') j ON j.value=m.user
 LEFT JOIN nook_attention a ON a.message=s.id AND a.user=m.user
 WHERE s.id=? AND m.user<>s.author AND ${allowedGrant('m.user','m.conversation')} AND
 CASE WHEN j.value IS NOT NULL AND json_extract(s.payload,'$.urgent')=1 THEN p.push_urgent=1 WHEN j.value IS NOT NULL THEN p.push_mentions=1
 ELSE COALESCE(f.muted,0)=0 AND (v.kind='dm' AND p.push_direct=1 OR t.message IS NOT NULL AND p.push_threads=1) END`,now+PUSH_GATHER_MS,now,now,message)}
export function enqueuePushOutcome(c:Context,outcome:string,version:number,now:number){const prefix=`${outcome}.${version}`;return c.sql(`INSERT OR IGNORE INTO nook_notify_queue(id,dedupe,user,conversation,actor,outcome,reason,due,created,updated,channel,device,event_seq,attention)
 SELECT 'push:'||a.id||':'||d.id,'push:'||a.id||':'||d.id,a.user,a.conversation,?,o.id,
 CASE WHEN o.status='reported-complete' THEN 'commitment-complete' WHEN o.version=1 THEN 'commitment-proposal' ELSE 'commitment-revision' END,?,?,?,'push',d.id,a.event_seq,a.id
 FROM nook_attention a JOIN nook_outcomes o ON o.id=a.outcome JOIN nook_notify_preferences p ON p.user=a.user AND p.push_mentions=1 JOIN nook_push_devices d ON d.user=a.user
 WHERE a.id>? AND a.id<? AND o.id=? AND o.status IN ('proposed','reported-complete')`,c.uid,now+PUSH_GATHER_MS,now,now,prefix+'.',prefix+'/',outcome)}
