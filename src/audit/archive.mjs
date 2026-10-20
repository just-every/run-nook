const columns=['id','actor','service','at','kind','scope','version','reason','outcome','count'];
/** Archives predating NOOK-051 use the additive migration/read model. Current
 * archives carry only this allow-listed record, never credentials or bodies. */
export async function validateAuditArchive(read,manifest,actors){
 if(manifest?.tables&&!manifest.tables.some(t=>t.name==='nook_audit'))return;
 const seen=new Set();
 for(const row of await read('nook_audit')){
  if(Object.keys(row).length!==columns.length||columns.some(key=>!(key in row))||typeof row.id!=='string'||seen.has(row.id)||row.actor!==null&&!actors.has(row.actor)||!['confirmed','failed','uncertain'].includes(row.outcome)||![row.at,row.version,row.count].every(Number.isSafeInteger)||row.at<0||row.version<1||row.count<0||!['service','kind','scope','reason'].every(key=>typeof row[key]==='string'&&row[key].length<=1024))throw Error('invalid_admin_audit');
  if(row.actor!==null&&actors.get(row.actor)?.erased)throw Error('attributed_erased_audit');
  seen.add(row.id);
 }
}
