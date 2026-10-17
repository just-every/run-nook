const check=(value,code)=>{if(!value)throw Error(code)};
const fields=(row,names)=>Object.keys(row).sort().join()===names.slice().sort().join();
const id=value=>typeof value==='string'&&value.length>0&&value.length<=128&&value.trim()===value&&!/[\u0000-\u001f\u007f]/.test(value);
const time=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const sequence=value=>Number.isSafeInteger(value)&&value>0;
function url(value){
 if(typeof value!=='string'||!value.length||value.length>2048||/[\u0000-\u0020\u007f]/.test(value))return false;
 try{const parsed=new URL(value);return ['http:','https:'].includes(parsed.protocol)&&!parsed.username&&!parsed.password&&!!parsed.hostname&&parsed.href===value}catch{return false}
}

/** Structural references intentionally survive source erasure and import undo.
 * Archive admission validates known bindings without requiring a live source or
 * current membership. Only the current read projection can hydrate a source. */
export async function validateSavedArchive(read,{manifest,actors,conversations,messages,imported,attachments}){
 const archived=manifest?.tables?new Set(manifest.tables.map(table=>table.name)):null;
 const rows=async name=>{
  if(archived&&!archived.has(name))return [];
  const result=await read(name);check(Array.isArray(result),'invalid_collection_table');return result;
 };
 const [saves,pins]=await Promise.all([rows('nook_saved_items'),rows('nook_channel_pins')]);
 const liveActor=value=>id(value)&&actors.has(value)&&!actors.get(value).erased;
 const binding=(target,conversation,map)=>!map.has(target)||map.get(target).conversation===conversation;
 const messageBinding=(target,conversation)=>binding(target,conversation,messages)&&binding(target,conversation,imported);
 const unique=(rows,key,code)=>{const keys=new Set();for(const row of rows){const k=key(row);check(!keys.has(k),code);keys.add(k)}};
 for(const row of saves){
  check(fields(row,['seq','id','user','conversation','kind','target','created'])&&sequence(row.seq)&&id(row.id)&&liveActor(row.user)&&id(row.conversation)&&time(row.created)&&['message','attachment','link'].includes(row.kind),'invalid_saved_item');
  check(row.kind==='link'?url(row.target):id(row.target),'invalid_saved_target');
  if(row.kind==='message')check(messageBinding(row.target,row.conversation),'invalid_saved_message_scope');
  if(row.kind==='attachment')check(binding(row.target,row.conversation,attachments),'invalid_saved_file_scope');
 }
 for(const row of pins){
  check(fields(row,['seq','id','conversation','message','actor','created'])&&sequence(row.seq)&&id(row.id)&&id(row.conversation)&&id(row.message)&&time(row.created)&&(row.actor===null||liveActor(row.actor)),'invalid_channel_pin');
  const conversation=conversations.get(row.conversation);
  check((!conversation||['channel','private'].includes(conversation.kind))&&messageBinding(row.message,row.conversation),'invalid_pin_scope');
 }
 for(const [rows,name] of [[saves,'saved'],[pins,'pin']]){
  unique(rows,row=>row.seq,'duplicate_'+name+'_sequence');unique(rows,row=>row.id,'duplicate_'+name+'_id');
 }
 unique(saves,row=>JSON.stringify([row.user,row.conversation,row.kind,row.target]),'duplicate_saved_target');
 unique(pins,row=>JSON.stringify([row.conversation,row.message]),'duplicate_pin_target');
}
