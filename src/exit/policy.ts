import {allowedGrant} from '../team/access'
import {publishedImport} from '../imports/projection'

// Identical current membership and import publication rules apply to every job
// scope. Owner/admin roles deliberately do not occur in this predicate.
export const permittedScope=(conversation:string,user:string)=>`EXISTS(SELECT 1 FROM nook_members em WHERE em.conversation=${conversation} AND em.user=${user} AND ${allowedGrant('em.user','em.conversation')}) AND NOT EXISTS(SELECT 1 FROM nook_import_channels ch JOIN nook_imports j ON j.id=ch.job WHERE ch.conversation=${conversation} AND (j.state<>'complete' OR NOT (${publishedImport})))`
export const scopeFence=`NOT EXISTS(SELECT 1 FROM nook_exit_scopes es WHERE es.job=ej.id AND NOT (${permittedScope('es.conversation','ej.owner')}))`
export const revisionFence=`ej.identity_revision=(SELECT revision FROM nook_exit_clock WHERE id=1) AND NOT EXISTS(SELECT 1 FROM nook_exit_scopes es LEFT JOIN nook_exit_changes ec ON ec.conversation=es.conversation WHERE es.job=ej.id AND es.source_revision<>COALESCE(ec.revision,0))`
export const jobFence=`${scopeFence} AND ${revisionFence}`
export const custody='Downloaded exports are in your custody. Membership removal and erasure stop future server reads, but cannot recall copies already downloaded. Store them privately and apply your organization’s retention rules.'
export const omissions=[
 {code:'scope',reason:'Only conversations readable by the requesting member when this job started are included. Organization-wide and other people’s private conversations require separate controlled compliance authority; this door grants none.'},
 {code:'credentials',reason:'Installation-local credentials, sessions, sign-in links, provider tokens, push endpoints and encryption keys are excluded.'},
 {code:'held-data',reason:'Protected legal-hold copies are not available through ordinary membership export. No hold inventory or compliance access is implied.'},
 {code:'personal-state',reason:'Other people’s drafts, reads, notifications, saved items, reminders, schedules and private preferences are excluded. This format exports conversation history, not an operational backup.'},
 {code:'unattached-files',reason:'Staged/reserved uploads, expired unattached files and scheduled-message templates have no posted conversation context and are excluded. Only attached conversation files and their structural deletion tombstones are indexed.'},
 {code:'directory',reason:'Only participant display names and source identity mappings referenced in the selected conversations are included. Directory emails, custom profile values, statuses and presence are excluded.'},
 {code:'external-artifacts',reason:'Unsupported external artifacts and unavailable source file references are named on their imported message. External URLs are references only; Nook never fetches them during export.'},
 {code:'future-features',reason:'Workflow/app definitions and agent run history are not implemented in this Nook release and have no records to export. Integration credentials and raw source archives are excluded.'},
 {code:'membership-before-adoption',reason:'Membership history starts with an explicit current-membership baseline at migration. Earlier native membership events are retained, but their add/remove direction and time were not recorded and are not guessed. Imported membership history is limited to the source channel record.'},
 {code:'unrecorded-history',reason:'Erased bodies, erased revisions and erased file bytes are absent. Imported message history and reactions contain only the revisions and source sets Nook actually received; missing earlier source versions are not reconstructed. Native reaction removals have event positions but no retained emoji payload.'},
 {code:'configuration',reason:'Included configuration is conversation topic/archive/manager, posting policy, pins and requester identity-free workspace scope. Installation authentication/domain/mail/provider policy is excluded from member exports.'},
]
