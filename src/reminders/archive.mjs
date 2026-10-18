import {validateScheduleTime,occurrenceAt} from '../scheduled/time.mjs';
const check=(value,code)=>{if(!value)throw Error(code)};
export async function validateReminders(read,manifest,actors,conversations,messages){
 const added=name=>manifest?.tables&&!manifest.tables.some(t=>t.name===name)?[]:read(name);
 const [reminders,occurrences]=await Promise.all(['nook_reminders','nook_reminder_occurrences'].map(added)),ids=new Map(),intents=new Set();
 for(const r of reminders){
  const key=JSON.stringify([r.user,r.intent]);
  check(typeof r.id==='string'&&r.id.length>0&&!ids.has(r.id)&&actors.has(r.user)&&actors.has(r.recipient)&&!actors.get(r.user).erased&&!actors.get(r.recipient).erased&&(r.conversation===null||conversations.has(r.conversation))&&typeof r.text==='string'&&r.text.trim()===r.text&&r.text.length>0&&r.text.length<=8000&&typeof r.intent==='string'&&r.intent.length>0&&r.intent.length<=128&&!intents.has(key)&&typeof r.definition==='string'&&r.definition.length<65536&&['pending','ready','done','cancelled','failed','paused'].includes(r.state)&&(r.schedule===null||r.schedule===r.id&&r.conversation!==null)&&Number.isSafeInteger(r.next_due)&&r.next_due>=0&&Number.isSafeInteger(r.version)&&r.version>0&&Number.isSafeInteger(r.operator_version)&&r.operator_version>0&&Number.isSafeInteger(r.access_generation)&&r.access_generation>0&&Number.isSafeInteger(r.created)&&Number.isSafeInteger(r.updated)&&r.updated>=r.created&&(r.reason===null||typeof r.reason==='string'&&r.reason.length<=500)&&(r.source===null?r.source_kind===null:r.conversation!==null&&typeof r.source==='string'&&['message','attachment'].includes(r.source_kind)),'invalid_reminder');
  try{validateScheduleTime({localAt:r.local_at,zone:r.zone,recurrence:r.recurrence});check(Math.abs(occurrenceAt(r.local_at,r.zone)-r.next_due)<60000,'invalid_reminder_due')}catch{check(false,'invalid_reminder_time')}
  ids.set(r.id,r);intents.add(key);
 }
 const keys=new Set();for(const o of occurrences){const key=JSON.stringify([o.reminder,o.due]),r=ids.get(o.reminder);check(r&&!keys.has(key)&&Number.isSafeInteger(o.due)&&o.due>=0&&Number.isSafeInteger(o.completed)&&o.completed>=0&&['delivered','failed','done'].includes(o.state)&&(o.message===null||messages.get(o.message)?.conversation===r.conversation),'invalid_reminder_occurrence');keys.add(key)}
}
