import type {StorageBindings} from '../../platform/storage/context'
/** A durable uncertain put is never timed out: paused reconciliation owns it. */
export async function drainBlobs(env:Pick<StorageBindings,'DB'|'FILES'>,operation?:string){
 const rows=(await env.DB.prepare(`SELECT operation,object_key FROM nook_erasure_blobs ${operation?'WHERE operation=?':''} LIMIT 100`).bind(...(operation?[operation]:[])).all<{operation:string;object_key:string}>()).results
 for(const row of rows){
  if(await env.DB.prepare('SELECT 1 FROM nook_upload_attempts WHERE object_key=? UNION ALL SELECT 1 FROM nook_attachments WHERE object_key=? LIMIT 1').bind(row.object_key,row.object_key).first())continue
  try{await env.FILES.delete(row.object_key);if(await env.FILES.head(row.object_key))continue
   await env.DB.batch([env.DB.prepare('DELETE FROM nook_object_deletes WHERE object_key=?').bind(row.object_key),env.DB.prepare('DELETE FROM nook_erasure_blobs WHERE object_key=?').bind(row.object_key)])
  }catch{/* The pending receipt and durable key are the retry obligation. */}
 }
 await env.DB.prepare("DELETE FROM nook_erasure_work WHERE phase='blobs' AND NOT EXISTS(SELECT 1 FROM nook_erasure_blobs b WHERE b.operation=nook_erasure_work.operation)").run()
 await env.DB.prepare("UPDATE nook_erasure_receipts SET state='complete',completed=? WHERE state='pending' AND NOT EXISTS(SELECT 1 FROM nook_erasure_work w WHERE w.operation=nook_erasure_receipts.id) AND NOT EXISTS(SELECT 1 FROM nook_erasure_blobs b WHERE b.operation=nook_erasure_receipts.id)").bind(Date.now()).run()
}
