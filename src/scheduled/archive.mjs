import {validateScheduleTime,occurrenceAt} from './time.mjs';
const check=(value,code)=>{if(!value)throw Error(code)};
const integer=value=>Number.isSafeInteger(value)&&value>=0;
const fields=(row,names)=>Object.keys(row).sort().join()===names.split(',').sort().join();
export async function validateSchedules(read,manifest,{actors,conversations,messages,attachments}){
 const added=name=>manifest?.tables&&!manifest.tables.some(t=>t.name===name)?[]:read(name);
 const [rows,occurrences,files]=await Promise.all(['nook_schedules','nook_schedule_occurrences','nook_schedule_files'].map(added)),schedules=new Map(),intents=new Set(),keys=new Set();
 for(const row of rows){
  check(fields(row,'id,user,conversation,intent,definition,payload,local_at,zone,recurrence,end_date,next_due,state,version,operator_version,access_generation,reason,created,updated')&&typeof row.id==='string'&&row.id.length>0&&!schedules.has(row.id)&&actors.has(row.user)&&!actors.get(row.user).erased&&conversations.has(row.conversation)&&typeof row.intent==='string'&&row.intent.length>0&&row.intent.length<=128&&!intents.has(JSON.stringify([row.user,row.intent]))&&integer(row.version)&&row.version>0&&integer(row.operator_version)&&row.operator_version>0&&integer(row.access_generation)&&row.access_generation>0&&integer(row.created)&&integer(row.updated)&&row.updated>=row.created&&['active','paused','cancelled','complete','failed','needs-review'].includes(row.state)&&(row.reason===null||typeof row.reason==='string'&&row.reason.length<=500),'invalid_scheduled_message');
  let payload,definition;try{payload=JSON.parse(row.payload);definition=JSON.parse(row.definition)}catch{check(false,'invalid_schedule_payload')}
  const validPayload=p=>p&&(fields(p,'body,parent,attachments,mentions,urgent,urgentReason')||fields(p,'body,parent,attachments,mentions,urgent,urgentReason,confirmBroadcast')&&typeof p.confirmBroadcast==='boolean')&&typeof p.body==='string'&&p.body.trim()===p.body&&p.body.length>0&&p.body.length<=40000&&(p.parent===null||typeof p.parent==='string')&&Array.isArray(p.attachments)&&p.attachments.length<=5&&new Set(p.attachments).size===p.attachments.length&&p.attachments.every(id=>typeof id==='string')&&Array.isArray(p.mentions)&&p.mentions.length<=50&&new Set(p.mentions).size===p.mentions.length&&p.mentions.every(id=>actors.has(id))&&typeof p.urgent==='boolean'&&(p.urgent?p.mentions.length>0&&typeof p.urgentReason==='string'&&p.urgentReason.length>0&&p.urgentReason.length<=240:p.urgentReason===null);
  check(validPayload(payload)&&definition&&validPayload(definition.payload),'invalid_schedule_payload');
  try{validateScheduleTime({...definition});const time=validateScheduleTime({localAt:row.local_at,zone:row.zone,recurrence:row.recurrence,endDate:row.end_date});check(integer(row.next_due)&&occurrenceAt(time.localAt,time.zone)===row.next_due,'invalid_schedule_due')}catch{check(false,'invalid_schedule_time')}
  schedules.set(row.id,row);intents.add(JSON.stringify([row.user,row.intent]));
 }
 const custody=(await Promise.all(['nook_import_uploads','nook_import_objects'].map(read))).flat().filter(row=>row.state==='ready');
 const seenFiles=new Set(),objects=new Set([...attachments.values(),...custody].map(f=>f.object_key).filter(Boolean)),positions=new Set();
 for(const file of files){const schedule=schedules.get(file.schedule),original=attachments.get(file.attachment),position=JSON.stringify([file.schedule,file.position]);
  check(fields(file,'schedule,attachment,position,name,mime,size,sha256,object_key')&&schedule&&original?.state==='deleted'&&!original.erased&&original.author===schedule.user&&original.conversation===schedule.conversation&&!['cancelled','complete'].includes(schedule.state)&&typeof file.attachment==='string'&&!seenFiles.has(file.attachment)&&!positions.has(position)&&integer(file.position)&&file.position<5&&JSON.parse(schedule.payload).attachments[file.position]===file.attachment&&typeof file.name==='string'&&file.name.trim()===file.name&&file.name.length>0&&file.name.length<=120&&!/[\x00-\x1f\x7f/\\<>:"|?*]/.test(file.name)&&['text/plain','image/png','image/jpeg','application/pdf'].includes(file.mime)&&integer(file.size)&&file.size>0&&file.size<=25*1024*1024&&/^[a-f0-9]{64}$/.test(file.sha256)&&typeof file.object_key==='string'&&file.object_key.startsWith('private/')&&!objects.has(file.object_key),'invalid_schedule_file');
  seenFiles.add(file.attachment);objects.add(file.object_key);positions.add(position);
 }
 for(const schedule of schedules.values())check(JSON.parse(schedule.payload).attachments.length===files.filter(f=>f.schedule===schedule.id).length,'missing_schedule_file');
 for(const row of occurrences){
  const schedule=schedules.get(row.schedule),key=JSON.stringify([row.schedule,row.local_at,row.version]),message=messages.get(row.message);
  check(fields(row,'schedule,local_at,version,due,zone,message,state,reason,completed')&&schedule&&!keys.has(key)&&integer(row.version)&&row.version>0&&row.version<=schedule.version&&integer(row.due)&&integer(row.completed)&&['sent','failed','needs-review'].includes(row.state)&&(row.reason===null||typeof row.reason==='string'&&row.reason.length<=500),'invalid_schedule_occurrence');
  try{check(occurrenceAt(row.local_at,row.zone)===row.due,'invalid_schedule_occurrence_due')}catch{check(false,'invalid_schedule_occurrence_due')}
  check(row.state==='sent'?message?.conversation===schedule.conversation&&message.author===schedule.user&&(message.erased||message.intent==='scheduled:'+schedule.id+':'+row.version+':'+row.local_at):row.message===null&&typeof row.reason==='string','invalid_schedule_message_binding');
  keys.add(key);
 }
 return files;
}
