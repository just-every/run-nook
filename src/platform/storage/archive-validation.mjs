import {validatePersonalWorkspace} from '../../personal/archive.mjs';
import {validateReminders} from '../../reminders/archive.mjs';
import {validateBroadcastArchive} from '../../broadcast/archive.mjs';
import {validateSchedules} from '../../scheduled/archive.mjs';
import {conversionArchive} from '../../team/group-conversion-archive.mjs';
import { sourceActorId, sourceFileRefs } from '../../imports/slack-records.mjs';
import {validateRetainedBodies} from '../../team/erasure/retained-archive.mjs';
import {erasureArchiveRead} from '../../team/erasure/archive.mjs';
import {slackArchiveObjects} from '../../imports/archive-objects.mjs';
import {slackArchivePlans} from '../../imports/archive-plan.mjs';
import {validateSlackArchiveRecords} from '../../imports/archive-records.mjs';
import {validateTeamArchive} from '../../team/portability.mjs';
import {validateChannelArchive} from '../../team/channel-archive.mjs';
import {validatePostingArchive} from '../../team/posting-archive.mjs';
import {validateSavedArchive} from '../../team/saved-archive.mjs';
// Offline archive graph validation. Linear indexes replace per-row scans so a
// team's full history can be checked without quadratic work or a workspace cell.
import {importDigest} from '../../family/team-chat/import-capture.mjs';
const check=(ok,code)=>{if(!ok)throw Error(code)};
const integer=(n,min=0)=>Number.isSafeInteger(n)&&n>=min;
const string=s=>typeof s==='string'&&s.length>0;
const time=s=>typeof s==='string'&&Number.isFinite(Date.parse(s));
const tuple=(...parts)=>JSON.stringify(parts);
function index(rows,key,code){const map=new Map();for(const row of rows){const id=key(row);check(!map.has(id),code);map.set(id,row)}return map}
function groups(rows,key){const map=new Map();for(const row of rows){const id=key(row);if(!map.has(id))map.set(id,[]);map.get(id).push(row)}return map}
const deadline=d=>d===null||typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&time(d);
export async function validateNormalizedArchive({read,manifest,db,tables:stagedTables}){
 const rawRead=read;await validateRetainedBodies(rawRead);read=erasureArchiveRead(rawRead);
 const history=await validateTeamArchive({read,manifest});
 const names=['workspace','nook_storage','nook_upload_attempts','nook_object_deletes','nook_actors','nook_conversations','nook_members','nook_messages','nook_revisions','nook_events','nook_author_counts','nook_reads','nook_outcomes','nook_outcome_versions','nook_preferences','nook_thread_follows','nook_thread_unfollows','nook_thread_reads','nook_settings','nook_attention','nook_attachments','nook_imports','nook_import_channels','nook_import_actors','nook_import_records','nook_import_files','nook_import_receipts'];
 const tables={};
 const readTable=async name=>{
  if(tables[name])return tables[name];
  return tables[name]=await read(name);

 };
 for(const name of names)await readTable(name);
 const channelActions=await validateChannelArchive(readTable,{conversations:tables.nook_conversations,actors:tables.nook_actors,events:tables.nook_events});
 const conversions=await conversionArchive(readTable,manifest,tables.nook_conversations,tables.nook_actors,tables.nook_events);
 const rows=name=>tables['nook_'+name];
 check(!tables.workspace.length,'legacy_document_in_normalized_archive');const authority=rows('storage');check(authority.length===1&&authority[0].id===1&&authority[0].authority==='normalized'&&authority[0].phase==='ready','invalid_storage_authority');
 check(!rows('upload_attempts').length&&!rows('object_deletes').length,'reconcile_pending_object_work_before_export');
 const actors=index(rows('actors'),a=>a.id,'duplicate_actor'),conv=index(rows('conversations'),c=>c.id,'duplicate_conversation'),msg=index(rows('messages'),m=>m.id,'duplicate_message'),out=index(rows('outcomes'),o=>o.id,'duplicate_outcome'),files=index(rows('attachments'),a=>a.id,'duplicate_attachment');
 index(rows('actors').filter(a=>!a.erased),a=>a.email,'duplicate_actor_email');for(const a of actors.values())check(a.erased ? string(a.id)&&a.email===null&&a.role===null&&a.active===0 : string(a.id)&&string(a.name)&&a.name.trim()===a.name&&typeof a.email==='string'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email)&&a.email===a.email.toLowerCase()&&['owner','admin','member'].includes(a.role)&&[0,1].includes(a.active),'invalid_product_actor');
 await validatePersonalWorkspace(readTable,manifest,actors,conv);
 await validateDefaultChannels(readTable,manifest,actors,conv);
 await validateReminders(readTable,manifest,actors,conv,msg);
 await validatePostingArchive(readTable,{manifest,actors,conversations:conv,actions:channelActions});
 const scheduledFiles=await validateSchedules(readTable,manifest,{actors,conversations:conv,messages:msg,attachments:files});
 await validateBroadcastArchive(readTable,{manifest,actors,conversations:conv,messages:msg});
 const imported=index(rows('import_records'),r=>r.id,'duplicate_import_record');
 await validateSavedArchive(readTable,{manifest,actors,conversations:conv,messages:msg,imported,attachments:files});
 const notifyRows=manifest?.tables&&!manifest.tables.some(t=>t.name==='nook_conversation_notify')?[]:await readTable('nook_conversation_notify');
 const members=index(rows('members'),m=>tuple(m.conversation,m.user),'duplicate_membership');for(const m of members.values())check(actors.has(m.user)&&conv.has(m.conversation),'invalid_membership');
 // Private/channel membership can change while history remains. Every DM
 // attribution requires its validated fixed roster, even after deactivation
 // or regrant elsewhere removes the participant's current DM access.
 const participant=(cid,user)=>actors.has(user)&&conv.has(cid)&&(conv.get(cid).kind!=='dm'||history.participant(cid,user));
 const events=index(rows('events'),e=>tuple(e.conversation,e.seq),'duplicate_event'),eventGroups=groups(rows('events'),e=>e.conversation),messageGroups=groups(rows('messages'),m=>m.conversation),revisions=groups(rows('revisions'),r=>r.message),authorTotals=new Map();
 index(rows('messages'),m=>tuple(m.conversation,m.author,m.intent),'duplicate_sender_intent');index(rows('revisions'),r=>tuple(r.message,r.version),'duplicate_revision');
 for(const c of conv.values()){
  check(string(c.id)&&string(c.name)&&actors.has(c.owner)&&['channel','private','dm'].includes(c.kind)&&integer(c.seq)&&integer(c.version,1)&&integer(c.message_count),'invalid_conversation');
  check(!actors.get(c.owner).active||members.has(tuple(c.id,c.owner))||history.creator(c.id,c.owner),'invalid_conversation_membership');
  const es=eventGroups.get(c.id)??[];check(es.length===c.seq&&es.every(e=>integer(e.seq,1)&&e.seq<=c.seq),'invalid_event_frontier');
  const ms=(messageGroups.get(c.id)??[]).sort((a,b)=>a.sequence-b.sequence);check(ms.length===c.message_count,'invalid_message_counter');const counts=new Map();
  for(let i=0;i<ms.length;i++){const m=ms[i],own=(counts.get(m.author)??0)+1;counts.set(m.author,own);check(m.ordinal===i+1&&m.author_ordinal===own,'invalid_message_counter')}
  for(const [user,total] of counts)authorTotals.set(tuple(c.id,user),total);
 }
 const storedCounts=index(rows('author_counts'),r=>tuple(r.conversation,r.user),'duplicate_author_count');check(storedCounts.size===authorTotals.size,'invalid_author_counter');for(const [key,total] of authorTotals)check(storedCounts.get(key)?.total===total,'invalid_author_counter');
 for(const m of msg.values()){
  const e=events.get(tuple(m.conversation,m.sequence));check(string(m.id)&&participant(m.conversation,m.author)&&integer(m.version,1)&&[0,1].includes(m.deleted)&&typeof m.body==='string'&&m.body_lower===m.body.toLowerCase()&&time(m.created)&&string(m.intent)&&(m.erased?e?.kind==='erasure'&&/^[a-f0-9]{64}$/.test(m.intent_digest):e?.kind==='message'&&e.object===m.id),'invalid_message');
  if(m.parent){const parent=msg.get(m.parent)??imported.get(m.parent);check(parent?.conversation===m.conversation&&parent.parent===null,'invalid_thread');}
  const rs=(revisions.get(m.id)??[]).sort((a,b)=>a.version-b.version);check(m.erased?rs.length===0:rs.length>0&&rs.at(-1).version===m.version&&rs.at(-1).body===m.body,'message_revision_mismatch');
  if(m.deleted)check(m.body===''&&m.payload==='[erased]'&&rs.every(r=>r.body===''),'deleted_message_retained');else{
   check(rs.length===m.version&&rs.every((r,i)=>r.version===i+1),'missing_message_revision');let p;try{p=JSON.parse(m.payload)}catch{}check(p&&(Object.keys(p).sort().join()==='attachments,body,mentions,parent,urgent,urgentReason'||p.adminOverride===true&&Object.keys(p).sort().join()==='adminOverride,attachments,body,mentions,parent,urgent,urgentReason')&&typeof p.body==='string'&&p.body===rs[0].body&&p.parent===m.parent&&Array.isArray(p.attachments)&&p.attachments.length<=5&&new Set(p.attachments).size===p.attachments.length,'invalid_intent');
   check(Array.isArray(p.mentions)&&p.mentions.length<=50&&new Set(p.mentions).size===p.mentions.length&&p.mentions.every(id=>participant(m.conversation,id))&&typeof p.urgent==='boolean'&&(p.urgent?p.mentions.length&&string(p.urgentReason)&&p.urgentReason.length<=240:p.urgentReason===null),'invalid_intent_attention');
   for(let position=0;position<p.attachments.length;position++){const a=files.get(p.attachments[position]);check(a&&a.message===m.id&&a.conversation===m.conversation&&a.author===m.author&&a.position===position&&['attached','deleted'].includes(a.state),'invalid_ordered_attachment')}
  }
 }
 for(const r of rows('revisions'))check(msg.has(r.message)&&integer(r.version,1)&&r.version<=msg.get(r.message).version&&typeof r.body==='string'&&time(r.at),'invalid_revision');
 const reads=groups(rows('reads'),r=>r.conversation);index(rows('reads'),r=>tuple(r.conversation,r.user),'duplicate_read');
 for(const [cid,rs] of reads){check(conv.has(cid),'invalid_read_conversation');const ms=messageGroups.get(cid)??[],counts=new Map();let n=0;for(const r of rs.sort((a,b)=>a.seq-b.seq)){check(participant(cid,r.user)&&integer(r.seq)&&r.seq<=conv.get(cid).seq,'invalid_read');while(n<ms.length&&ms[n].sequence<=r.seq){const m=ms[n++];counts.set(m.author,(counts.get(m.author)??0)+1)}check(r.total===n&&r.own===(counts.get(r.user)??0),'invalid_read_counter')}}
 for(const mark of await rawRead('nook_erased_assignees'))check(out.has(mark.outcome)&&out.get(mark.outcome).kind==='commitment'&&!out.get(mark.outcome).erased,'invalid_erased_assignee');
 const versions=groups(rows('outcome_versions'),v=>v.outcome);index(rows('outcome_versions'),v=>tuple(v.outcome,v.version),'duplicate_outcome_version');
 for(const o of out.values()){
  if(o.erased){check(string(o.id)&&conv.has(o.conversation)&&['decision','commitment'].includes(o.kind)&&integer(o.version,1)&&['recorded','proposed','accepted','reported-complete','cancelled'].includes(o.status)&&!(versions.get(o.id)?.length),'invalid_erased_outcome');continue;}
  check(string(o.id)&&participant(o.conversation,o.author)&&['decision','commitment'].includes(o.kind)&&typeof o.body==='string'&&integer(o.version,1)&&deadline(o.deadline)&&(o.source_version===null||integer(o.source_version,1)),'invalid_outcome');
  check(o.kind==='decision'?o.assignee===null&&['recorded','cancelled'].includes(o.status):(o.assigneeErased?o.assignee===null:participant(o.conversation,o.assignee))&&['proposed','accepted','reported-complete','cancelled'].includes(o.status),'invalid_outcome_status');
  if(o.source){const m=msg.get(o.source);check(m&&!m.deleted&&m.conversation===o.conversation&&integer(o.source_version,1)&&o.source_version<=m.version,'invalid_source_version')}
  const vs=(versions.get(o.id)??[]).sort((a,b)=>a.version-b.version);check(vs.length===o.version&&vs.every((v,i)=>v.version===i+1),'invalid_outcome_history');const last=vs.at(-1);check(last.body===o.body&&last.status===o.status&&last.deadline===o.deadline,'outcome_history_mismatch');
  for(let i=0;i<vs.length;i++){const v=vs[i],prior=vs[i-1];check((v.erasedAction?v.actor===null&&o.assigneeErased&&['accepted','reported-complete'].includes(v.status):actors.has(v.actor))&&typeof v.body==='string'&&deadline(v.deadline),'invalid_outcome_revision');if(['accepted','reported-complete'].includes(v.status))check(o.kind==='commitment'&&(v.erasedAction?o.assigneeErased:v.actor===o.assignee)&&prior?.status===(v.status==='accepted'?'proposed':'accepted')&&v.body===prior.body&&v.deadline===prior.deadline,'invalid_assignee_acceptance');else check(v.actor===o.author&&(o.kind==='decision'?['recorded','cancelled']:['proposed','cancelled']).includes(v.status),'invalid_author_revision');if(prior)check(!['cancelled','reported-complete'].includes(prior.status),'terminal_outcome_revised')}
 }
 for(const v of rows('outcome_versions'))check(out.has(v.outcome),'orphan_outcome_revision');
 for(const e of events.values()){if(e.kind==='erasure'){check(conv.has(e.conversation)&&e.actor===null&&/^[a-f0-9]{32}$/.test(e.object),'invalid_anonymous_event');continue;}const object=['message','edit','delete','reaction'].includes(e.kind)?msg.get(e.object):e.kind==='outcome'?out.get(e.object):e.kind==='attachment-delete'?files.get(e.object):['membership','access-revoked'].includes(e.kind)?actors.get(e.object):e.kind==='channel'?channelActions.get(e.object):e.kind==='conversion'?conversions.get(e.object+':'+e.conversation):null;check(conv.has(e.conversation)&&object&&(e.kind==='membership'?conv.get(e.conversation).kind!=='dm':e.kind==='access-revoked'?e.actor===e.object&&conv.get(e.conversation).owner===e.actor:object.conversation===e.conversation)&&(['reaction','access-revoked'].includes(e.kind)?participant(e.conversation,e.actor):e.actor===null||participant(e.conversation,e.actor)),'invalid_event_object')}
 index(notifyRows,p=>tuple(p.user,p.conversation),'duplicate_conversation_notify');for(const p of notifyRows)check(Object.keys(p).sort().join()==='conversation,level,threads,user'&&participant(p.conversation,p.user)&&!actors.get(p.user).erased&&(p.level===null||['all','mentions','nothing'].includes(p.level))&&['all','followed'].includes(p.threads),'invalid_conversation_notify');
 index(rows('preferences'),p=>tuple(p.user,p.conversation),'duplicate_preference');for(const p of rows('preferences'))check(participant(p.conversation,p.user)&&[0,1].includes(p.muted)&&[0,1].includes(p.followed),'invalid_preference');
 const threadRoot=(id,user)=>{const root=msg.get(id)??imported.get(id);return root&&root.parent===null&&participant(root.conversation,user)?root:null};
 // The additive archive bridge stages the older columns and restores the new
 // source column using its explicit default. Only that verified old manifest
 // may omit it; a current archive must carry a valid source.
 const oldFollowColumns=manifest?.tables?.find(t=>t.name==='nook_thread_follows')?.columns?.every(c=>c.name!=='source');
 const follows=index(rows('thread_follows'),f=>tuple(f.user,f.message),'duplicate_follow');for(const f of follows.values())check(threadRoot(f.message,f.user)&&['explicit','authored','replied','mentioned','dm'].includes(f.source===undefined&&oldFollowColumns?'explicit':f.source),'invalid_thread_follow');
 index(rows('thread_unfollows'),f=>tuple(f.user,f.message),'duplicate_unfollow');for(const f of rows('thread_unfollows'))check(threadRoot(f.message,f.user)&&!follows.has(tuple(f.user,f.message)),'invalid_thread_unfollow');
 const positions=new Map(rows('messages').map(m=>[tuple(m.conversation,m.sequence),m]));
 index(rows('thread_reads'),r=>tuple(r.user,r.message),'duplicate_thread_read');for(const r of rows('thread_reads')){const root=threadRoot(r.message,r.user),mark=positions.get(tuple(root?.conversation,r.seq));check(root&&integer(r.seq)&&(r.seq===0||mark&&(mark.id===r.message||mark.parent===r.message)),'invalid_thread_read');}
 index(rows('settings'),s=>s.user,'duplicate_settings');for(const s of rows('settings'))check(actors.has(s.user)&&(s.dnd_until===null||integer(s.dnd_until)),'invalid_quiet_deadline');
 index(rows('attention'),a=>a.id,'duplicate_attention');index(rows('attention'),a=>tuple(a.user,a.conversation,a.event_seq),'duplicate_attention_source');for(const a of rows('attention')){const source=a.message?msg.get(a.message):out.get(a.outcome),e=events.get(tuple(a.conversation,a.event_seq));check(string(a.id)&&participant(a.conversation,a.user)&&!!a.message!==!!a.outcome&&source?.conversation===a.conversation&&e?.object===(a.message||a.outcome)&&e.kind===(a.message?'message':'outcome')&&['open','done','snoozed'].includes(a.state)&&(a.state==='snoozed'?integer(a.snooze_until):a.snooze_until===null)&&time(a.created),'invalid_attention');check(a.message?['broadcast','urgent-request','mention','thread-follow','conversation-follow','all-messages'].includes(a.reason):source.kind==='commitment'&&['commitment-proposal','commitment-update'].includes(a.reason),'invalid_attention_reason')}
 const slackReviews=await slackArchiveObjects({read:readTable,manifest},actors,[...files.values(),...scheduledFiles]);
 const slackProofs=await slackArchivePlans(readTable,slackReviews);
 const slackDomains=validateSlackArchiveRecords(slackProofs,tables);
 const slackIntents=new Set(slackReviews.map(review=>review.id));
 const jobs=index(rows('imports'),j=>j.id,'duplicate_import'),channels=index(rows('import_channels'),c=>tuple(c.job,c.source_id),'duplicate_import_channel'),importActors=index(rows('import_actors'),a=>tuple(a.job,a.source_id),'duplicate_import_actor');
 index(rows('imports'),j=>tuple(j.owner,j.intent),'duplicate_import_intent');index(rows('import_channels'),c=>c.conversation,'duplicate_import_destination');index(rows('import_records'),r=>r.key,'duplicate_source_key');index(rows('import_records'),r=>tuple(r.conversation,r.sequence),'duplicate_import_sequence');
 for(const j of jobs.values()){
  check(string(j.id)&&actors.has(j.owner)&&string(j.intent)&&j.state==='complete'&&time(j.created)&&string(j.namespace)&&[j.plan_digest,j.capture_digest,j.preview_digest].every(v=>/^[a-f0-9]{64}$/.test(v)),'invalid_import_job');
  // Slack jobs carry their reviewed plan fingerprint, checked with the Slack records above.
  if(!slackIntents.has(j.intent))check(j.plan_digest===importDigest({policy:'immutable-new-private-v1',owner:j.owner,captureDigest:j.capture_digest}),'invalid_import_plan_digest');
 }
 const sourceObject=s=>{let value;try{value=JSON.parse(s)}catch{}check(value&&typeof value==='object'&&!Array.isArray(value),'invalid_source_record');return value};
 for(const c of channels.values())check(jobs.has(c.job)&&string(c.source_id)&&conv.get(c.conversation)?.kind==='private'&&conv.get(c.conversation).owner===jobs.get(c.job).owner&&sourceObject(c.source_record).id===c.source_id,'invalid_import_channel');
 for(const a of importActors.values())check(jobs.has(a.job)&&string(a.source_id)&&(a.association===null||actors.has(a.association))&&sourceObject(a.source_record).id===a.source_id,'invalid_import_actor');
 const destinations=new Map(rows('import_channels').map(c=>[c.conversation,c]));const importedGroups=groups(rows('import_records'),r=>r.conversation);
 for(const [cid,rs] of importedGroups){check(destinations.has(cid),'invalid_import_destination');rs.sort((a,b)=>a.sequence-b.sequence);check(rs.every((r,i)=>r.sequence===i+1),'invalid_import_sequence')}
 for(const r of imported.values()){if(r.erased){check(jobs.has(r.job)&&destinations.get(r.conversation)?.job===r.job&&conv.has(r.conversation)&&integer(r.sequence,1)&&r.body===''&&(!r.parent||imported.get(r.parent)?.conversation===r.conversation),'invalid_erased_import');continue;}check(string(r.id)&&jobs.has(r.job)&&destinations.get(r.conversation)?.job===r.job&&importActors.has(tuple(r.job,r.source_actor))&&/^\d{1,12}\.\d{6}$/.test(r.source_timestamp)&&string(r.key)&&sourceObject(r.source_record)&&typeof r.body==='string'&&r.body_lower===r.body.toLowerCase(),'invalid_import_record');const source=sourceObject(r.source_record),destination=destinations.get(r.conversation);check(r.key===jobs.get(r.job).namespace+':'+destination.source_id+':'+r.source_timestamp&&source.type==='message'&&(slackDomains.has(r.job)||source.subtype===undefined)&&source.ts===r.source_timestamp&&(source.user===r.source_actor||slackDomains.has(r.job)&&sourceActorId(source)===r.source_actor)&&source.text===r.body,'invalid_import_provenance');if(r.parent)check(imported.get(r.parent)?.conversation===r.conversation&&imported.get(r.parent).parent===null&&source.thread_ts===imported.get(r.parent).source_timestamp,'invalid_import_thread');else check(source.thread_ts===undefined||source.thread_ts===source.ts,'invalid_import_thread')}
 index(rows('import_files'),f=>f.id,'duplicate_import_file');index(rows('import_files'),f=>f.attachment,'duplicate_import_attachment');const sourceBindings=new Map();for(const f of rows('import_files')){const r=imported.get(f.message),a=files.get(f.attachment);check(r&&r.job===f.job&&a&&a.message===r.id&&a.position===f.position&&integer(f.position)&&f.position<5&&string(f.source_id),'invalid_import_file');const source=slackDomains.has(r.job)?sourceFileRefs(sourceObject(r.source_record)).find(source=>source.id===f.source_id):sourceObject(r.source_record).files?.[f.position];check(source&&source.id===f.source_id&&source.name===a.name&&source.mimetype===a.mime&&(source.size===undefined||source.size===a.size),'invalid_import_file_provenance');sourceBindings.set(f.attachment,f)}
 index(rows('import_files'),f=>tuple(f.message,f.position),'duplicate_import_file_position');index(rows('import_receipts'),r=>tuple(r.job,r.path,r.sha256),'duplicate_import_receipt');for(const r of rows('import_receipts'))check(jobs.has(r.job)&&string(r.path)&&integer(r.size)&&/^[a-f0-9]{64}$/.test(r.sha256),'invalid_import_receipt');
 const importFileGroups=groups(rows('import_files'),f=>f.message);for(const r of imported.values()){if(r.erased)continue;const bindings=importFileGroups.get(r.id)??[],sources=slackDomains.has(r.job)?sourceFileRefs(sourceObject(r.source_record)):sourceObject(r.source_record).files??[];check(Array.isArray(sources)&&sources.length<=5&&(slackDomains.has(r.job)||sources.length===bindings.length),'missing_import_file')}
 index(rows('attachments'),a=>tuple(a.author,a.intent),'duplicate_upload_intent');index(rows('attachments').filter(a=>a.object_key!==null),a=>a.object_key,'duplicate_object_key');
 for(const a of files.values()){
  check((!a.erased||/^[a-f0-9]{64}$/.test(a.intent_digest))&&string(a.id)&&participant(a.conversation,a.author)&&['staged','attached','deleted'].includes(a.state)&&integer(a.size)&&integer(a.expires)&&time(a.created)&&string(a.intent),'invalid_attachment');
  const m=msg.get(a.message),r=imported.get(a.message);if(a.message)check(m?.conversation===a.conversation||r?.conversation===a.conversation,'invalid_attachment_binding');if(m)check(m.author===a.author&&(m.deleted?a.state==='deleted':JSON.parse(m.payload).attachments[a.position]===a.id),'invalid_reverse_attachment');if(r&&!r.erased)check(sourceBindings.has(a.id)&&jobs.get(r.job).owner===a.author&&a.state==='attached','invalid_import_attachment');
  check(a.state==='attached'?!!a.message:a.state==='staged'?a.message===null:true,'invalid_attachment_state');
  if(a.state==='deleted')check(a.object_key===null&&a.name===''&&a.mime==='application/octet-stream'&&a.size===0&&a.sha256===null,'deleted_attachment_retained');else check(a.size>=1&&a.size<=25*1024*1024&&string(a.name)&&a.name.length<=120&&a.name.trim()===a.name&&!/[\x00-\x1f\x7f/\\<>:"|?*]/.test(a.name)&&['text/plain','image/png','image/jpeg','application/pdf'].includes(a.mime)&&typeof a.object_key==='string'&&a.object_key.startsWith('private/')&&/^[a-f0-9]{64}$/.test(a.sha256),'invalid_object_metadata');
 }
}
async function validateDefaultChannels(read,manifest,actors,conversations){
 const added=async name=>manifest?.tables&&!manifest.tables.some(table=>table.name===name)?[]:read(name);
 const [policy,defaults,actions,admissions,settings,access]=await Promise.all(['nook_default_policy','nook_default_channels','nook_default_actions','nook_default_admissions','nook_channel_settings','nook_access'].map(added));
 const fields=(row,names)=>Object.keys(row).sort().join()===names.sort().join();
 check(policy.length<=1&&policy.every(row=>fields(row,['id','version'])&&row.id===1&&integer(row.version,1)),'invalid_default_policy');
 const version=policy[0]?.version??0,archived=new Set(settings.filter(row=>row.archived).map(row=>row.conversation)),live=new Map(),seen=new Set(),versions=new Set();
 for(const row of [...actions].sort((a,b)=>a.version-b.version)){
  const key=tuple(row.version,row.conversation);
  check(fields(row,['id','version','conversation','enabled','mandatory','actor','created'])&&string(row.id)&&!seen.has(row.id)&&!seen.has(key)&&integer(row.version,1)&&row.version<=version&&conversations.get(row.conversation)?.kind==='channel'&&[0,1].includes(row.enabled)&&[0,1].includes(row.mandatory)&&(row.enabled||!row.mandatory)&&time(row.created)&&(row.actor===null||actors.has(row.actor)&&!actors.get(row.actor).erased),'invalid_default_action');
  seen.add(row.id);seen.add(key);versions.add(row.version);
  check(row.enabled?live.get(row.conversation)!==row.mandatory:live.has(row.conversation),'redundant_default_action');
  if(row.enabled)live.set(row.conversation,row.mandatory);else live.delete(row.conversation);
 }
 check(versions.size===version,'missing_default_policy_history');
 const configured=new Map();
 for(const row of defaults){check(fields(row,['conversation','mandatory'])&&conversations.get(row.conversation)?.kind==='channel'&&!archived.has(row.conversation)&&[0,1].includes(row.mandatory)&&!configured.has(row.conversation),'invalid_default_channel');configured.set(row.conversation,row.mandatory)}
 check(configured.size<=50&&configured.size===live.size&&[...configured].every(([id,mandatory])=>live.get(id)===mandatory),'default_policy_history_mismatch');
 const grants=new Map(access.map(row=>[row.user,row])),users=new Set();
 for(const row of admissions){const grant=grants.get(row.user);check(fields(row,['user','state'])&&actors.has(row.user)&&!actors.get(row.user).erased&&!users.has(row.user)&&['pending','complete'].includes(row.state)&&(row.state!=='pending'||grant?.mode==='member'&&grant.active===1&&actors.get(row.user).active===1),'invalid_default_admission');users.add(row.user)}
 // Missing old-archive markers retire without joining; identity recovery also
 // retires a pending marker before that person can obtain a fresh session.
}
