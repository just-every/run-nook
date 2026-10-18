import { canonicalJson, sha256 } from './kit.ts';
import { importDigest } from '../family/team-chat/import-capture.mjs';
import { compareSourceMessages } from './timestamps.mjs';
import { fileObjectKey } from './ids.mjs';
import { parseFragment } from 'parse5';
import { campfireCheck as check, campfireId, assertCampfireCaptureAdmitted, assertCampfireFileMetadata, campfireTimestamp, campfireDurableCapture } from './campfire-capture.mjs';
export { assertCampfireFileSize } from './campfire-capture.mjs';
export const CAMPFIRE_MAPPING_VERSION='nook-campfire-immutable-v1';
export const campfireNativeId=(namespace,kind,key)=>'campfire-'+importDigest([namespace,kind,key]).slice(0,40);
export const campfireCaptureJobId=(capture,upload)=>campfireNativeId(capture.namespace,'capture',capture.digest+':'+upload);
const equal=(a,b)=>canonicalJson(a)===canonicalJson(b);
function originalBody(html){
  check(typeof html==='string'&&html.length<=100000,'original rich text');
  const blocks=new Set(['div','p','li','ul','ol','blockquote','pre','h1','h2','h3','h4','h5','h6','tr']);let nodes=0;
  const walk=(node,depth)=>{check(++nodes<=100000&&depth<=100,'original rich text complexity');if(node.nodeName==='#text')return node.value;check(!['script','style','iframe','object','embed','svg','math','template','action-text-attachment','img'].includes(node.tagName),'unsupported original rich text');if(node.tagName==='br')return '\n';return (node.childNodes??[]).map(child=>walk(child,depth+1)).join('')+(blocks.has(node.tagName)?'\n':'');};
  return walk(parseFragment(html),0).replace(/\n$/,'');
}
export function assertCampfireEffect(kind,value){
  const s=value?.sourceRecord;
  check(s?.nookSource==='campfire'&&typeof value.job==='string'&&value.job.startsWith('campfire-'),'source marker or job');
  if(kind==='channel'){
    check(s.id===value.sourceId&&s.sourceKind===value.kind&&['channel','private','dm'].includes(value.kind)&&equal(s.mappedMembers,value.members)&&s.mappedOwner===value.owner&&value.members.includes(value.owner)&&value.members.every(campfireId)&&new Set(value.members).size===value.members.length&&equal(value.guestMembers,[])&&Array.isArray(s.participantIds)&&s.participantIds.length===value.members.length&&new Set(s.participantIds).size===s.participantIds.length,'room fidelity');
    check({'Rooms::Open':'channel','Rooms::Closed':'private','Rooms::Direct':'dm'}[s.type]===value.kind&&value.members.length<=(value.kind==='dm'?50:1000)&&value.name===(s.name??'Direct conversation'),'room visibility or name');
  }else if(kind==='actor'){
    check(s.id===value.sourceId&&(value.association===null||campfireId(value.association)),'identity fidelity');
    check(!Object.keys(s).some(k=>/password|token|secret|session|credential/i.test(k)),'source authentication forbidden');
  }else if(kind==='message'){
    check(typeof s.id==='string'&&s.creator_id===value.sourceActor&&s.bodyText===value.body&&originalBody(s.richText?.body)===value.body&&s.sourceTimestamp===value.sourceTimestamp&&campfireTimestamp(s.created_at)===value.sourceTimestamp&&typeof s.room_id==='string'&&Array.isArray(s.sourceFiles)&&Array.isArray(value.files)&&s.sourceFiles.length===value.files.length,'message fidelity');
    check(s.sourceParent===null?value.parent===null:typeof s.sourceParent==='string'&&typeof value.parent==='string','source parent fidelity');
    for(const [position,file]of value.files.entries()){
      assertCampfireFileMetadata(file);const original=s.sourceFiles[position];
      check(original.sourceId===file.sourceId&&original.name===file.name&&original.mime===file.mime&&original.size===file.size&&original.sha256===file.sha256&&original.message===s.id&&original.sourceRecord?.record_id===s.id&&original.sourceRecord?.blob_id===file.sourceId&&original.sourceRecord?.record_type==='Message'&&original.sourceRecord?.name==='attachment'&&file.position===position,'original file relationship');
    }
  }else check(false,'unsupported target kind');
}
export function campfireEffectInputs(capture,importer,upload,reviewId){
  assertCampfireCaptureAdmitted(capture);
  const domainJob=campfireCaptureJobId(capture,upload),effects=[];
  for(const c of capture.channels)effects.push({kind:'channel',key:c.sourceId,value:{id:campfireNativeId(capture.namespace,'channel',c.sourceId),job:domainJob,owner:c.owner,name:c.name,sourceId:c.sourceId,sourceRecord:c.sourceRecord,members:c.members,guestMembers:[],seq:0,version:1,messageCount:0,kind:c.kind}});
  for(const a of capture.actors)effects.push({kind:'actor',key:`${domainJob}:${a.sourceId}`,value:{job:domainJob,...a}});
  const sequences=new Map();
  for(const m of [...capture.messages].sort(compareSourceMessages)){
    const channel=capture.channels.find(c=>c.sourceId===m.channel);
    check(channel&&m.sourceRecord.room_id===m.channel&&m.key===`${capture.namespace}:${m.channel}:${m.sourceRecord.id}`&&m.threadRoot===(m.sourceRecord.sourceParent?`${capture.namespace}:${m.channel}:${m.sourceRecord.sourceParent}`:null),'message source room and parent');
    const conversation=campfireNativeId(capture.namespace,'channel',m.channel),sequence=(sequences.get(conversation)??0)+1;sequences.set(conversation,sequence);
    effects.push({kind:'message',key:m.key,value:{id:campfireNativeId(capture.namespace,'message',m.key),job:domainJob,owner:importer,conversation,key:m.key,sourceActor:m.sourceActor,sourceTimestamp:m.sourceTimestamp,sourceRecord:m.sourceRecord,body:m.body,parent:m.threadRoot?campfireNativeId(capture.namespace,'message',m.threadRoot):null,sequence,files:m.files.map((f,position)=>{const id=campfireNativeId(capture.namespace,'file',`${m.key}:${f.sourceId}`);return {id,sourceId:f.sourceId,name:f.name,mime:f.mime,size:f.size,sha256:f.sha256,position,objectKey:fileObjectKey(importer,upload,domainJob,reviewId,id),state:'attached',author:channel.owner,expires:0,created:'1970-01-01T00:00:00.000Z',intent:'campfire:'+id};})}});
  }
  for(const effect of effects)assertCampfireEffect(effect.kind,effect.value);return {domainJob,effects};
}
export function campfireMapping(){return {version:CAMPFIRE_MAPPING_VERSION,map:record=>{assertCampfireEffect(record.kind,record.payload);return {effects:[{targetKind:record.kind,targetId:record.kind==='actor'?record.sourceId:record.payload.id,value:record.payload}]};}};}
export function campfireKitSource(capture,importer,upload,reviewId){
  const {domainJob,effects}=campfireEffectInputs(capture,importer,upload,reviewId),normalization={sourceType:'campfire',capture:{...campfireDurableCapture(capture),digest:capture.digest},effects},normalized=canonicalJson(normalization);
  const artifact={name:`reviewed-campfire-capture-${capture.reviewDigest}.json`,sha256:sha256(normalized),size:Buffer.byteLength(normalized),original:{status:'available',base64:Buffer.from(normalized).toString('base64')}};
  const source={artifacts:[artifact],diagnostics:[],records:effects.map((e,row)=>({namespace:capture.namespace,kind:e.kind,sourceId:e.key,payload:e.value,payloadHash:sha256(canonicalJson(e.value)),artifactHash:artifact.sha256,location:{artifact:artifact.name,row}}))};
  return {source,mapping:campfireMapping(),domainJob};
}
