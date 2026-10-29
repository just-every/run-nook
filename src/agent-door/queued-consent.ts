import {allowedGrant,productAccess} from '../team/access'

// Applied to the native queue at selection and immediately before the network
// effect. A policy change requires a fresh admission rather than resuming an old
// effect under a different decision. Consent revocation keeps its specific code.
const origin=(field:string)=>`json_extract(q.agent_context,'$.${field}')`
export const queuedAgentCancellation=`CASE WHEN q.agent_context IS NOT NULL THEN CASE
 WHEN EXISTS(SELECT 1 FROM agent_door_state p,json_each(p.envelope,'$.revoked.consents') r WHERE p.id=1 AND r.value=${origin('consent')}) THEN 'consent_revoked'
 WHEN NOT EXISTS(SELECT 1 FROM oa_operators o WHERE o.id=${origin('person')} AND o.version=${origin('version')} AND o.status='active' AND ${productAccess('o.id')}) THEN 'sponsor_revoked'
 WHEN NOT EXISTS(SELECT 1 FROM nook_members m WHERE m.user=${origin('person')} AND m.conversation=q.conversation AND ${allowedGrant('m.user','m.conversation')}) THEN 'sponsor_revoked'
 WHEN NOT EXISTS(SELECT 1 FROM agent_door_agents a WHERE a.id=${origin('agent')} AND a.revoked=0) OR EXISTS(SELECT 1 FROM agent_door_state p,json_each(p.envelope,'$.revoked.agents') r WHERE p.id=1 AND r.value=${origin('agent')}) THEN 'agent_revoked'
 WHEN NOT EXISTS(SELECT 1 FROM agent_door_state p WHERE p.id=1 AND p.envelope IS NOT NULL) THEN 'policy_unset'
 WHEN EXISTS(SELECT 1 FROM agent_door_state p WHERE p.id=1 AND json_extract(p.envelope,'$.exp')*1000<=CAST(unixepoch('subsec')*1000 AS INTEGER)) THEN 'policy_unavailable'
 WHEN EXISTS(SELECT 1 FROM agent_door_state p WHERE p.id=1 AND p.local_paused=1) THEN 'agents_paused'
 WHEN EXISTS(SELECT 1 FROM agent_door_state p WHERE p.id=1 AND json_extract(p.envelope,'$.paused')=1) THEN 'business_paused'
 WHEN NOT EXISTS(SELECT 1 FROM agent_door_state p WHERE p.id=1 AND p.envelope=${origin('policy')} AND p.local_revision=${origin('localRevision')}) THEN 'policy_changed'
 END END`

export const queuedAgentLabel=`json_extract(q.agent_context,'$.label')`
