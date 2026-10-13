import {sql} from './statements'
/** Only already-committed physical deletion obligations are inherited. Unknown
 * older queue ownership is deliberately conservative, never guessed. */
export function inheritPriorBlobs(operation:string,target:string){return sql(`INSERT OR IGNORE INTO nook_erasure_blobs(operation,object_key)
 SELECT ?,object_key FROM nook_object_deletes WHERE erasure_author=? OR erasure_author IS NULL
 UNION SELECT ?,b.object_key FROM nook_erasure_blobs b JOIN nook_erasure_work w ON w.operation=b.operation WHERE w.author=? OR w.kind IN ('imported-message','imported-author')`,operation,target,operation,target)}
