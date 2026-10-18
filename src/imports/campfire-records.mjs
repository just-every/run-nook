import { createHash } from 'node:crypto';
import { parseFragment } from 'parse5';

export const campfireReject = reason => { throw Error(`CAMPFIRE_INVALID: ${reason}`); };
export const campfireHash = bytes => createHash('sha256').update(bytes).digest('hex');
export function campfireRows(db, sql) {
  const result = db.exec(sql)[0];
  if (!result) return [];
  if (result.values.length > 100000) campfireReject('record limit');
  return result.values.map(row => Object.fromEntries(result.columns.map((key, i) => [key, row[i]])));
}
const id = value => {
  if (!Number.isSafeInteger(value) || value < 1) campfireReject('invalid source identity');
  return String(value);
};
function text(value, max = 100000, nullable = false) {
  if (nullable && value === null) return null;
  if (typeof value !== 'string' || !value.isWellFormed() || value.length > max || value.includes('\0')) campfireReject('invalid source text');
  return value;
}
export function campfireDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\d[ T]\d\d:\d\d:\d\d(?:\.\d{1,6})?Z?$/.test(value)) campfireReject('invalid source date');
  const iso = value.replace(' ', 'T').replace(/Z?$/, 'Z'), date = new Date(iso);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,19) !== iso.slice(0,19)) campfireReject('invalid source date');
  return iso;
}
const block = new Set(['div','p','li','ul','ol','blockquote','pre','h1','h2','h3','h4','h5','h6','tr']);
function plainBody(html) {
  const fragment = parseFragment(text(html));
  let nodes = 0;
  function visit(node, depth) {
    if (++nodes > 100000 || depth > 100) campfireReject('rich text complexity');
    if (node.nodeName === '#text') return node.value;
    if (['script','style','iframe','object','embed','svg','math','template'].includes(node.tagName)) campfireReject('unsupported active rich text');
    // Inline Action Text attachments carry signed references whose meaning must
    // be reconstructed explicitly; never silently flatten them into missing text.
    if (node.tagName === 'action-text-attachment' || node.tagName === 'img') campfireReject('unsupported embedded rich text attachment');
    if (node.tagName === 'br') return '\n';
    const content = (node.childNodes ?? []).map(child => visit(child, depth + 1)).join('');
    return block.has(node.tagName) ? content + '\n' : content;
  }
  return visit(fragment, 0).replace(/\n$/, '');
}
const index = rows => new Map(rows.map(row => [id(row.id), row]));
function unique(rows) { const map = index(rows); if (map.size !== rows.length) campfireReject('duplicate identity'); return map; }
function requireRef(map, key, label) { const result = map.get(id(key)); if (!result) campfireReject(`missing ${label}`); return result; }

/** Read only explicitly allowed source columns: authentication never escapes. */
export function campfireRecords(db, archive) {
  const read = sql => campfireRows(db, sql), omissions = [];
  const rawUsers = read('SELECT id,name,email_address,bio,role,status,created_at,updated_at FROM users ORDER BY id');
  const userMap = unique(rawUsers);
  const users = rawUsers.map(u => {
    if (![0,1,2].includes(u.role) || ![0,1,2].includes(u.status)) campfireReject('unsupported user role or status');
    return {id:id(u.id),sourceId:id(u.id),name:text(u.name,1000),email:text(u.email_address,1000,true),active:u.status===0,externalOnly:u.role===2,createdAt:campfireDate(u.created_at),updatedAt:campfireDate(u.updated_at),sourceRecord:{id:id(u.id),name:u.name,email_address:u.email_address,bio:text(u.bio,10000,true),role:u.role,status:u.status,created_at:u.created_at,updated_at:u.updated_at}};
  });
  const rawRooms = read('SELECT id,name,type,creator_id,created_at,updated_at FROM rooms ORDER BY id'), roomMap = unique(rawRooms);
  const rawMemberships = read('SELECT id,room_id,user_id,created_at,updated_at FROM memberships ORDER BY id');
  unique(rawMemberships); const pairs = new Set();
  const memberships = rawMemberships.map(m => {
    requireRef(roomMap,m.room_id,'membership room'); requireRef(userMap,m.user_id,'membership user');
    const key = `${m.room_id}:${m.user_id}`; if (pairs.has(key)) campfireReject('ambiguous membership'); pairs.add(key);
    return {id:id(m.id),room:id(m.room_id),user:id(m.user_id),createdAt:campfireDate(m.created_at),updatedAt:campfireDate(m.updated_at)};
  });
  const rooms = rawRooms.map(r => {
    requireRef(userMap,r.creator_id,'room creator');
    const kind = {'Rooms::Open':'channel','Rooms::Closed':'private','Rooms::Direct':'dm'}[r.type];
    if (!kind) campfireReject('unsupported room visibility');
    const members = memberships.filter(m=>m.room===id(r.id)).map(m=>m.user).sort((a,b)=>Number(a)-Number(b));
    if (!members.length || kind==='dm' && !members.includes(id(r.creator_id))) campfireReject('ambiguous room audience');
    if (kind==='channel' && rawUsers.some(u=>u.status===0&&!members.includes(id(u.id)))) campfireReject('incomplete open room audience');
    return {id:id(r.id),sourceId:id(r.id),name:text(r.name,1000,true),kind,members,creator:id(r.creator_id),createdAt:campfireDate(r.created_at),updatedAt:campfireDate(r.updated_at),sourceRecord:{...r,id:id(r.id),creator_id:id(r.creator_id)}};
  });
  const rawMessages = read('SELECT id,room_id,creator_id,client_message_id,created_at,updated_at FROM messages ORDER BY created_at,id'), messageMap=unique(rawMessages);
  const rich = read('SELECT id,name,record_id,record_type,body,created_at,updated_at FROM action_text_rich_texts ORDER BY id'), bodies=new Map(); unique(rich);
  for (const row of rich) {
    if (row.record_type!=='Message'||row.name!=='body') campfireReject('unsupported rich text relationship');
    requireRef(messageMap,row.record_id,'rich text message'); const key=id(row.record_id);
    if (bodies.has(key)) campfireReject('ambiguous message body'); bodies.set(key,row);
  }
  const messages = rawMessages.map(m => {
    requireRef(roomMap,m.room_id,'message room');requireRef(userMap,m.creator_id,'message creator');
    const richText=bodies.get(id(m.id));if(!richText)campfireReject('missing message body');
    const html=text(richText.body), body=plainBody(html);
    return {id:id(m.id),sourceId:id(m.id),room:id(m.room_id),creator:id(m.creator_id),createdAt:campfireDate(m.created_at),updatedAt:campfireDate(m.updated_at),body,parent:null,sourceRecord:{...m,id:id(m.id),room_id:id(m.room_id),creator_id:id(m.creator_id),client_message_id:text(m.client_message_id,1000),richText:{id:id(richText.id),body:html,created_at:campfireDate(richText.created_at),updated_at:campfireDate(richText.updated_at)}}};
  });
  const blobs=read('SELECT id,key,filename,content_type,byte_size,checksum,service_name FROM active_storage_blobs ORDER BY id'), blobMap=unique(blobs), used=new Set(), files=[];
  const attachments=read('SELECT id,blob_id,name,record_type,record_id FROM active_storage_attachments ORDER BY id');unique(attachments);
  const blobBytes=new Map(), paths=new Set();
  for(const blob of blobs){
    if(blob.service_name!=='local'||typeof blob.key!=='string'||!/^[A-Za-z0-9]{4,128}$/.test(blob.key)||!Number.isSafeInteger(blob.byte_size)||blob.byte_size<1||blob.byte_size>16*1024*1024)campfireReject('unsupported blob');
    const path=`storage/files/${blob.key.slice(0,2)}/${blob.key.slice(2,4)}/${blob.key}`, bytes=archive.get(path);
    if(paths.has(path)||!bytes||bytes.length!==blob.byte_size||createHash('md5').update(bytes).digest('base64')!==blob.checksum)campfireReject('missing or inconsistent file bytes');
    paths.add(path);blobBytes.set(id(blob.id),bytes);
    text(blob.filename,1000);text(blob.content_type,255);
  }
  for(const a of attachments){
    const blob=requireRef(blobMap,a.blob_id,'attachment blob');
    if(a.record_type!=='Message'||a.name!=='attachment')campfireReject('unsupported attachment relationship');
    requireRef(messageMap,a.record_id,'attachment message');const message=id(a.record_id);
    if(used.has(message))campfireReject('ambiguous message attachment');used.add(message);
    const bytes=blobBytes.get(id(blob.id));files.push({id:id(a.id),sourceId:id(blob.id),message,bytes,sha256:campfireHash(bytes),name:blob.filename,mime:blob.content_type,size:blob.byte_size,sourceRecord:{id:id(a.id),blob_id:id(blob.id),name:a.name,record_type:a.record_type,record_id:message,filename:blob.filename,content_type:blob.content_type,byte_size:blob.byte_size,checksum:blob.checksum}});
  }
  for(const blob of blobs)if(!attachments.some(a=>a.blob_id===blob.id))omissions.push({kind:'file',key:id(blob.id),reason:'unattached-source-blob'});
  for(const [path]of archive)if(path.startsWith('storage/files/')&&!paths.has(path))campfireReject('file bytes without a source blob');
  for(const table of ['boosts','searches','bans','push_subscriptions','sessions','webhooks','active_storage_variant_records']){
    const count=read(`SELECT COUNT(*) AS count FROM ${table}`)[0].count;
    if(count)omissions.push({kind:'source-records',key:table,count,reason:'not-migrated'});
  }
  return {users,rooms,memberships,messages,files,omissions,counts:{users:users.length,rooms:rooms.length,memberships:memberships.length,messages:messages.length,files:files.length,bytes:files.reduce((sum,f)=>sum+f.size,0)}};
}
