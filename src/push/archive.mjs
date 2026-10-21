const columns=['id','user','conversation','device','device_name','reason','state','error','created','updated','held_at','released_at','message','outcome','attention','actor','source_version','holds','legacy'];
const text=(value,max=256)=>typeof value==='string'&&value.length>0&&value.length<=max;
const time=value=>Number.isSafeInteger(value)&&value>=0;
const kinds=new Set(['activity','mobile-delay','quiet-schedule','quiet-snooze','item-snooze']);
/** Routing history never grants delivery authority. Pre-source-key archives must
 * be upgraded at their original installation and exported again: archive rows
 * alone cannot recover a causing actor or an unrecorded hold interval. */
export async function validateDeliveryArchive(read,manifest,actors,conversations){
 if(manifest?.tables&&!manifest.tables.some(t=>t.name==='nook_push_delivery_records'))return;
 const rows=await read('nook_push_delivery_records');if(!rows.length)return;
 const messages=new Map((await read('nook_messages')).map(r=>[r.id,r])),outcomes=new Map((await read('nook_outcomes')).map(r=>[r.id,r]));
 const versions=new Map((await read('nook_outcome_versions')).map(r=>[r.outcome+'.'+r.version,r]));
 const seen=new Set();
 for(const row of rows){
  if(!columns.every(key=>key in row))throw Error('ambiguous_legacy_device_delivery_record');
  const message=messages.get(row.message),outcome=outcomes.get(row.outcome),version=versions.get(row.outcome+'.'+row.source_version);
  const valid=Object.keys(row).length===columns.length&&text(row.id)&&!seen.has(row.id)&&actors.has(row.user)&&!actors.get(row.user).erased&&conversations.has(row.conversation)
   &&actors.has(row.actor)&&!actors.get(row.actor).erased
   &&(row.message!==null&&row.outcome===null&&row.source_version===null&&message&&!message.erased&&message.author===row.actor&&message.conversation===row.conversation&&row.id===`push:${row.message}:${row.user}:${row.device}`
    ||row.message===null&&row.outcome!==null&&outcome&&!outcome.erased&&outcome.conversation===row.conversation&&version&&!version.erasedAction&&version.actor===row.actor&&row.attention===`${row.outcome}.${row.source_version}.${row.user}`&&row.id===`push:${row.attention}:${row.device}`)
   &&text(row.device)&&text(row.device_name,80)&&text(row.reason,64)&&['pending','sending','retrying','sent','folded','failed','cancelled'].includes(row.state)&&(row.error===null||text(row.error,1024))
   &&time(row.created)&&time(row.updated)&&(row.held_at===null||time(row.held_at))&&(row.released_at===null||time(row.released_at))&&[0,1].includes(row.legacy);
  if(!valid)throw Error('invalid_device_delivery_record');
  let holds;try{holds=JSON.parse(row.holds)}catch{throw Error('invalid_device_delivery_holds')}
  if(!Array.isArray(holds)||!holds.every(h=>h!==null&&typeof h==='object'&&!Array.isArray(h)&&Object.keys(h).sort().join(',')==='kind,release,start'&&(kinds.has(h.kind)||row.legacy===1&&h.kind==='legacy-activity-or-mobile-delay')&&time(h.start)&&(h.release===null||time(h.release)&&h.release>=h.start))||row.state!=='cancelled'&&!holds.length)throw Error('invalid_device_delivery_holds');
  seen.add(row.id);
 }
}
