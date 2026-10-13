import {erasedIntent} from './intent.mjs';
import {createPortability} from '../../base/modules/portability/index.mjs';
import {portabilityPolicy} from '../../platform/portability-policy.mjs';
/** Offline, explicitly paused maintenance shares the same public file fence. */
export async function discardExpiredFiles(env){
 const db=env.DB,service=await createPortability({db,buckets:{FILES:env.FILES},policy:portabilityPolicy});
 for(;;){
  const rows=(await db.prepare("SELECT id,object_key,author,intent FROM nook_attachments WHERE state IN ('reserved','staged') AND expires<=? AND NOT EXISTS(SELECT 1 FROM nook_import_files f WHERE f.attachment=nook_attachments.id) LIMIT 30").bind(Date.now()).all()).results;
  if(!rows.length)return;
  const statements=await service.invalidateTransfersStatements();
  for(const row of rows){statements.push(...await service.erasureStatements('nook_attachments',{id:row.id}));if(row.object_key)statements.push(db.prepare('INSERT OR IGNORE INTO nook_object_deletes(object_key,created) VALUES(?,?)').bind(row.object_key,Date.now()));statements.push(db.prepare('INSERT INTO nook_erased_attachments SELECT id,conversation,author,message,created,position,? FROM nook_attachments WHERE id=?').bind(await erasedIntent(row.author,row.intent),row.id),db.prepare('DELETE FROM nook_attachments WHERE id=?').bind(row.id))}
  await db.batch(statements);
 }
}
