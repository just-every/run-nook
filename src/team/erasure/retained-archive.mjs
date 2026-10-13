/** Validate retained content separately: sanitized tombstones stay strictly empty. */
export async function validateRetainedBodies(read){
 for(const [bodies,tombstones,live] of [['nook_retained_message_bodies','nook_erased_messages','nook_messages'],['nook_retained_import_bodies','nook_erased_import_messages','nook_import_records']]){
  const marks=new Set((await read(tombstones)).map(row=>row.id)),liveIds=new Set((await read(live)).map(row=>row.id)),seen=new Set();
  for(const row of await read(bodies)){
   if(typeof row.id!=='string'||seen.has(row.id)||!marks.has(row.id)||liveIds.has(row.id)||typeof row.body!=='string'||row.body_lower!==row.body.toLowerCase())throw Error('invalid_retained_message_body');
   seen.add(row.id);
  }
 }
}
