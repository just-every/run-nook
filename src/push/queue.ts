import {activeDesktopUntil} from './activity'
import {broadcastRecipient} from '../broadcast/audience'
import {pushBroadcastChoice} from '../broadcast/policy'
import {conversationLevel,effectiveThreadFollow} from '../team/conversation-notify.server'
import type {Context} from '../platform/storage/context'
import {allowedGrant} from '../team/access'
import {GATHER_MS,FOLD_MS} from '../notify/queue'
export const PUSH_GATHER_MS=GATHER_MS,PUSH_FOLD_MS=FOLD_MS
// Native events alone call these, in their event transaction. A direct message
// needs no in-app attention row: channel policy is independent of C13 and C14.
export function enqueuePushMessage(c:Pick<Context,'uid'|'sql'>,message:string,now:number){const active=activeDesktopUntil('m.user'),hold=`d.device_class='mobile' AND d.mobile_always=0 AND COALESCE(p.mobile_when_active,'inactive')='inactive' AND NOT(j.value IS NOT NULL AND json_extract(s.payload,'$.urgent')=1 AND p.push_urgent_quiet=1) AND ${active}>${now}`;return c.sql(`INSERT OR IGNORE INTO nook_notify_queue(id,dedupe,user,conversation,actor,message,reason,due,created,updated,channel,device,event_seq,attention,held_at,active_until)
 SELECT 'push:'||s.id||':'||m.user||':'||d.id,'push:'||s.id||':'||m.user||':'||d.id,m.user,m.conversation,s.author,s.id,
 CASE WHEN j.value IS NOT NULL AND json_extract(s.payload,'$.urgent')=1 THEN 'urgent-request' WHEN j.value IS NOT NULL THEN 'mention' WHEN ${broadcastRecipient('s.id','m.user')} THEN 'broadcast' WHEN ${effectiveThreadFollow('m.user','m.conversation','s.parent','d.device_class')} AND p.push_threads=1 THEN 'thread-follow' WHEN v.kind='dm' THEN 'direct-message' ELSE 'all-messages' END,
 ?,?,?,'push',d.id,s.sequence,a.id,CASE WHEN ${hold} THEN ${now} END,CASE WHEN ${hold} THEN ${active} END
 FROM nook_messages s JOIN nook_conversations v ON v.id=s.conversation JOIN nook_members m ON m.conversation=s.conversation
 LEFT JOIN nook_notify_preferences p ON p.user=m.user JOIN nook_push_devices d ON d.user=m.user
 LEFT JOIN nook_preferences f ON f.user=m.user AND f.conversation=m.conversation
 LEFT JOIN json_each(s.payload,'$.mentions') j ON j.value=m.user
 LEFT JOIN nook_attention a ON a.message=s.id AND a.user=m.user
 WHERE s.id=? AND m.user<>s.author AND ${allowedGrant('m.user','m.conversation')} AND ${conversationLevel('m.user','m.conversation','d.device_class')}<>'nothing' AND
 CASE WHEN j.value IS NOT NULL AND json_extract(s.payload,'$.urgent')=1 THEN p.push_urgent=1 WHEN j.value IS NOT NULL THEN p.push_mentions=1 WHEN ${broadcastRecipient('s.id','m.user')} THEN ${pushBroadcastChoice('m.user')}=1
 ELSE NOT EXISTS(SELECT 1 FROM nook_broadcasts b WHERE b.message=s.id) AND COALESCE(f.muted,0)=0 AND (${effectiveThreadFollow('m.user','m.conversation','s.parent','d.device_class')} AND p.push_threads=1 OR ${conversationLevel('m.user','m.conversation','d.device_class')}='all' AND (s.parent IS NULL AND (v.kind<>'dm' OR p.push_direct=1) OR v.kind='dm' AND p.push_direct=1 AND NOT EXISTS(SELECT 1 FROM nook_thread_unfollows u WHERE u.user=m.user AND u.message=s.parent))) END`,now+PUSH_GATHER_MS,now,now,message)}
/** A keyword Attention item alerts on a member's devices like any other message reason, only when they turned keyword push on. */
export function enqueuePushKeyword(c:Pick<Context,'uid'|'sql'>,message:string,now:number){
 const active=activeDesktopUntil('a.user'),hold=`d.device_class='mobile' AND d.mobile_always=0 AND COALESCE(p.mobile_when_active,'inactive')='inactive' AND ${active}>${now}`
 return c.sql(`INSERT OR IGNORE INTO nook_notify_queue(id,dedupe,user,conversation,actor,message,reason,due,created,updated,channel,device,event_seq,attention,held_at,active_until)
 SELECT 'push:'||s.id||':'||a.user||':'||d.id,'push:'||s.id||':'||a.user||':'||d.id,a.user,a.conversation,s.author,s.id,'keyword',?,?,?,'push',d.id,s.sequence,a.id,CASE WHEN ${hold} THEN ${now} END,CASE WHEN ${hold} THEN ${active} END
 FROM nook_attention a JOIN nook_messages s ON s.id=a.message JOIN nook_notify_preferences p ON p.user=a.user AND p.push_keywords=1 JOIN nook_push_devices d ON d.user=a.user
 WHERE a.id>? AND a.id<? AND a.message=? AND a.reason='keyword' AND ${conversationLevel('a.user','a.conversation','d.device_class')}<>'nothing'`,now+PUSH_GATHER_MS,now,now,message+'.',message+'/',message)
}
export function enqueuePushOutcome(c:Context,outcome:string,version:number,now:number){const prefix=`${outcome}.${version}`,active=activeDesktopUntil('a.user'),hold=`d.device_class='mobile' AND d.mobile_always=0 AND COALESCE(p.mobile_when_active,'inactive')='inactive' AND ${active}>${now}`;return c.sql(`INSERT OR IGNORE INTO nook_notify_queue(id,dedupe,user,conversation,actor,outcome,reason,due,created,updated,channel,device,event_seq,attention,held_at,active_until)
 SELECT 'push:'||a.id||':'||d.id,'push:'||a.id||':'||d.id,a.user,a.conversation,?,o.id,
 CASE WHEN o.status='reported-complete' THEN 'commitment-complete' WHEN o.version=1 THEN 'commitment-proposal' ELSE 'commitment-revision' END,?,?,?,'push',d.id,a.event_seq,a.id,CASE WHEN ${hold} THEN ${now} END,CASE WHEN ${hold} THEN ${active} END
 FROM nook_attention a JOIN nook_outcomes o ON o.id=a.outcome JOIN nook_notify_preferences p ON p.user=a.user AND p.push_mentions=1 JOIN nook_push_devices d ON d.user=a.user
 WHERE a.id>? AND a.id<? AND o.id=? AND o.status IN ('proposed','reported-complete') AND ${conversationLevel('a.user','a.conversation','d.device_class')}<>'nothing'`,c.uid,now+PUSH_GATHER_MS,now,now,prefix+'.',prefix+'/',outcome)}
