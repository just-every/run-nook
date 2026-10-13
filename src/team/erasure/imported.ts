import type {Context} from '../../platform/storage/context'
import {fenceService,type Sql} from './portability'
import {files,sql,fencedRows} from './statements'
import {eraseImportedTarget,personValues} from './import-commit'
import {importSelection,selectedImportBlobs} from './import-selection'
import {cancelPreview,cancelUnappliedReviews} from './import-preview'
export async function importedStep(c:Context,work:any,f:Awaited<ReturnType<typeof fenceService>>){
 const selection=await importSelection(c,work),{selected,actor,review}=selection
 if(!actor&&!selected)return false
 if(review&&!review.actual_job){await cancelPreview(c,work,review,f);return true}
 const job=await c.one('SELECT * FROM nook_imports WHERE id=?',[selected?.job??actor.job])??(review?{id:review.domain_job,owner:review.owner,namespace:review.namespace,state:review.state}:null),record=selected??await c.one('SELECT * FROM nook_import_records WHERE job=? AND source_actor=? LIMIT 1',[actor.job,actor.source_id]),statements:Sql[]=[...await f.invalidate(),...selectedImportBlobs(work,selection)]
 statements.push(...await fencedRows(c,f,'nook_import_receipts',['job','path','sha256'],'job=?',[job.id]),sql('DELETE FROM nook_import_receipts WHERE job=?',job.id))
 // Legacy source-receipt paths may themselves contain personal filenames.
 // The original ZIP is a copy of every selected author, so withdraw it whole.
 const uploads=await c.rows('SELECT u.* FROM nook_import_uploads u JOIN nook_import_reviews r ON r.upload=u.id WHERE r.domain_job=? AND u.state<>?', [job.id,'discarded'])
 // An unused sibling approval cannot retain usable custody after its shared ZIP
 // is withdrawn. A lost create acknowledgement still owns a Base receipt.
 for(const upload of uploads)statements.push(...cancelUnappliedReviews(work.operation,upload.id))
 for(const upload of uploads)statements.push(sql('INSERT OR IGNORE INTO nook_erasure_blobs VALUES(?,?)',work.operation,upload.object_key),sql('INSERT OR IGNORE INTO nook_object_deletes(object_key,created) VALUES(?,?)',upload.object_key,Date.now()),sql("INSERT OR IGNORE INTO nook_erasure_blobs SELECT operation,? FROM nook_erasure_work WHERE (kind='imported-author' AND target=?) OR (kind='imported-message' AND target=?)",upload.object_key,actor?actor.job+':'+actor.source_id:null,record?.id??null),sql("UPDATE nook_import_uploads SET state='discarded' WHERE id=?",upload.id))
 if(record){
  statements.push(...await f.row('nook_import_records',{id:record.id}),sql('INSERT INTO nook_guard VALUES(?,1)','undo:'+record.id),sql("UPDATE nook_import_objects SET state='deleted' WHERE object_key IN (SELECT object_key FROM nook_attachments WHERE message=?)",record.id),sql('DELETE FROM nook_import_files WHERE message=?',record.id),...await files(c,f,work.operation,'message=?',[record.id]),sql('DELETE FROM nook_guard WHERE id=?','undo:'+record.id),sql("DELETE FROM nook_search WHERE message=? AND source='imported'",record.id),sql('INSERT INTO nook_erased_import_messages VALUES(?,?,?,?,?,?)',record.id,record.job,record.conversation,record.parent,record.sequence,record.source_timestamp),sql('DELETE FROM nook_import_records WHERE id=?',record.id),sql("UPDATE nook_erasure_work SET phase='blobs' WHERE kind='imported-message' AND target=?",record.id),sql('DELETE FROM nook_import_effect_revisions WHERE destination=? AND kind=? AND id=?',job.owner,'message',record.id),sql("INSERT INTO nook_search(nook_search) VALUES('optimize')"))
  if(work.kind==='member'&&work.member_bodies==='retain'&&job.state==='complete')statements.push(sql("INSERT INTO nook_retained_import_bodies SELECT ?,?,? WHERE NOT EXISTS(SELECT 1 FROM nook_erasure_work WHERE (kind='imported-message' AND target=?) OR (kind='imported-author' AND target=?))",record.id,record.body,record.body_lower,record.id,record.job+':'+record.source_actor),sql("INSERT INTO nook_search(message,conversation,source,scope,body_lower) SELECT id,?,'imported',?,body_lower FROM nook_retained_import_bodies WHERE id=?",record.conversation,'|'+record.conversation+'|',record.id))
  statements.push(sql('UPDATE nook_conversations SET seq=seq+1 WHERE id=?',record.conversation),sql("INSERT INTO nook_events SELECT id,seq,'erasure',lower(hex(randomblob(16))),NULL FROM nook_conversations WHERE id=?",record.conversation))
  if(work.kind==='imported-message')statements.push(sql("UPDATE nook_erasure_work SET phase='blobs' WHERE operation=?",work.operation))
  await eraseImportedTarget(c,work,'message',record.id,job,statements,await personValues(c,work,actor),f)
 }else{
  statements.push(sql('INSERT INTO nook_guard VALUES(?,CASE WHEN NOT EXISTS(SELECT 1 FROM nook_import_records WHERE job=? AND source_actor=?) THEN 1 ELSE 0 END)','erase-actor:'+actor.job+':'+actor.source_id,actor.job,actor.source_id),sql('DELETE FROM nook_guard WHERE id=?','erase-actor:'+actor.job+':'+actor.source_id),...await f.row('nook_import_actors',{job:actor.job,source_id:actor.source_id}),sql('DELETE FROM nook_import_actors WHERE job=? AND source_id=?',actor.job,actor.source_id),sql("UPDATE nook_erasure_work SET phase='blobs' WHERE kind='imported-author' AND target=?",actor.job+':'+actor.source_id),sql('DELETE FROM nook_import_effect_revisions WHERE destination=? AND kind=? AND id=?',job.owner,'actor',actor.job+':'+actor.source_id))
  await eraseImportedTarget(c,work,'actor',actor.job+':'+actor.source_id,job,statements,await personValues(c,work,actor),f,{source:r=>r.kind==='message'&&(r.payload as any).job===actor.job&&(r.payload as any).sourceActor===actor.source_id})
 }
 return true
}
