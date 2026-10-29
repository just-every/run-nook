import {agentExcludedTables} from '../../agent-door/archive.mjs';
import {portableDigestSchedule,portableDigestDelivery} from '../../digests/archive.mjs';
import {portableSchedule} from '../../scheduled/archive.mjs';
import {notificationExcludedTables} from '../../notification-apps/archive.mjs';
import {readableExportExcludedTables} from '../../exit/archive.mjs';
import {slackExportRow} from '../../imports/archive-objects.mjs';
import {teamExcludedTables} from '../../team/portability.mjs';
import {integrationExcludedTables} from '../../integrations/archive.mjs';
import {validateNormalizedArchive} from './archive-validation.mjs';
// Offline Base portability hooks. Stable product actors are exported separately
// from Base credentials. FTS is derived and rebuilt after a successful restore.
export const normalizedPortability={
 derivedTables:['nook_search'],
 // Door history is portable; restored bytes never opt a destination into signed grants.
 importSafety:{nook_digest_schedules:{enabled:[0]},nook_ai_settings:{enabled:[0]},nook_transcript_settings:{enabled:[0]},ik_door_settings:{enabled:[0]},nook_notification_apps:{state:['reissue'],ended:[null]}},
 importRow(table,row){if(table==='nook_digest_schedules')return portableDigestSchedule(row);if(table==='nook_digest_deliveries')return portableDigestDelivery(row);if(table==='nook_schedules')return portableSchedule(row);if(table==='nook_ai_settings'||table==='nook_transcript_settings')return {...row,enabled:0};if(table==='nook_notification_apps')return {...row,state:'reissue',ended:null};if(table==='nook_quiet_schedules')return {...row,quiet_until:0,next_change:0};return table==='ik_door_settings'?{...row,enabled:0}:row;},
 // The notification queue is delivery state: a restored installation sends nothing old.
 excludeTables:[...agentExcludedTables,'nook_multipart_uploads','nook_multipart_parts','nook_poll_votes','nook_transcript_secrets','nook_transcript_calls','nook_ai_secrets','nook_ai_calls',...notificationExcludedTables,'nook_audit_context',...readableExportExcludedTables,'nook_typing','nook_broadcast_presence','nook_read_undo','nook_read_generations','nook_guard','nook_conversion','nook_erasure_work','nook_erasure_blobs','nook_notify_queue','nook_push_devices','nook_push_presence','nook_push_secrets',...teamExcludedTables,...integrationExcludedTables],
 buckets:{FILES:{prefix:'private/',objectReferences:{table:'nook_object_inventory',keyColumn:'object_key'}}},
 exportRow(table,row){
  // A backup carries aggregate poll results, never sealed voter custody. Restored snapshots are closed.
  if(table==='nook_polls')return {...row,closed_at:row.closed_at??row.created};
  if(table==='nook_digest_schedules')return portableDigestSchedule(row);if(table==='nook_digest_deliveries')return portableDigestDelivery(row);
  if(table==='nook_ai_settings'||table==='nook_transcript_settings')return {...row,enabled:0};
  if(table==='nook_notification_apps')return {...row,state:row.state==='active'?'reissue':row.state};
  if(table==='nook_erasure_receipts'&&row.state!=='complete')throw Error('finish_pending_erasure_before_export');
  if(table==='workspace')throw Error('normalize_storage_before_export');
  if(table==='nook_storage'&&(row.authority!=='normalized'||row.phase!=='ready'))throw Error('storage_not_ready');
  if(table==='nook_attachments'&&row.state==='reserved'||table==='nook_imports'&&row.state!=='complete'||table==='nook_object_deletes'||table==='nook_upload_attempts')throw Error('reconcile_pending_object_work_before_export');
  if(table==='nook_actors'&&row.role!=='app'&&(!row.email||!row.role))throw Error('offline_identity_recovery_required');
  if(table==='nook_reminders'&&row.state==='pending')return {...row,state:'paused',reason:'Restored reminder: review a future time before resuming'};
  if(table==='nook_schedules')return portableSchedule(row);
  return slackExportRow(table,row);
 },
 validateStaged:validateNormalizedArchive,
};
export async function rebuildSearch(db){await db.batch([db.prepare('DELETE FROM nook_search'),db.prepare("INSERT INTO nook_search(message,conversation,source,scope,body_lower) SELECT id,conversation,'native','|'||conversation||'|',body_lower FROM nook_messages WHERE deleted=0"),db.prepare("INSERT INTO nook_search(message,conversation,source,scope,body_lower) SELECT id,conversation,'imported','|'||conversation||'|',body_lower FROM nook_import_records"),db.prepare("INSERT INTO nook_search(message,conversation,source,scope,body_lower) SELECT b.id,m.conversation,'native','|'||m.conversation||'|',b.body_lower FROM nook_retained_message_bodies b JOIN nook_erased_messages m ON m.id=b.id"),db.prepare("INSERT INTO nook_search(message,conversation,source,scope,body_lower) SELECT b.id,m.conversation,'imported','|'||m.conversation||'|',b.body_lower FROM nook_retained_import_bodies b JOIN nook_erased_import_messages m ON m.id=b.id")])}
