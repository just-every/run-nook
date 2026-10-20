const columns=['id','user','conversation','device','device_name','reason','state','error','created','updated','held_at','released_at'];
const text=(value,max=256)=>typeof value==='string'&&value.length>0&&value.length<=max;
const time=value=>Number.isSafeInteger(value)&&value>=0;
/** NOOK-073 routing records are body-free and belong to a current person.
 * Archives predating the additive table carry none; never invent history. */
export async function validateDeliveryArchive(read,manifest,actors,conversations){
 if(manifest?.tables&&!manifest.tables.some(t=>t.name==='nook_push_delivery_records'))return;
 const seen=new Set();
 for(const row of await read('nook_push_delivery_records')){
  const valid=Object.keys(row).length===columns.length&&columns.every(key=>key in row)&&text(row.id)&&!seen.has(row.id)&&actors.has(row.user)&&!actors.get(row.user).erased&&conversations.has(row.conversation)
   &&text(row.device)&&text(row.device_name,80)&&text(row.reason,64)&&['pending','sending','retrying','sent','folded','failed','cancelled'].includes(row.state)&&(row.error===null||text(row.error,1024))
   &&time(row.created)&&time(row.updated)&&(row.held_at===null||time(row.held_at))&&(row.released_at===null||time(row.released_at))&&(row.state==='cancelled'||row.held_at!==null);
  if(!valid)throw Error('invalid_device_delivery_record');
  seen.add(row.id);
 }
}
