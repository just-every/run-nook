import {activeDesktopUntil,mobileRouting,mobileDelay} from './activity'
import {broadcastSuppressed,pushBroadcastChoice} from '../broadcast/policy'
import {conversationLevel,effectiveThreadFollow} from '../team/conversation-notify.server'
import {recipientCancellation,attentionCancellation} from '../notify/policy'

export const pushCancellation=`CASE ${recipientCancellation}
 ${attentionCancellation('q.attention','q.event_seq').replace("THEN 'seen'","THEN CASE WHEN q.held_at IS NOT NULL THEN 'held-active-elsewhere' ELSE 'seen' END")}
 WHEN ${conversationLevel('q.user','q.conversation',"(SELECT device_class FROM nook_push_devices WHERE id=q.device)")}='nothing' THEN 'conversation-silent'
 WHEN NOT EXISTS(SELECT 1 FROM nook_push_devices d JOIN oa_sessions s ON s.id=d.session JOIN oa_operators o ON o.id=d.user WHERE d.id=q.device AND d.user=q.user AND s.operator_id=d.user AND s.operator_version=d.version AND o.version=d.version AND s.revoked_at IS NULL AND s.expires_at>? AND (json_extract(d.subscription,'$.expirationTime') IS NULL OR json_extract(d.subscription,'$.expirationTime')>?)) THEN 'device-inactive'
 WHEN q.reason='broadcast' AND ${broadcastSuppressed('q.user','q.conversation')} THEN 'broadcast-suppressed'
 WHEN q.reason='broadcast' AND ${pushBroadcastChoice('q.user')}<>1 THEN 'turned-off'
 WHEN q.reason NOT IN ('all-messages','broadcast') AND NOT EXISTS(SELECT 1 FROM nook_notify_preferences p WHERE p.user=q.user AND CASE q.reason WHEN 'urgent-request' THEN p.push_urgent WHEN 'direct-message' THEN p.push_direct WHEN 'thread-follow' THEN p.push_threads WHEN 'keyword' THEN p.push_keywords WHEN 'all-messages' THEN 1 ELSE p.push_mentions END=1) THEN 'turned-off'
 WHEN q.reason IN ('direct-message','thread-follow','all-messages') AND EXISTS(SELECT 1 FROM nook_preferences p WHERE p.user=q.user AND p.conversation=q.conversation AND p.muted=1) THEN 'muted'
 WHEN q.reason='keyword' AND EXISTS(SELECT 1 FROM nook_preferences p WHERE p.user=q.user AND p.conversation=q.conversation AND p.muted=1) AND COALESCE((SELECT keywords_in_muted FROM nook_notify_preferences WHERE user=q.user),0)=0 THEN 'muted'
 WHEN q.reason='thread-follow' AND NOT EXISTS(SELECT 1 FROM nook_messages m WHERE m.id=q.message AND ${effectiveThreadFollow('q.user','q.conversation','m.parent',"(SELECT device_class FROM nook_push_devices WHERE id=q.device)")}) THEN 'unfollowed'
 WHEN q.reason IN ('direct-message','all-messages') AND ${conversationLevel('q.user','q.conversation',"(SELECT device_class FROM nook_push_devices WHERE id=q.device)")}<>'all' THEN 'turned-off'
 WHEN q.reason='direct-message' AND EXISTS(SELECT 1 FROM nook_messages m JOIN nook_thread_unfollows u ON u.message=m.parent AND u.user=q.user WHERE m.id=q.message) THEN 'unfollowed' END`

// The third clock binding follows cancellation's two expiration bindings.
export const pushHeldUntil=`max(
 COALESCE((SELECT CASE WHEN q.reason='urgent-request' AND EXISTS(SELECT 1 FROM nook_notify_preferences p WHERE p.user=q.user AND p.push_urgent_quiet=1) THEN 0 ELSE quiet_until END FROM nook_quiet_schedules WHERE user=q.user),0),
 COALESCE((SELECT snooze_until FROM nook_attention WHERE id=q.attention AND state='snoozed'),0),
 COALESCE((SELECT CASE WHEN q.reason='urgent-request' AND p.push_urgent_quiet=1 THEN 0 ELSE s.dnd_until END FROM nook_settings s LEFT JOIN nook_notify_preferences p ON p.user=s.user WHERE s.user=q.user),0),
 CASE WHEN ${mobileRouting} THEN CASE WHEN ${activeDesktopUntil('q.user')}>? THEN ${activeDesktopUntil('q.user')}+${mobileDelay} WHEN q.held_at IS NOT NULL AND q.released_at IS NULL THEN COALESCE(q.active_until,0)+${mobileDelay} ELSE 0 END ELSE 0 END)`
