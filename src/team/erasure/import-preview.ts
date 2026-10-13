import type {Context} from '../../platform/storage/context'
import type {fenceService,Sql} from './portability'
import {authorizeWork} from './authorization'
import {sql} from './statements'

/** A cancelled review may already own staged media and a native envelope.
 * Resolve job custody by its operation binding, including a lost create ack.
 * Callers commit these obligations with the upload withdrawal and authority. */
export function cancelUnappliedReviews(operation:string,upload:string):Sql[]{
 const unclaimed="NOT EXISTS(SELECT 1 FROM ik_jobs k WHERE k.operation_key=r.id AND k.principal_id=r.owner)"
 const prefix="'private/imports/'||r.owner||'/'||r.upload||'/files/'||r.domain_job||'/'||r.id||'/'"
 const staged=`upload=? AND EXISTS(SELECT 1 FROM nook_import_reviews r WHERE r.upload=nook_import_objects.upload AND r.owner=nook_import_objects.owner AND r.state='discarded' AND ${unclaimed} AND substr(nook_import_objects.object_key,1,length(${prefix}))=(${prefix})) AND NOT EXISTS(SELECT 1 FROM nook_attachments a WHERE a.object_key=nook_import_objects.object_key)`
 return [
  sql(`UPDATE nook_import_reviews AS r SET state='discarded' WHERE upload=? AND ${unclaimed}`,upload),
  sql(`INSERT OR IGNORE INTO nook_erasure_blobs SELECT ?,object_key FROM nook_import_objects WHERE ${staged}`,operation,upload),
  sql(`INSERT OR IGNORE INTO nook_object_deletes(object_key,created) SELECT object_key,? FROM nook_import_objects WHERE ${staged}`,Date.now(),upload),
  sql(`UPDATE nook_import_objects SET state='deleted' WHERE ${staged}`,upload),
  sql(`DELETE FROM nook_imports WHERE state='staging' AND EXISTS(SELECT 1 FROM nook_import_reviews r WHERE r.upload=? AND r.domain_job=nook_imports.id AND r.id=nook_imports.intent AND r.owner=nook_imports.owner AND r.state='discarded' AND ${unclaimed})`,upload)
 ]
}
/** No kit job exists yet. Cancel every sibling preview of the shared ZIP and
 * delete its staged files; no source data can subsequently become visible. */
export async function cancelPreview(c:Context,work:any,review:any,f:Awaited<ReturnType<typeof fenceService>>){
 const scope=await authorizeWork(c,work),uploads=await c.rows('SELECT * FROM nook_import_uploads WHERE id=?',[review.upload])
 const statements=[...await f.invalidate(),...await f.checkpoint(),...cancelUnappliedReviews(work.operation,review.upload)]
 for(const upload of uploads)statements.push(sql('INSERT OR IGNORE INTO nook_erasure_blobs VALUES(?,?)',work.operation,upload.object_key),sql('INSERT OR IGNORE INTO nook_object_deletes(object_key,created) VALUES(?,?)',upload.object_key,Date.now()),sql("UPDATE nook_import_uploads SET state='discarded' WHERE id=?",upload.id))
 await c.batch(statements.map(s=>c.sql(s.sql,...s.params)),scope.conversation,`(${scope.condition}) AND NOT EXISTS(SELECT 1 FROM ik_jobs WHERE operation_key=? AND principal_id=?)`,[...scope.params,review.id,review.owner])
}
