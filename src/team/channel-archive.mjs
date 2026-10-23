import {validateWorkspaceChannelPolicy} from './workspace-policy-archive.mjs';
const check=(value,code)=>{if(!value)throw Error(code)};
const tuple=(...parts)=>JSON.stringify(parts);
const fields=(row,names)=>Object.keys(row).sort().join()===names.sort().join();

// Lifecycle rows are additive: older archives supply empty tables. Current
// rows must retain their exact body-free shape and their durable event links.
export async function validateChannelArchive(read,{conversations,actors,events}){
 await validateWorkspaceChannelPolicy(read);
 const settings=await read('nook_channel_settings'),actions=await read('nook_channel_actions');
 const channels=new Map(conversations.map(c=>[c.id,c])),people=new Map(actors.map(a=>[a.id,a])),eventIndex=new Map(events.map(e=>[tuple(e.conversation,e.seq),e]));
 const state=new Map(),byId=new Map(),versions=new Set(),sequences=new Set(),history=new Map();
 for(const row of settings){
  check(fields(row,['conversation','manager','topic','archived'])&&channels.has(row.conversation)&&channels.get(row.conversation).kind!=='dm'&&!state.has(row.conversation)&&typeof row.topic==='string'&&row.topic.length<=500&&row.topic.trim()===row.topic&&[0,1].includes(row.archived)&&(row.manager===null||people.has(row.manager)&&!people.get(row.manager).erased),'invalid_channel_settings');
  state.set(row.conversation,row);
 }
 for(const row of actions){
  const channel=channels.get(row.conversation),event=eventIndex.get(tuple(row.conversation,row.sequence)),key=tuple(row.conversation,row.version),sequence=tuple(row.conversation,row.sequence);
  check(fields(row,['id','conversation','version','sequence','action','actor','subject','created'])&&typeof row.id==='string'&&row.id.length>0&&!byId.has(row.id)&&channel&&channel.kind!=='dm'&&Number.isSafeInteger(row.version)&&row.version>=2&&row.version<=channel.version&&!versions.has(key)&&Number.isSafeInteger(row.sequence)&&row.sequence>0&&!sequences.has(sequence)&&['update','transfer','archive','restore','leave','vacate'].includes(row.action)&&typeof row.created==='string'&&Number.isFinite(Date.parse(row.created))&&(row.actor===null||people.has(row.actor)&&!people.get(row.actor).erased)&&(row.subject===null||people.has(row.subject)&&!people.get(row.subject).erased),'invalid_channel_action');
  check(event&&(event.kind==='channel'&&event.object===row.id&&event.actor===row.actor||event.kind==='erasure'&&event.actor===null&&row.actor===null),'invalid_channel_action_event');
  check(row.action==='transfer'||row.subject===null,'invalid_channel_action_subject');
  const channelHistory=history.get(row.conversation)??[];channelHistory.push(row);history.set(row.conversation,channelHistory);
  byId.set(row.id,row);versions.add(key);sequences.add(sequence);
 }
 for(const channel of conversations){
  if(channel.kind==='dm')continue;
  let manager=people.get(channel.owner)?.erased?null:channel.owner,archived=0;
  for(const action of (history.get(channel.id)??[]).sort((a,b)=>a.version-b.version)){
   if(action.action==='transfer')manager=action.subject;
   if(action.action==='vacate'||action.action==='leave'&&action.actor===manager)manager=null;
   if(action.action==='archive')archived=1;
   if(action.action==='restore')archived=0;
  }
  const setting=state.get(channel.id);
  // Archives before this additive table may retain only an erased creator's
  // opaque position. It confers no current management or membership.
  check((setting?setting.manager:people.get(channel.owner)?.erased?null:channel.owner)===manager,'channel_manager_state_mismatch');
  check((setting?.archived??0)===archived,'channel_archive_state_mismatch');
 }
 for(const event of events)if(event.kind==='channel')check(byId.get(event.object)?.conversation===event.conversation&&byId.get(event.object).sequence===event.seq,'orphan_channel_event');
 return byId;
}
