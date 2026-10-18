import { canonicalJson, sha256 } from './kit.ts';
import { importDigest } from '../family/team-chat/import-capture.mjs';
import { compareSourceMessages } from './timestamps.mjs';
import { fileObjectKey } from './ids.mjs';
import { mattermostCheck as check, mattermostId, assertMattermostCaptureAdmitted, assertMattermostFileMetadata, mattermostTimestamp, mattermostDurableCapture, assertMattermostRoles } from './mattermost-capture.mjs';
export { assertMattermostFileSize } from './mattermost-capture.mjs';
export const MATTERMOST_MAPPING_VERSION='nook-mattermost-immutable-v1';
export const mattermostNativeId=(namespace,kind,key)=>'mattermost-'+importDigest([namespace,kind,key]).slice(0,40);
export const mattermostCaptureJobId=(capture,upload)=>mattermostNativeId(capture.namespace,'capture',capture.digest+':'+upload);
const equal=(a,b)=>canonicalJson(a)===canonicalJson(b);
function historicalRoles(roles) {
  check(roles && typeof roles === 'object' && !Array.isArray(roles) && Object.keys(roles).every(mattermostId) && Object.values(roles).every(role => role === 'historical-only'), 'historical source roles');
}
export function assertMattermostEffect(kind, value) {
  const s = value?.sourceRecord;
  check(s?.nookSource === 'mattermost' && typeof value.job === 'string' && value.job.startsWith('mattermost-'), 'source marker or job');
  if (kind === 'channel') {
    historicalRoles(s.roleDecisions);
    check(s.id === value.sourceId && s.sourceKind === value.kind && ['channel', 'private', 'dm'].includes(value.kind) && equal(s.mappedMembers, value.members) && s.mappedOwner === value.owner && value.members.includes(value.owner) && value.members.every(mattermostId) && new Set(value.members).size === value.members.length && equal(value.guestMembers, []) && Array.isArray(s.participantIds) && s.participantIds.every(mattermostId) && s.participantIds.includes(s.creator_id) && s.participantIds.length === value.members.length && new Set(s.participantIds).size === s.participantIds.length, 'room fidelity');
    check({O: 'channel', P: 'private', D: 'dm', G: 'dm'}[s.type] === value.kind && value.members.length <= (value.kind === 'dm' ? 50 : 1000) && value.name === s.destinationName && typeof value.name === 'string' && value.name.trim() && value.name.length <= 80, 'room visibility or name');
    check(Array.isArray(s.membershipHistory) && s.membershipHistory.every(member => member.room === s.id) && equal(s.membershipHistory.map(member => member.user).sort(), [...s.participantIds].sort()), 'source membership history');
    if (value.kind === 'dm') check(Array.isArray(s.members) && equal([...s.members].sort(), [...s.participantIds].sort()) && Array.isArray(s.participants) && (!s.participants.length || equal([...new Set(s.participants.map(member => member.username))].sort(), [...s.participantIds].sort())), 'fixed source direct audience');
    check(Array.isArray(s.emojiCatalog) && new Set(s.emojiCatalog.map(emoji => emoji.name)).size === s.emojiCatalog.length, 'custom emoji inventory');
    for (const emoji of s.emojiCatalog) {
      const bytes = Buffer.from(emoji.base64, 'base64');
      check(/^[A-Za-z0-9_+-]{1,128}$/.test(emoji.name) && /^image\/(png|jpeg|gif|webp)$/.test(emoji.mime) && bytes.toString('base64') === emoji.base64 && bytes.length === emoji.size && sha256(bytes) === emoji.sha256 && typeof emoji.path === 'string', 'custom emoji integrity');
    }
  } else if (kind === 'actor') {
    historicalRoles(s.roleDecisions);
    check(s.id === value.sourceId && mattermostId(value.sourceId) && (value.association === null || mattermostId(value.association)), 'identity fidelity');
    check(!Object.keys(s).some(key => /password|token|secret|session|credential/i.test(key)), 'source authentication forbidden');
  } else if (kind === 'message') {
    check(mattermostId(s.id) && s.creator_id === value.sourceActor && s.bodyText === value.body && s.message === value.body && typeof value.body === 'string' && value.body.length <= 100000 && s.sourceTimestamp === value.sourceTimestamp && mattermostTimestamp(s.created_at) === value.sourceTimestamp && mattermostId(s.room_id) && Array.isArray(s.sourceFiles) && Array.isArray(value.files) && s.sourceFiles.length === value.files.length, 'message fidelity');
    mattermostTimestamp(s.updated_at);
    check(s.user === s.creator_id && Number.isSafeInteger(s.create_at) && s.create_at === Date.parse(s.created_at) && Number.isSafeInteger(s.edit_at) && s.edit_at >= 0 && Date.parse(s.updated_at) === (s.edit_at || s.create_at) && s.sourceParent === s.parent, 'original source timestamps and parent');
    check(Array.isArray(s.attachments) && s.attachments.length === value.files.length, 'original attachment inventory');
    check(s.sourceParent === null ? value.parent === null : mattermostId(s.sourceParent) && typeof value.parent === 'string', 'source parent fidelity');
    check(Array.isArray(s.reactions) && Array.isArray(s.flagged_by) && s.flagged_by.every(mattermostId) && new Set(s.flagged_by).size === s.flagged_by.length && Array.isArray(s.mappedSavedUsers) && s.mappedSavedUsers.every(mattermostId) && s.mappedSavedUsers.length === s.flagged_by.length && new Set(s.mappedSavedUsers).size === s.mappedSavedUsers.length && typeof s.is_pinned === 'boolean', 'source saved and pinned fidelity');
    check(Array.isArray(s.customEmojiNames) && s.customEmojiNames.every(name => typeof name === 'string' && /^[A-Za-z0-9_+-]{1,128}$/.test(name)) && equal(s.customEmojiNames, [...new Set(s.customEmojiNames)].sort()), 'custom emoji names');
    const reactions = new Set();
    for (const reaction of s.reactions) {
      const identity = JSON.stringify([reaction.user, reaction.emoji_name]);
      check(mattermostId(reaction.user) && typeof reaction.emoji_name === 'string' && /^[A-Za-z0-9_+-]{1,128}$/.test(reaction.emoji_name) && Number.isSafeInteger(reaction.create_at) && reaction.create_at >= 0 && !reactions.has(identity), 'source reaction fidelity');
      reactions.add(identity);
    }
    for (const [position, file] of value.files.entries()) {
      assertMattermostFileMetadata(file); const original = s.sourceFiles[position];
      check(original.sourceId === file.sourceId && original.name === file.name && original.mime === file.mime && original.size === file.size && original.sha256 === file.sha256 && original.message === s.id && original.sourceRecord?.record_id === s.id && original.sourceRecord?.blob_id === file.sourceId && original.sourceRecord?.record_type === 'Message' && original.sourceRecord?.name === 'attachment' && original.sourceRecord?.filename === file.name && original.sourceRecord?.content_type === file.mime && original.sourceRecord?.byte_size === file.size && original.sourceRecord?.path === s.attachments[position]?.path && file.position === position, 'original file relationship');
    }
  } else check(false, 'unsupported target kind');
}
export function mattermostEffectInputs(capture,importer,upload,reviewId){
  assertMattermostCaptureAdmitted(capture);
  const domainJob=mattermostCaptureJobId(capture,upload),effects=[];
  const actors = new Map(capture.actors.map(actor => [actor.sourceId, actor])), customEmojiNames = capture.channels.flatMap(channel => channel.sourceRecord.emojiCatalog.map(emoji => emoji.name)).sort();
  for (const actor of capture.actors) check(equal(actor.sourceRecord.roleDecisions, capture.roles), 'identity role decision binding');
  for (const channel of capture.channels) {
    assertMattermostRoles(channel.sourceRecord.roleDecisions, capture.source.roleInventory);
    check(equal(channel.sourceRecord.roleDecisions, capture.roles) && equal(channel.members, channel.sourceRecord.participantIds.map(id => actors.get(id)?.association).sort()) && channel.owner === actors.get(channel.sourceRecord.creator_id)?.association, 'mapped room audience');
  }
  check(new Set(capture.channels.flatMap(channel => channel.sourceRecord.emojiCatalog.map(emoji => emoji.name))).size === capture.channels.reduce((sum, channel) => sum + channel.sourceRecord.emojiCatalog.length, 0), 'unique custom emoji catalog');
  for(const c of capture.channels)effects.push({kind:'channel',key:c.sourceId,value:{id:mattermostNativeId(capture.namespace,'channel',c.sourceId),job:domainJob,owner:c.owner,name:c.name,sourceId:c.sourceId,sourceRecord:c.sourceRecord,members:c.members,guestMembers:[],seq:0,version:1,messageCount:0,kind:c.kind}});
  for(const a of capture.actors)effects.push({kind:'actor',key:`${domainJob}:${a.sourceId}`,value:{job:domainJob,...a}});
  const sequences=new Map();
  for(const m of [...capture.messages].sort(compareSourceMessages)){
    const channel=capture.channels.find(c=>c.sourceId===m.channel);
    check(channel&&m.sourceRecord.room_id===m.channel&&m.key===`${capture.namespace}:${m.channel}:${m.sourceRecord.id}`&&m.threadRoot===(m.sourceRecord.sourceParent?`${capture.namespace}:${m.channel}:${m.sourceRecord.sourceParent}`:null),'message source room and parent');
    check(equal(m.sourceRecord.customEmojiNames,customEmojiNames),'message custom emoji catalog');
    check(actors.has(m.sourceActor) && m.sourceRecord.reactions.every(reaction => actors.has(reaction.user)) && equal(m.sourceRecord.mappedSavedUsers, m.sourceRecord.flagged_by.map(id => actors.get(id)?.association).sort()) && m.sourceRecord.mappedSavedUsers.every(mattermostId), 'message source identities');
    if (m.threadRoot) check(capture.messages.some(parent => parent.key === m.threadRoot && parent.channel === m.channel && parent.threadRoot === null), 'source thread root');
    const conversation=mattermostNativeId(capture.namespace,'channel',m.channel),sequence=(sequences.get(conversation)??0)+1;sequences.set(conversation,sequence);
    effects.push({kind:'message',key:m.key,value:{id:mattermostNativeId(capture.namespace,'message',m.key),job:domainJob,owner:importer,conversation,key:m.key,sourceActor:m.sourceActor,sourceTimestamp:m.sourceTimestamp,sourceRecord:m.sourceRecord,body:m.body,parent:m.threadRoot?mattermostNativeId(capture.namespace,'message',m.threadRoot):null,sequence,files:m.files.map((f,position)=>{const id=mattermostNativeId(capture.namespace,'file',`${m.key}:${f.sourceId}`);return {id,sourceId:f.sourceId,name:f.name,mime:f.mime,size:f.size,sha256:f.sha256,position,objectKey:fileObjectKey(importer,upload,domainJob,reviewId,id),state:'attached',author:channel.owner,expires:0,created:'1970-01-01T00:00:00.000Z',intent:'mattermost:'+id};})}});
  }
  for(const effect of effects)assertMattermostEffect(effect.kind,effect.value);return {domainJob,effects};
}
export function mattermostMapping(){return {version:MATTERMOST_MAPPING_VERSION,map:record=>{assertMattermostEffect(record.kind,record.payload);return {effects:[{targetKind:record.kind,targetId:record.kind==='actor'?record.sourceId:record.payload.id,value:record.payload}]};}};}
export function mattermostKitSource(capture,importer,upload,reviewId){
  const {domainJob,effects}=mattermostEffectInputs(capture,importer,upload,reviewId),normalization={sourceType:'mattermost',capture:{...mattermostDurableCapture(capture),digest:capture.digest},effects},normalized=canonicalJson(normalization);
  const artifact={name:`reviewed-mattermost-capture-${capture.reviewDigest}.json`,sha256:sha256(normalized),size:Buffer.byteLength(normalized),original:{status:'available',base64:Buffer.from(normalized).toString('base64')}};
  const source={artifacts:[artifact],diagnostics:[],records:effects.map((e,row)=>({namespace:capture.namespace,kind:e.kind,sourceId:e.key,payload:e.value,payloadHash:sha256(canonicalJson(e.value)),artifactHash:artifact.sha256,location:{artifact:artifact.name,row}}))};
  return {source,mapping:mattermostMapping(),domainJob};
}
