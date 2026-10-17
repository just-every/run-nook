import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {recoverNormalized} from '../scripts/storage/recover-identities.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {teamFixture} from './team-sql-support.mjs';
import {createPortability,readArchive,makePart} from '../src/base/modules/portability/index.mjs';
import {ArchiveVerifier,ContentVerifier} from '../src/base/modules/portability/format.mjs';
import {validateTeamArchive} from '../src/team/portability.mjs';
import {slackPortabilityFlow} from './slack-import/portability.mjs';
import {normalizedPortability} from '../src/platform/storage/portability.mjs';
const policy={product:'team-chat/team-workspace',replaceableTables:['schema_migrations','nook_storage'],...normalizedPortability};
const emptyBucket={async list(){return {objects:[],truncated:false}},async get(){return null}};
test('recovery validates current guest scope and fixed DM attribution while preserving deactivated and regranted history',async()=>{
 const f=await teamFixture();try{
  await f.accept(await f.invite('recover@example.test',{mode:'guest',scopes:['review']}));
  const guest=f.db.prepare("SELECT id FROM oa_operators WHERE email='recover@example.test'").get().id;
  const now=new Date().toISOString();
  f.db.prepare("INSERT INTO nook_messages VALUES('m','review',?,'A historical record','a historical record',NULL,1,0,?,'intent',?,1,1,1)").run(guest,now,JSON.stringify({body:'A historical record',parent:null,attachments:[],mentions:[],urgent:false,urgentReason:null}));
  f.db.prepare("INSERT INTO nook_revisions VALUES('m',1,'A historical record',?)").run(now);
  f.db.prepare("UPDATE nook_conversations SET seq=1,message_count=1 WHERE id='review'").run();f.db.prepare("INSERT INTO nook_author_counts VALUES('review',?,1)").run(guest);
  f.db.prepare("INSERT INTO nook_events VALUES('review',1,'message','m',?)").run(guest);
  f.db.prepare("INSERT INTO nook_reactions VALUES('m',?,'👍',?)").run(guest,now);
  f.db.prepare("INSERT INTO nook_events VALUES('review',2,'reaction','m',?)").run(guest);f.db.prepare("UPDATE nook_conversations SET seq=2 WHERE id='review'").run();
  const read=async table=>f.db.prepare('SELECT * FROM '+table).all();
  await validateTeamArchive({read});
  await assert.rejects(validateTeamArchive({read:async table=>table==='nook_guest_grants'?[{user:guest,conversation:'launch'}]:read(table)}),/invalid_guest_scope/);
  await assert.rejects(validateTeamArchive({read:async table=>table==='nook_events'?[...await read(table),{conversation:'launch',kind:'reaction',object:'m'}]:read(table)}),/invalid_reaction_event_scope/);
  assert.equal((await f.call('/auth/operator/status',{operatorId:guest,status:'inactive'},f.ownerCookie)).status,200);
  await validateTeamArchive({read});
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM nook_reactions WHERE user=?').get(guest).n,1);
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM nook_actors WHERE id=?').get(guest).n,1);
  await f.accept(await f.invite('still-scoped@example.test',{mode:'guest',scopes:['review']}));
  const activeOutsider=f.db.prepare("SELECT id FROM oa_operators WHERE email='still-scoped@example.test'").get().id;
  await f.accept(await f.invite('creator@example.test',{scopes:['review']}));
  const creator=f.db.prepare("SELECT id FROM oa_operators WHERE email='creator@example.test'").get().id;
  f.db.prepare("INSERT INTO nook_conversations(id,name,kind,owner) VALUES('old-private','Historical private','private',?),('old-dm','Historical DM','dm',?)").run(creator,creator);
  f.db.prepare("INSERT INTO nook_members VALUES('old-private',?),('old-dm',?),('old-dm',?)").run(creator,creator,f.owner.operatorId);
  f.db.prepare("INSERT INTO nook_dm_roster SELECT conversation,user FROM nook_members WHERE conversation='old-dm'").run();
  f.db.prepare("INSERT INTO nook_messages VALUES('dm-message','old-dm',?,'Retained private work','retained private work',NULL,1,0,?,'dm-intent',?,1,1,1)").run(creator,now,JSON.stringify({body:'Retained private work',parent:null,attachments:[],mentions:[f.owner.operatorId],urgent:false,urgentReason:null}));
  f.db.prepare("INSERT INTO nook_revisions VALUES('dm-message',1,'Retained private work',?)").run(now);
  f.db.prepare("INSERT INTO nook_events VALUES('old-dm',1,'message','dm-message',?)").run(creator);
  f.db.prepare("UPDATE nook_conversations SET seq=1,message_count=1 WHERE id='old-dm'").run();
  f.db.prepare("INSERT INTO nook_author_counts VALUES('old-dm',?,1)").run(creator);
  f.db.prepare("INSERT INTO nook_reads VALUES('old-dm',?,1,1,1)").run(creator);
  f.db.prepare("INSERT INTO nook_preferences VALUES(?,'old-dm',0,1)").run(creator);
  f.db.prepare("INSERT INTO nook_thread_follows(user,message) VALUES(?,'dm-message')").run(creator);
  f.db.prepare("INSERT INTO nook_outcomes VALUES('dm-work','old-dm',?,?,'commitment','Retained commitment','dm-message',1,1,'proposed',NULL)").run(creator,f.owner.operatorId);
  f.db.prepare("INSERT INTO nook_outcome_versions VALUES('dm-work',1,?,'Retained commitment','proposed',NULL)").run(creator);
  f.db.prepare("INSERT INTO nook_events VALUES('old-dm',2,'outcome','dm-work',?)").run(creator);f.db.prepare("UPDATE nook_conversations SET seq=2 WHERE id='old-dm'").run();
  f.db.prepare("INSERT INTO nook_reactions VALUES('dm-message',?,'👍',?)").run(creator,now);
  f.db.prepare("INSERT INTO nook_events VALUES('old-dm',3,'reaction','dm-message',?)").run(creator);f.db.prepare("UPDATE nook_conversations SET seq=3 WHERE id='old-dm'").run();
  f.db.prepare("INSERT INTO nook_attention VALUES('dm-attention',?,'old-dm',1,'dm-message',NULL,'mention','open',NULL,?)").run(f.owner.operatorId,now);
  f.db.prepare("INSERT INTO nook_attachments VALUES('dm-deleted-file','old-dm',?,NULL,'','application/octet-stream',0,NULL,0,'deleted',?,NULL,'dm-upload',NULL)").run(creator,now);
  assert.equal((await f.call('/auth/operator/status',{operatorId:creator,status:'inactive'},f.ownerCookie)).status,200);
  await restoredArchive(await exportedArchive(f),{inspect:target=>{
   assert.equal(target.db.prepare('SELECT active FROM nook_actors WHERE id=?').get(creator).active,0);
   assert.equal(target.db.prepare('SELECT count(*) AS n FROM nook_members WHERE user=?').get(creator).n,0);
   assert.equal(target.db.prepare('SELECT author FROM nook_messages WHERE id=?').get('dm-message').author,creator);
   assert.equal(target.db.prepare('SELECT count(*) AS n FROM nook_dm_roster WHERE user=?').get(creator).n,1);
   assert.equal(target.db.prepare('SELECT count(*) AS n FROM oa_sessions').get().n,0);
   assert.equal(target.db.prepare('SELECT count(*) AS n FROM oa_operators').get().n,0);
  }});
  assert.equal((await f.call('/auth/operator/status',{operatorId:creator,status:'active'},f.ownerCookie)).status,200);
  assert.equal(f.db.prepare('SELECT active FROM nook_actors WHERE id=?').get(creator).active,0);
  // Explicit selected-channel regrant never restores either old private scope.
  f.db.prepare('UPDATE nook_access SET active=1,generation=generation+1 WHERE user=?').run(creator);
  f.db.prepare('UPDATE nook_actors SET active=1 WHERE id=?').run(creator);
  f.db.prepare("INSERT INTO nook_members VALUES('launch',?)").run(creator);
  assert.deepEqual(f.db.prepare('SELECT conversation FROM nook_members WHERE user=?').all(creator).map(r=>r.conversation),['launch']);
  await validateTeamArchive({read});
  await assert.rejects(validateTeamArchive({read:async table=>table==='nook_creator_revocations'?[]:read(table)}),/active_creator_without_membership/);
  await assert.rejects(validateTeamArchive({read:async table=>table==='nook_creator_revocations'?(await read(table)).map(r=>({...r,event_seq:999})):read(table)}),/invalid_creator_revocation/);
  const records=await exportedArchive(f);
  for (const historical of [false,true]) {
   const forged=structuredClone(records),items=forged.flatMap(r=>r.items??[]);
   const conversation='old-dm', additions=[];
   for(let i=0;i<49;i++){
    const user='extra-dm-'+i;
    additions.push({table:'nook_actors',row:{id:user,name:'Extra participant '+i,email:user+'@example.test',role:'member',active:historical?0:1}},{table:'nook_access',row:{user,mode:'member',active:historical?0:1,generation:1}},{table:'nook_dm_roster',row:{conversation,user}});
    if(!historical)additions.push({table:'nook_members',row:{conversation,user}});
   }
   // Update transport inventories and reseal; rejection is the product graph.
   const part=forged.find(r=>r.kind==='part');
   for(const addition of additions){const table=forged[0].tables.find(t=>t.name===addition.table);part.items.push({kind:'row',...addition,index:table.count++})}
   const tableOrder=new Map(forged[0].tables.map((t,i)=>[t.name,i])),ordered=forged.flatMap(r=>r.items??[]).sort((a,b)=>(tableOrder.get(a.table)-tableOrder.get(b.table))||a.index-b.index),parts=forged.filter(r=>r.kind==='part');
   let offset=0;for(const part of parts){const count=part===parts.at(-1)?ordered.length-offset:part.items.length;part.items=ordered.slice(offset,offset+count);offset+=count}
   const verifier=new ContentVerifier(forged[0]),binding=new ArchiveVerifier(forged[0]);
   for(let i=0;i<forged.length;i++)if(forged[i].kind==='part'){forged[i]=await makePart(forged[i].index,forged[i].items);binding.add(forged[i]);for(const item of forged[i].items)verifier.add(item)}
   forged.at(-1).contentHash=verifier.digest();forged.at(-1).archiveHash=binding.digest();
   await restoredArchive(forged,{rejection:/invalid_dm_roster/,label:historical?'oversized historical DM':'oversized active DM'});
  }
  // Reseal each real Base export so the public reader and import staging accept
  // the transport. Only product graph validation can refuse these at finalize.
  for(const [status,outsider] of [['inactive',guest],['active',activeOutsider]]){
   assert.equal(f.db.prepare('SELECT count(*) AS n FROM nook_dm_roster WHERE user=?').get(outsider).n,0);
   for(const [name,rejection,mutate] of [
    ['message author',/invalid_message/,(row)=>{row('nook_messages').author=outsider;row('nook_author_counts').user=outsider;row('nook_reads').own=0;row('nook_events',r=>r.kind==='message').actor=outsider}],
    ['mention',/invalid_intent_attention/,(row)=>{const m=row('nook_messages'),payload=JSON.parse(m.payload);payload.mentions=[outsider];m.payload=JSON.stringify(payload)}],
    ['read',/invalid_read/,(row)=>Object.assign(row('nook_reads'),{user:outsider,own:0})],
    ['preference',/invalid_preference/,(row)=>{row('nook_preferences').user=outsider}],
    ['thread follow',/invalid_thread_follow/,(row)=>{row('nook_thread_follows').user=outsider}],
    ['outcome author',/invalid_outcome/,(row)=>{row('nook_outcomes').author=outsider;row('nook_outcome_versions').actor=outsider;row('nook_events',r=>r.kind==='outcome').actor=outsider}],
    ['outcome assignee',/invalid_outcome_status/,(row)=>{row('nook_outcomes').assignee=outsider}],
    ['event actor',/invalid_event_object/,(row)=>{row('nook_events',r=>r.kind==='message').actor=outsider}],
    ['reaction',/invalid_event_object/,(row)=>{row('nook_reactions').user=outsider;row('nook_events',r=>r.kind==='reaction').actor=outsider}],
    ['attachment author',/invalid_attachment/,(row)=>{row('nook_attachments').author=outsider}],
    ['attention recipient',/invalid_attention/,(row)=>{row('nook_attention').user=outsider}],
   ]){
    const forged=structuredClone(records),items=forged.flatMap(record=>record.items??[]);
    const row=(table,select=()=>true)=>{
     const found=items.find(item=>item.kind==='row'&&item.table===table&&(item.row.conversation==='old-dm'||item.row.message==='dm-message'||item.row.outcome==='dm-work')&&select(item.row));
     assert.ok(found,'missing DM fixture for '+table);return found.row;
    };
    mutate(row);const verifier=new ContentVerifier(forged[0]),binding=new ArchiveVerifier(forged[0]);
    for(let i=0;i<forged.length;i++)if(forged[i].kind==='part'){forged[i]=await makePart(forged[i].index,forged[i].items);binding.add(forged[i]);for(const item of forged[i].items)verifier.add(item)}
    forged.at(-1).contentHash=verifier.digest();forged.at(-1).archiveHash=binding.digest();
    await restoredArchive(forged,{rejection,label:status+' outsider '+name});
   }
  }
  await restoredArchive(records,{inspect:async target=>{
   assert.equal(target.db.prepare('SELECT count(*) AS n FROM oa_sessions').get().n,0);assert.equal(target.db.prepare('SELECT count(*) AS n FROM oa_operators').get().n,0);
   assert.equal(target.db.prepare('SELECT count(*) AS n FROM nook_reactions WHERE user=?').get(guest).n,1);assert.equal(target.db.prepare('SELECT active FROM nook_access WHERE user=?').get(guest).active,0);
   assert.equal(target.db.prepare('SELECT count(*) AS n FROM nook_guest_grants').get().n,1);assert.equal(target.db.prepare('SELECT count(*) AS n FROM nook_invite_plans').get().n,0);
   assert.deepEqual(target.db.prepare('SELECT conversation FROM nook_members WHERE user=?').all(creator).map(r=>r.conversation),['launch']);
   assert.equal(target.db.prepare('SELECT count(*) AS n FROM nook_creator_revocations WHERE user=?').get(creator).n,2);
   assert.equal(target.db.prepare('SELECT count(*) AS n FROM nook_dm_roster WHERE user=?').get(creator).n,1);
   assert.equal(target.db.prepare('SELECT author FROM nook_messages WHERE id=?').get('dm-message').author,creator);
   assert.equal(target.db.prepare('SELECT user FROM nook_reactions WHERE message=?').get('dm-message').user,creator);
   assert.equal(target.db.prepare('SELECT author FROM nook_attachments WHERE id=?').get('dm-deleted-file').author,creator);
   const directory=mkdtempSync(join(tmpdir(),'nook-team-recovery-'));
   try{
    const source=join(directory,'source.sqlite'),destination=join(directory,'recovered.sqlite');target.db.prepare('VACUUM INTO ?').run(source);
    const retained=target.db.prepare('SELECT * FROM nook_actors').all();await recoverNormalized(source,destination,{owner:f.owner.operatorId,users:retained.map(a=>({id:a.id,email:a.email,role:a.role}))});
    const recovered=new DatabaseSync(destination);try{
     assert.equal(recovered.prepare('SELECT count(*) AS n FROM oa_sessions').get().n,0);
     assert.equal(recovered.prepare('SELECT status FROM oa_operators WHERE id=?').get(guest).status,'inactive');
     assert.deepEqual(recovered.prepare('SELECT conversation FROM nook_members WHERE user=?').all(creator).map(r=>r.conversation),['launch']);
     assert.equal(recovered.prepare('SELECT count(*) AS n FROM nook_guest_grants').get().n,1);
    }finally{recovered.close()}
   }finally{rmSync(directory,{recursive:true,force:true})}
  }});
  await slackPortabilityFlow({exportedArchive,restoredArchive});
 }finally{f.close()}
});

async function exportedArchive(f,bucket=emptyBucket){
 const exporter=await createPortability({db:f.adapter,buckets:{FILES:bucket},policy}),exportId=await exporter.exports.create();
 try{
  while((await exporter.exports.advance(exportId,{maxParts:16})).phase==='building'){}
  const records=[];for await(const record of readArchive(await exporter.exports.download(exportId)))records.push(record);return records;
 }finally{await exporter.exports.abort(exportId)}
}
async function restoredArchive(records,{inspect,rejection,label,bucket=emptyBucket}={}){
 const target=await teamFixture({bootstrap:false});try{
  const importer=await createPortability({db:target.adapter,buckets:{FILES:bucket},policy});let importId,closing;
  const source=new Blob([records.map(record=>JSON.stringify(record)).join('\n')+'\n']).stream();
  for await(const record of readArchive(source)){if(record.kind==='manifest')importId=await importer.imports.create(record);else if(record.kind==='part')await importer.imports.uploadPart(importId,record.index,record);else closing=record}
  const finalize=()=>importer.imports.finalize(importId,{contentHash:closing.contentHash,archiveHash:closing.archiveHash});
  if(rejection){
   await assert.rejects(finalize,rejection,label);
   for(const table of ['nook_messages','nook_actors','nook_members','nook_import_records','nook_imports','nook_import_reviews','ik_jobs','oa_operators','oa_sessions'])assert.equal(target.db.prepare('SELECT count(*) AS n FROM '+table).get().n,0,label+' changed '+table);
   await importer.imports.abort(importId);
  }else{await finalize();await inspect(target)}
 }finally{target.close()}
}
