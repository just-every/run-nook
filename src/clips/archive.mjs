import {validateCues} from './cues.mjs';
const check=(value,code)=>{if(!value)throw Error(code)};
const fields=(row,names)=>Object.keys(row).sort().join()===names.slice().sort().join();
const id=value=>typeof value==='string'&&value.length>0&&value.length<=128&&value.trim()===value&&!/[\u0000-\u001f\u007f]/.test(value);
const time=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const version=value=>Number.isSafeInteger(value)&&value>=1;
const mimes=['audio/webm','video/webm','audio/mp4','video/mp4','audio/ogg','audio/mpeg','audio/wav'];
/** Call with erasure-aware indexes after native files/messages/actors are
 * indexed. Pre-feature archives may omit both tables; partial schemas fail. */
export async function validateClipsArchive(read,{manifest,actors,conversations,messages,attachments,importedFiles}){
 const names=['nook_clips','nook_clip_transcripts'],present=manifest?.tables?new Set(manifest.tables.map(t=>t.name)):null;
 if(present&&!names.some(name=>present.has(name)))return new Map();
 check(!present||names.every(name=>present.has(name)),'incomplete_clip_schema');
 const [clips,history]=await Promise.all(names.map(read)),map=new Map(),groups=new Map(),seen=new Set();
 const supplied=importedFiles??new Set((await read('nook_import_files')).map(row=>row.attachment));
 for(const clip of clips){
  check(fields(clip,['attachment','message','conversation','version','created'])&&id(clip.attachment)&&id(clip.message)&&id(clip.conversation)&&!map.has(clip.attachment)&&version(clip.version)&&time(clip.created)&&conversations.has(clip.conversation),'invalid_clip');
  const source=messages.get(clip.message),file=attachments.get(clip.attachment);
  check(source&&!source.deleted&&!source.erased&&source.conversation===clip.conversation&&file&&file.state==='attached'&&!file.erased&&file.message===clip.message&&file.conversation===clip.conversation&&mimes.includes(file.mime)&&!supplied.has(clip.attachment),'invalid_clip_source');
  map.set(clip.attachment,clip);
 }
 for(const row of history){
  const clip=map.get(row.attachment),key=JSON.stringify([row.attachment,row.version]);
  check(fields(row,['attachment','message','conversation','version','actor','created','format','language','cues_json'])&&clip&&row.message===clip.message&&row.conversation===clip.conversation&&version(row.version)&&row.version<=clip.version&&!seen.has(key)&&time(row.created)&&['typed','webvtt'].includes(row.format)&&typeof row.language==='string'&&row.language.length<=35&&/^[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8})*$/.test(row.language)&&(row.actor===null||id(row.actor)&&actors.has(row.actor)&&!actors.get(row.actor).erased),'invalid_clip_transcript');
  check(typeof row.cues_json==='string'&&row.cues_json.length<=800000,'invalid_clip_cues');
  try{validateCues(JSON.parse(row.cues_json))}catch{throw Error('invalid_clip_cues')}
  seen.add(key);const items=groups.get(row.attachment)??[];items.push(row);groups.set(row.attachment,items);
 }
 for(const clip of clips){
  const items=(groups.get(clip.attachment)??[]).sort((a,b)=>a.version-b.version);
  check(items.length===clip.version&&items.every((row,i)=>row.version===i+1)&&items[0]?.created===clip.created,'missing_clip_history');
 }
 return map;
}
