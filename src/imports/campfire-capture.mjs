import {CAMPFIRE_SCHEMA} from './campfire-schema.mjs';
import { createHash } from 'node:crypto';
import { importDigest } from '../family/team-chat/import-capture.mjs';

export const campfireCheck = (ok, reason) => { if (!ok) throw Error(`CAMPFIRE_INVALID: ${reason}`); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const campfireId = value => typeof value === 'string' && /^[A-Za-z0-9_.-]{1,128}$/.test(value);
const hex = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const same = (a,b) => importDigest(a) === importDigest(b);
export function assertCampfireSource(source) {
  campfireCheck(object(source) && source.implementation === 'once-campfire-express' && source.format === 1 && source.schema === 'express-bootstrap-v1' && source.schemaDigest===CAMPFIRE_SCHEMA && same(source.schemaMigrations, []), 'unsupported source declaration');
}
export function campfireTimestamp(value) {
  campfireCheck(typeof value === 'string' && /^\d{4}-\d\d-\d\d[ T]\d\d:\d\d:\d\d(?:\.\d{1,6})?Z?$/.test(value), 'source timestamp');
  const iso = value.replace(' ','T').replace(/Z?$/,'Z'), seconds = Date.parse(iso.slice(0,19)+'Z') / 1000;
  campfireCheck(Number.isSafeInteger(seconds) && seconds >= 0 && new Date(seconds*1000).toISOString().slice(0,19) === iso.slice(0,19), 'source timestamp');
  return `${seconds}.${(iso.match(/\.(\d+)/)?.[1] ?? '').padEnd(6,'0')}`;
}
export function assertCampfireFileSize(size) { campfireCheck(Number.isSafeInteger(size) && size > 0 && size <= 16*1024*1024, 'original file size'); }
export function assertCampfireFileMetadata(file) {
  assertCampfireFileSize(file.size);
  campfireCheck(typeof file.name === 'string' && file.name.trim() === file.name && file.name.length > 0 && file.name.length <= 120 && !/[\x00-\x1f\x7f\\/<>:"|?*]/.test(file.name), 'original filename');
  campfireCheck(typeof file.mime === 'string' && file.mime.length <= 255 && /^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+$/.test(file.mime) && hex(file.sha256) && campfireId(file.sourceId), 'original MIME or hash');
}
export function assertCampfireCaptureAdmitted(capture) {
  campfireCheck(capture.sourceType === 'campfire' && capture.blocked === false && Array.isArray(capture.blockers) && capture.blockers.length === 0 && capture.omissionsAccepted === true, 'unapproved capture');
  assertCampfireSource(capture.source);
}
export function campfireDurableCapture(capture) {
  const {digest,...rest} = capture;
  return {...rest,messages:capture.messages.map(m=>({...m,files:m.files.map(({bytes,...f})=>f)}))};
}
export const campfireCaptureDigest = capture => importDigest(campfireDurableCapture(capture));
const normalizedEmail = email => typeof email === 'string' ? email.trim().normalize('NFC').toLowerCase() : '';
export function publicCampfireInspection(inspected, users) {
  assertCampfireSource(inspected.source);
  const participants = new Set(inspected.rooms.flatMap(r=>r.members));
  return {sourceType:'campfire',source:inspected.source,channels:inspected.rooms.map(r=>({sourceId:r.id,name:r.name ?? 'Direct conversation',visibility:r.kind,kind:r.kind,sourceMembers:r.members,sourceCreator:r.creator})),actors:inspected.users.map(u=>{
    const email=normalizedEmail(u.email),candidates=u.externalOnly?[]:users.filter(v=>v.active&&v.mode==='member'&&email&&normalizedEmail(v.email)===email).map(v=>v.id);
    return {sourceId:u.id,label:u.name,email,externalOnly:u.externalOnly,active:u.active,participant:participants.has(u.id),required:participants.has(u.id),candidates,match:candidates.length===1?'suggested':candidates.length>1?'ambiguous':'unmapped'};
  }),counts:inspected.counts,omissions:inspected.omissions,completeness:'unknown',sourceAuthenticityVerified:false};
}
export function captureCampfireBackup(inspected, review, importer, users) {
  const check=campfireCheck;assertCampfireSource(inspected.source);
  check(object(review)&&Object.keys(review).sort().join()==='acceptedOmissions,actors,namespace'&&campfireId(review.namespace)&&object(review.actors)&&Array.isArray(review.acceptedOmissions)&&review.acceptedOmissions.length<=1&&review.acceptedOmissions.every(hex),'review fields');
  check(campfireId(importer)&&users.some(u=>u.id===importer&&u.active&&u.mode==='member'),'current importer');
  const participants=new Set(inspected.rooms.flatMap(r=>r.members)),local=new Map(users.map(u=>[u.id,u])),mapped=new Set(),sourceIds=inspected.users.map(u=>u.id);
  check(same(Object.keys(review.actors).sort(),[...sourceIds].sort()),'explicit decision for every source identity');
  const actors=inspected.users.map(u=>{
    const association=review.actors[u.id],required=participants.has(u.id);
    check(association===null||campfireId(association),'identity mapping');
    check(!required||association!==null,'every participant needs a full member');
    if(association!==null){const person=local.get(association);check(person?.active&&person.mode==='member'&&!mapped.has(association),'active injective full-member mapping');mapped.add(association);}
    return {sourceId:u.id,association,sourceRecord:{...u.sourceRecord,nookSource:'campfire'}};
  });
  const associations=new Map(actors.map(a=>[a.sourceId,a.association]));
  check(inspected.rooms.length>0&&inspected.rooms.length<=50,'room limit');
  const channels=inspected.rooms.map(r=>{
    const members=r.members.map(id=>associations.get(id)).sort(),owner=associations.get(r.creator),name=r.name??'Direct conversation';
    check(['channel','private','dm'].includes(r.kind)&&members.length>0&&members.length<=(r.kind==='dm'?50:1000)&&members.every(campfireId)&&new Set(members).size===members.length&&members.includes(owner),'faithful room audience and creator');
    check(typeof name==='string'&&name.trim()&&name.length<=80,'destination room name');
    return {sourceId:r.id,name,kind:r.kind,owner,members,guestMembers:[],sourceRecord:{...r.sourceRecord,membershipHistory:inspected.memberships.filter(m=>m.room===r.id),nookSource:'campfire',participantIds:[...r.members],mappedMembers:members,mappedOwner:owner,sourceKind:r.kind}};
  });
  const byMessage=new Map();
  for(const file of inspected.files){assertCampfireFileMetadata(file);check(file.bytes instanceof Uint8Array&&file.bytes.length===file.size&&createHash('sha256').update(file.bytes).digest('hex')===file.sha256,'original bytes');const list=byMessage.get(file.message)??[];list.push(file);byMessage.set(file.message,list);}
  const messages=inspected.messages.map(m=>{
    const files=(byMessage.get(m.id)??[]).map(f=>({...f})),sourceTimestamp=campfireTimestamp(m.createdAt),key=`${review.namespace}:${m.room}:${m.id}`;
    check(channels.some(c=>c.sourceId===m.room)&&associations.has(m.creator)&&typeof m.body==='string'&&m.body.length<=100000,'message relationship');
    const sourceFiles=files.map(({bytes,...f})=>f);
    return {key,channel:m.room,sourceActor:m.creator,sourceTimestamp,sourceRecord:{...m.sourceRecord,nookSource:'campfire',bodyText:m.body,sourceTimestamp,sourceFiles,sourceParent:m.parent??null},body:m.body,threadRoot:m.parent?`${review.namespace}:${m.room}:${m.parent}`:null,files};
  });
  check(new Set(messages.map(m=>m.key)).size===messages.length&&inspected.files.every(f=>messages.some(m=>m.sourceRecord.id===f.message)),'unique message and file relationships');
  for(const m of messages)if(m.threadRoot)check(messages.some(p=>p.key===m.threadRoot&&p.channel===m.channel&&!p.threadRoot),'native source parent');
  const omissions=[...inspected.omissions],omissionDigest=importDigest(omissions),omissionsAccepted=!omissions.length||same(review.acceptedOmissions,[omissionDigest]);
  const capture={sourceType:'campfire',source:inspected.source,namespace:review.namespace,archiveDigest:inspected.archiveDigest,reviewDigest:importDigest(review),channels,actors,messages,omissions,omissionDigest,omissionsAccepted,blocked:false,blockers:[],externalActors:actors.filter(a=>a.sourceRecord.role===2).map(a=>a.sourceId),skippedKinds:{},missingFiles:{count:0,bytes:0,unknownSizes:0,accepted:false},missingFileInventory:[],missingFileInventoryDigest:importDigest([]),completeness:'unknown',sourceAuthenticityVerified:false,counts:{channels:channels.length,actors:actors.length,messages:messages.length,threads:messages.filter(m=>m.threadRoot).length,files:inspected.files.length,bytes:inspected.files.reduce((n,f)=>n+f.size,0),omissions:omissions.length}};
  capture.digest=campfireCaptureDigest(capture);return capture;
}
export function campfireSummary(capture) {
  return {sourceType:'campfire',source:capture.source,reviewDigest:capture.reviewDigest,externalActors:capture.externalActors,skippedKinds:capture.skippedKinds,missingFiles:capture.missingFiles,missingFileInventoryDigest:capture.missingFileInventoryDigest,counts:capture.counts,omissions:capture.omissions,omissionDigest:capture.omissionDigest,omissionsAccepted:capture.omissionsAccepted,blockers:capture.blockers,blocked:capture.blocked,channels:capture.channels.map(({sourceRecord,...c})=>c),actors:capture.actors.map(({sourceRecord,...a})=>a),archiveDigest:capture.archiveDigest,captureDigest:capture.digest,completeness:'unknown',sourceAuthenticityVerified:false};
}

export const campfireFileHashes=capture=>capture.messages.flatMap(m=>m.files.map(f=>({key:m.key,sourceId:f.sourceId,name:f.name,mime:f.mime,size:f.size,sha256:f.sha256})));
