import {recipientCancellation,attentionCancellation} from '../notify/policy'

export const pushCancellation=`CASE ${recipientCancellation}
 ${attentionCancellation('q.attention','q.event_seq')}
 WHEN NOT EXISTS(SELECT 1 FROM nook_push_devices d JOIN oa_sessions s ON s.id=d.session JOIN oa_operators o ON o.id=d.user WHERE d.id=q.device AND d.user=q.user AND s.operator_id=d.user AND s.operator_version=d.version AND o.version=d.version AND s.revoked_at IS NULL AND s.expires_at>? AND (json_extract(d.subscription,'$.expirationTime') IS NULL OR json_extract(d.subscription,'$.expirationTime')>?)) THEN 'device-inactive'
 WHEN NOT EXISTS(SELECT 1 FROM nook_notify_preferences p WHERE p.user=q.user AND CASE q.reason WHEN 'urgent-request' THEN p.push_urgent WHEN 'direct-message' THEN p.push_direct WHEN 'thread-follow' THEN p.push_threads ELSE p.push_mentions END=1) THEN 'turned-off'
 WHEN q.reason IN ('direct-message','thread-follow') AND EXISTS(SELECT 1 FROM nook_preferences p WHERE p.user=q.user AND p.conversation=q.conversation AND p.muted=1) THEN 'muted'
 WHEN q.reason='thread-follow' AND NOT EXISTS(SELECT 1 FROM nook_messages m JOIN nook_thread_follows t ON t.message=m.parent AND t.user=q.user WHERE m.id=q.message) THEN 'unfollowed' END`

// A third clock binding follows pushCancellation's two expiration bindings.
// This expression is reused for selection and the final pre-send authority check.
export const pushHeldUntil=`max(
 COALESCE((SELECT snooze_until FROM nook_attention WHERE id=q.attention AND state='snoozed'),0),
 COALESCE((SELECT CASE WHEN q.reason='urgent-request' AND p.push_urgent_quiet=1 THEN 0 ELSE s.dnd_until END FROM nook_settings s LEFT JOIN nook_notify_preferences p ON p.user=s.user WHERE s.user=q.user),0),
 COALESCE((SELECT max(p.expires) FROM nook_push_presence p JOIN nook_push_devices d ON d.id=p.device JOIN oa_sessions s ON s.id=p.session JOIN oa_operators o ON o.id=p.user WHERE p.user=q.user AND d.user=p.user AND d.session=p.session AND d.version=s.operator_version AND s.operator_id=p.user AND s.revoked_at IS NULL AND s.expires_at>? AND s.operator_version=o.version AND o.status='active'),0))`
