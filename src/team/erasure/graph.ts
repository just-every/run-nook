/** Product graph in erasure-1's declaration shape; hooks handle ordered history. */
const userEdge=(table:string,key:string[],column='user')=>({table,key,from:'nook_actors',on:{[column]:'id'},phase:'identity' as const})
const messageEdge=(table:string,key:string[])=>({table,key,from:'nook_messages',on:{message:'id'}})
export const retained = [
 {table:'nook_retained_message_bodies',reason:'Only the explicit retain source policy keeps current native bodies as Former member. Text can contain names; revisions and files are erased.'},
 {table:'nook_retained_import_bodies',reason:'Only the explicit retain source policy keeps associated imported bodies as Former member. Original source records, profiles and raw ZIPs are erased.'},
 {table:'nook_erased_messages',reason:'Content-free positions preserve thread URLs and unread counters; live row keys are absent and fenced.'},
 {table:'nook_erased_attachments',reason:'Content-free file positions preserve ordered historical bindings; no bytes or filenames survive.'},
 {table:'nook_erased_actors',reason:'An opaque structural ID preserves fixed DM rosters and immutable import ownership; it carries no name, mailbox or credential.'},
 {table:'nook_erased_assignees',reason:'Marks an absent assignee without retaining a person reference; existing commitment state remains unchanged.'},
 {table:'nook_erased_outcome_actions',reason:'Other authors’ commitment text and accepted state remain, with the erased assignee’s action attribution removed.'},
 {table:'nook_erased_import_messages',reason:'Empty thread positions retain timestamp ordering without source author, source payload, or files.'},
 {table:'nook_erased_outcomes',reason:'Only scope, kind, version count and state survive; erasure never accepts or completes work.'},
 {table:'nook_author_counts',reason:'Anonymous historical counts preserve other participants’ unread and read frontiers.'},
 {table:'nook_dm_roster',reason:'Opaque participant positions preserve the original fixed DM audience without granting access.'},
 {table:'nook_conversations',reason:'Other people retain their conversation, its ordering and historical creator position.'},
 {table:'rer_portability_journal',reason:'Opaque row-key hashes prevent old archives restoring erased records.'},
 {table:'nook_erasure_receipts',reason:'Random receipt ID, counts and times prove progress without a subject mapping.'},
 {table:'nook_erasure_work',reason:'Excluded transient references and authority survive interruption, then are deleted before completion.'},
 {table:'nook_erasure_blobs',reason:'Excluded transient object keys remain until absence is verified, including uncertain in-flight puts.'},
 {table:'oa_limits',reason:'Shared rate counters contain only secret-keyed hashes, time windows and counts. They have no subject mapping and retain rate-limit protection.'},
]
export const graph={
 member:{root:{table:'nook_actors',key:['id']},edges:[
  {table:'nook_messages',key:['id'],from:'nook_actors',on:{author:'id'},hook:'messages'},
  {table:'nook_attachments',key:['id'],from:'nook_actors',on:{author:'id'},blob:{bucket:'FILES',keyColumn:'object_key'},hook:'files'},
  {table:'nook_outcomes',key:['id'],from:'nook_actors',on:{author:'id'},hook:'outcomes'},
  {table:'nook_import_actors',key:['job','source_id'],from:'nook_actors',on:{association:'id'},hook:'importedStep'},
  {table:'nook_outcomes',key:['id'],from:'nook_actors',on:{assignee:'id'},hook:'detachAssignee'},
  userEdge('nook_reads',['conversation','user']),userEdge('nook_preferences',['user','conversation']),userEdge('nook_thread_follows',['user','message']),userEdge('nook_thread_unfollows',['user','message']),userEdge('nook_thread_reads',['user','message']),userEdge('nook_settings',['user']),userEdge('nook_attention',['id']),userEdge('nook_notify_preferences',['user']),userEdge('nook_push_presence',['page']),userEdge('nook_push_devices',['id']),userEdge('nook_notify_queue',['id']),userEdge('nook_notify_queue',['id'],'actor'),userEdge('nook_reactions',['message','user','emoji']),
  userEdge('oa_step_up_challenges',['id'],'operator_id'),userEdge('oa_sessions',['id'],'operator_id'),
  {table:'oa_tokens',key:['id'],from:'nook_actors',where:'operator_id=? OR issuer_id=?',params:['id','id'],phase:'identity'},
  userEdge('oa_external_identities',['issuer','subject'],'operator_id'),userEdge('oa_invitation_cancellations',['operator_id'],'operator_id'),
 ],redact:[{table:'nook_channel_settings',from:'nook_actors',on:{manager:'id'},set:{manager:null},reason:'A removed identity cannot remain the channel manager.'},{table:'nook_channel_actions',from:'nook_actors',on:{actor:'id'},set:{actor:null},reason:'Keep body-free lifecycle facts without personal attribution.'},{table:'nook_channel_actions',from:'nook_actors',on:{subject:'id'},set:{subject:null},reason:'Remove transfer target attribution from lifecycle history.'},{table:'oa_domain_rules',from:'nook_actors',on:{created_by:'id'},set:{created_by:null},reason:'Keep workspace sign-in policy without personal creator attribution.'}],audit:[{table:'nook_events',reference:'actor',clear:['object'],reason:'Both attribution and subject object become independent of historical actor IDs.'}],retain:retained,statements:'identity.ts and imported.ts implement product identity and custody hooks'},
 message:{root:{table:'nook_messages',key:['id']},edges:[messageEdge('nook_revisions',['message','version']),messageEdge('nook_reactions',['message','user','emoji']),messageEdge('nook_thread_follows',['user','message']),messageEdge('nook_thread_unfollows',['user','message']),messageEdge('nook_thread_reads',['user','message']),messageEdge('nook_attention',['id']),messageEdge('nook_notify_queue',['id'])],unlink:[{table:'nook_outcomes',from:'nook_messages',on:{source:'id'},set:{source:null},reason:'An outcome must not quote an erased source.'}],retain:retained,statements:'statements.ts moves content-free structural history and atomically fences original keys'},
 'imported-author':{root:{table:'nook_import_actors',key:['job','source_id']},edges:[{table:'nook_import_records',key:['id'],from:'nook_import_actors',on:{job:'job',source_actor:'source_id'},hook:'importedStep'}],retain:retained,statements:'imported.ts and import-commit.ts compose public kit erasure with native statements'},
 'imported-message':{root:{table:'nook_import_records',key:['id']},edges:[{table:'nook_import_files',key:['attachment'],from:'nook_import_records',on:{message:'id'},hook:'importedStep'},...['nook_thread_follows','nook_thread_unfollows','nook_thread_reads'].map(table=>({table,key:['user','message'],from:'nook_import_records',on:{message:'id'}}))],retain:retained,statements:'importedStep removes source copies through public kit custody before retaining a content-free thread position'},
 attachment:{root:{table:'nook_attachments',key:['id']},edges:[],blob:{bucket:'FILES',keyColumn:'object_key'},retain:retained,statements:'statements.ts publishes durable object obligations before R2 deletion; expired-files.mjs uses the same public fence during explicitly paused expiry maintenance'},
} as const
export const confirmation='ERASE'
