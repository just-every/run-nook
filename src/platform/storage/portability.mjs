import {readableExportExcludedTables} from '../../exit/archive.mjs';
import {slackExportRow} from '../../imports/archive-objects.mjs';
import {teamExcludedTables} from '../../team/portability.mjs';
import {validateNormalizedArchive} from './archive-validation.mjs';
// Offline Base portability hooks. Stable product actors are exported separately
// from Base credentials. FTS is derived and rebuilt after a successful restore.
export const normalizedPortability={
 derivedTables:['nook_search'],
 // Door history is portable; restored bytes never opt a destination into signed grants.
 importSafety:{ik_door_settings:{enabled:[0]}},
 importRow(table,row){return table==='ik_door_settings'?{...row,enabled:0}:row;},
 // The notification queue is delivery state: a restored installation sends nothing old.
 excludeTables:[...readableExportExcludedTables,'nook_typing','nook_broadcast_presence','nook_read_undo','nook_read_generations','nook_guard','nook_conversion','nook_erasure_work','nook_erasure_blobs','nook_notify_queue','nook_push_devices','nook_push_presence','nook_push_secrets',...teamExcludedTables],
 buckets:{FILES:{prefix:'private/',objectReferences:{table:'nook_object_inventory',keyColumn:'object_key'}}},
 exportRow(table,row){
  if(table==='nook_erasure_receipts'&&row.state!=='complete')throw Error('finish_pending_erasure_before_export');
  if(table==='workspace')throw Error('normalize_storage_before_export');
  if(table==='nook_storage'&&(row.authority!=='normalized'||row.phase!=='ready'))throw Error('storage_not_ready');
  if(table==='nook_attachments'&&row.state==='reserved'||table==='nook_imports'&&row.state!=='complete'||table==='nook_object_deletes'||table==='nook_upload_attempts')throw Error('reconcile_pending_object_work_before_export');
  if(table==='nook_actors'&&(!row.email||!row.role))throw Error('offline_identity_recovery_required');
  if(table==='nook_reminders'&&row.state==='pending')return {...row,state:'paused',reason:'Restored reminder: review a future time before resuming'};
  if(table==='nook_schedules'&&row.state==='active')return {...row,state:'paused',reason:'Restored schedule: review a future time before resuming'};
  return slackExportRow(table,row);
 },
 validateStaged:validateNormalizedArchive,
};
export async function rebuildSearch(db){await db.batch([db.prepare('DELETE FROM nook_search'),db.prepare("INSERT INTO nook_search(message,conversation,source,scope,body_lower) SELECT id,conversation,'native','|'||conversation||'|',body_lower FROM nook_messages WHERE deleted=0"),db.prepare("INSERT INTO nook_search(message,conversation,source,scope,body_lower) SELECT id,conversation,'imported','|'||conversation||'|',body_lower FROM nook_import_records"),db.prepare("INSERT INTO nook_search(message,conversation,source,scope,body_lower) SELECT b.id,m.conversation,'native','|'||m.conversation||'|',b.body_lower FROM nook_retained_message_bodies b JOIN nook_erased_messages m ON m.id=b.id"),db.prepare("INSERT INTO nook_search(message,conversation,source,scope,body_lower) SELECT b.id,m.conversation,'imported','|'||m.conversation||'|',b.body_lower FROM nook_retained_import_bodies b JOIN nook_erased_import_messages m ON m.id=b.id")])}
