import {allowedGrant,productAccess} from '../team/access'
// Shared external-delivery fences; each channel adds its own opt-in and reason
// whitelist. All expressions run against the current D1 snapshot at delivery.
export const recipientCancellation=`WHEN NOT EXISTS(SELECT 1 FROM oa_operators o WHERE o.id=q.user AND o.status='active') OR NOT ${productAccess('q.user')} THEN 'recipient-inactive'
 WHEN NOT EXISTS(SELECT 1 FROM nook_members m WHERE m.conversation=q.conversation AND m.user=q.user AND ${allowedGrant('m.user','m.conversation')}) THEN 'no-access'
 WHEN q.actor=q.user THEN 'self'
 WHEN q.message IS NOT NULL AND NOT EXISTS(SELECT 1 FROM nook_messages s WHERE s.id=q.message AND s.deleted=0) OR q.outcome IS NOT NULL AND (NOT EXISTS(SELECT 1 FROM nook_outcomes s WHERE s.id=q.outcome) OR EXISTS(SELECT 1 FROM nook_erased_outcomes e WHERE e.id=q.outcome)) THEN 'source-deleted'`
export function attentionCancellation(reference:string,sequence:string){return `WHEN ${reference} IS NOT NULL AND NOT EXISTS(SELECT 1 FROM nook_attention a WHERE a.id=${reference}) THEN 'source-deleted'
 WHEN EXISTS(SELECT 1 FROM nook_attention a WHERE a.id=${reference} AND a.state='done') OR q.message IS NOT NULL AND (EXISTS(SELECT 1 FROM nook_reads r WHERE r.conversation=q.conversation AND r.user=q.user AND r.seq>=${sequence}) OR EXISTS(SELECT 1 FROM nook_messages m JOIN nook_thread_reads r ON r.message=COALESCE(m.parent,m.id) AND r.user=q.user WHERE m.id=q.message AND r.seq>=${sequence})) THEN 'seen'`}
