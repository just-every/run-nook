import {readSlackZip,jsonEntry,sha256} from './zip.mjs';
import {importDigest} from '../family/team-chat/import-capture.mjs';
import {captureSlackArchive} from './slack.mjs';
const check=(ok,why)=>{if(!ok)throw Error('GCHAT_INVALID: '+why)};
const key=value=>'gchat-'+importDigest(value).slice(0,40);
const userId=user=>{check(user&&typeof user.email==='string'&&user.email.includes('@'),'participant email required');return key(user.email.trim().toLowerCase())};
function time(value){
 check(typeof value==='string','created_date required');
 const ms=Date.parse(value);check(Number.isSafeInteger(ms)&&ms>=0,'invalid source date');
 const fraction=value.match(/\.(\d{1,6})(?:Z|[+-]\d\d:\d\d)$/)?.[1];
 return Math.floor(ms/1000)+'.'+(fraction??String(ms%1000).padStart(3,'0')).padEnd(6,'0');
}
/** A bounded, local reader for the Google Chat Takeout Groups/Users layout.
 * No URL is fetched. Unknown layouts and unsupported per-message metadata fail
 * before a normalized packet can be uploaded. */
export function inspectGchatArchive(bytes,localUsers=[]){
 const archive=readSlackZip(bytes),paths=[...archive.files.keys()];
 const roots=paths.filter(p=>/(?:^|\/)Groups\/[^/]+\/group_info.json$/.test(p)).map(p=>p.slice(0,p.indexOf('Groups/')));
 check(roots.length>0&&new Set(roots).size===1,'expected one Google Chat Takeout Groups directory');
 const root=roots[0];check(root===''||root==='Google Chat/'||root==='Takeout/Google Chat/','unsupported Takeout root');
 const files=new Map(),users=new Map(),channels=[],omissions=[],groups=[];
 const person=raw=>{const id=userId(raw);check(typeof raw.name==='string'&&raw.name.length<=400,'user name');const record={id,name:raw.name,profile:{email:raw.email},googleChat:{name:raw.name,email:raw.email,user_type:raw.user_type??'Human'}};const prior=users.get(id);check(!prior||prior.profile.email.toLowerCase()===raw.email.toLowerCase(),'duplicate user');users.set(id,record);return id};
 for(const path of paths.filter(p=>p.startsWith(root+'Users/')&&p.endsWith('/user_info.json')))person(jsonEntry(archive.files,path));
 for(const path of paths.filter(p=>p.startsWith(root+'Groups/')&&p.endsWith('/group_info.json')).sort()){
  const folder=path.slice(0,-'group_info.json'.length),info=jsonEntry(archive.files,path);
  check(info&&typeof info==='object'&&typeof info.name==='string'&&Array.isArray(info.members),'group_info fields');
  const id=key(folder.slice(root.length));
  if(info.is_external===true||info.externally_owned===true){omissions.push({kind:'channel',key:id,reason:'externally-owned-space-omitted'});continue;}
  check(['SPACE','DM','GROUP_DM'].includes(info.group_type),'group_type must be SPACE, DM or GROUP_DM');
  const members=info.members.map(person);check(members.length>0&&new Set(members).size===members.length,'exact membership roster');
  const source={id,name:id,members,visibility:info.group_type==='SPACE'?'private':info.group_type==='DM'?'dm':'group-dm',googleChat:{...info,members:info.members.map(m=>({name:m.name,email:m.email,user_type:m.user_type??'Human'}))}};
  channels.push(source);groups.push({id,name:info.name||'Direct conversation',folder,source});
 }
 check(channels.length>0&&channels.length<=50,'no supported groups or group limit');
 for(const group of groups){
  const document=jsonEntry(archive.files,group.folder+'messages.json');check(document&&Array.isArray(document.messages),'messages.json object with messages array required');
  const topics=new Map(),seen=new Set(),rows=[];
  const messages=[...document.messages].sort((a,b)=>time(a.created_date).localeCompare(time(b.created_date)));
  for(const m of messages){
   check(typeof m.message_id==='string'&&m.message_id.length<=512,'stable message_id required');
   const ts=time(m.created_date);check(!seen.has(ts),'duplicate source timestamp');seen.add(ts);
   const author=person(m.creator);check(typeof m.text==='string'&&m.text.length<=100000,'message text required');
   check(m.annotations===undefined||Array.isArray(m.annotations)&&m.annotations.length===0,'unsupported annotations; no partial message import');
   check(!m.deleted_date,'deleted-message layout unsupported');
   check(m.reactions===undefined||Array.isArray(m.reactions)&&m.reactions.length===0,'unsupported reaction layout');
   const attachments=m.attachments??[];check(Array.isArray(attachments)&&attachments.length<=5,'attachments');
   const originalFiles=attachments.map((file,index)=>{
    check(typeof file.export_name==='string'&&!file.export_name.includes('..')&&!file.export_name.startsWith('/')&&typeof file.name==='string'&&typeof file.content_type==='string','attachment layout');
    const body=archive.files.get(group.folder+file.export_name);check(body&&body.length>0&&body.length<=1024*1024,'referenced attachment missing or over 1 MiB');
    const fid=key([group.id,m.message_id,index]);files.set('files/'+fid+'/'+file.name,body);
    return {id:fid,name:file.name,mimetype:file.content_type,size:body.length,sha256:sha256(body)};
   });
   let thread_ts;
   if(m.topic_id!==undefined){check(typeof m.topic_id==='string','topic_id');thread_ts=topics.get(m.topic_id);if(!thread_ts)topics.set(m.topic_id,ts);}
   rows.push({type:'message',user:author,ts,text:m.text,files:originalFiles,...(thread_ts?{thread_ts}:{}),...(m.last_updated_date?{edited:{ts:time(m.last_updated_date)}}:{}),nookSource:'gchat',googleChat:{message_id:m.message_id,created_date:m.created_date,creator:{name:m.creator.name,email:m.creator.email},topic_id:m.topic_id??null,last_updated_date:m.last_updated_date??null}});
  }
  files.set(group.id+'/2000-01-01.json',new TextEncoder().encode(JSON.stringify(rows)));
 }
 const actors=[...users.values()].map(u=>{const email=u.profile.email.trim().toLowerCase(),candidates=localUsers.filter(v=>v.active&&v.email?.trim().toLowerCase()===email).map(v=>v.id);return {sourceId:u.id,label:u.name,email,externalOnly:false,candidates,match:candidates.length===1?'suggested':'unmapped'}});
 return {sourceType:'gchat',archive:{files,archiveDigest:archive.archiveDigest},users:[...users.values()],automationIds:new Set(),channels,actors,omissions,groups:groups.map(({folder,source,...g})=>g),integrations:[],completeness:'unknown',sourceAuthenticityVerified:false};
}
export function captureGchatArchive(inspected,review,owner,users){
 const capture=captureSlackArchive(inspected,review,owner,users);
 capture.sourceType='gchat';delete capture.cutover;
 for(const channel of capture.channels)channel.name=inspected.groups.find(g=>g.id===channel.sourceId)?.name??channel.name;
 capture.digest=importDigest({...capture,messages:capture.messages.map(m=>({...m,files:m.files.map(({bytes,...f})=>f)}))});
 return capture;
}
