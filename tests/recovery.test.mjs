import {test} from 'node:test'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
import {mkdtempSync,writeFileSync,existsSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {rootV3,rootArchive} from './historical-fixtures.mjs'
import {mapSQLiteArchive,unpack,envelope} from '../src/family/team-chat/archive-policy.mjs'
import {restore} from '../scripts/archive.mjs'
import {source} from './import-fixture.mjs'
import {captureImport} from '../scripts/import-preview.mjs'
import {importPlan,applyImport} from '../src/family/team-chat/imports.mjs'

// Remap the whole relationship graph, including serialized original intent.
// A checksum-correct graph must not make a malformed resource reachable by accident.
function renamedIdentity(state,previous,next){
 const walk=value=>value===previous?next:Array.isArray(value)?value.map(walk):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,v])=>[key,walk(v)])):value
 const result=walk(state)
 for(const m of result.messages)if(!m.deleted)m.payload=JSON.stringify(walk(JSON.parse(m.payload)))
 return result
}

// Exercise the operator recovery door with separately authored historical SQL rows.
test('historical root v1-v4 and native v2-v3 recover identity, provenance and session exclusion',()=>{
 const dir=mkdtempSync(join(tmpdir(),'nook-archive-'))
 try{
  const {rows,ra,rb}=rootV3(),s=unpack(mapSQLiteArchive(rootArchive(3,rows))).state
  const fixture=source(dir,ra.id,rb.id),capture=captureImport(fixture.dir,fixture.mapping,fixture.supplied),plan=importPlan(s,ra,capture),input={capture,intent:'historical-import',planDigest:plan.planDigest},receipt=applyImport(s,ra,input),job=s.imports[0]
  // Serialize the independent legacy ledger6 relational shape, including exact IDs.
  const legacy={...rows,conversations:[...rows.conversations,...s.conversations.filter(c=>c.id===receipt.channels[0].id).map(({members,...c})=>c)],members:[...rows.members,...capture.channels[0].audience.map(user=>({conversation:receipt.channels[0].id,user}))],migrations:[1,2,3,4,5,6].map(version=>({version})),history_imports:[{id:job.id,owner:ra.id,intent:job.intent,source_namespace:capture.sourceNamespace,preview_digest:capture.previewDigest,capture_digest:job.captureDigest,plan_digest:job.planDigest,source_receipts:JSON.stringify(capture.sourceReceipts),created:job.created}],imported_channels:job.channels.map(c=>{const src=capture.channels.find(x=>x.sourceId===c.sourceId);return {job:job.id,source_id:c.sourceId,conversation:c.id,destination_name:src.destinationName,audience:JSON.stringify(src.audience),source_record:JSON.stringify(src.sourceRecord)}}),imported_actors:capture.actors.map(a=>({job:job.id,source_id:a.sourceId,association:a.association,source_record:JSON.stringify(a.sourceRecord)})),imported_records:job.records.map(r=>{const src=capture.records.find(x=>x.key===r.key);return {id:r.id,job:job.id,conversation:receipt.channels[0].id,source_key:r.key,source_channel:src.channel,source_actor:src.sourceActor,source_timestamp:src.sourceTimestamp,thread_root:src.threadRoot,body:src.body,source_record:JSON.stringify(src.sourceRecord),files:JSON.stringify(src.files)}}),imported_files:job.files.map(f=>{const src=capture.files.find(x=>x.sourceId===f.sourceId);return {id:f.id,job:job.id,conversation:receipt.channels[0].id,message:job.records.find(r=>r.key===f.message).id,source_id:f.sourceId,name:src.name,mime:src.mime,size:src.size,sha256:src.sha256,data:src.data}})}
  const recovered=unpack(mapSQLiteArchive(rootArchive(4,legacy)));assert.deepEqual(applyImport(recovered.state,ra,input),receipt);assert.deepEqual(recovered.state.sessions,[])
  const restored=join(dir,'v4.sqlite'),ar=join(dir,'v4.json');writeFileSync(ar,JSON.stringify(envelope(recovered)));restore(ar,restored);assert.throws(()=>restore(ar,restored),/must not exist/)
  for(const version of [1,2,3]){const r=structuredClone(rows);if(version<3){for(const k of ['preferences','thread_follows','user_settings','attention'])delete r[k];r.migrations=r.migrations.slice(0,version===1?1:4);for(const m of r.messages){const p=JSON.parse(m.payload);delete p.mentions;delete p.urgent;delete p.urgentReason;m.payload=JSON.stringify(p)}}if(version===1){r.attachments=[];for(const m of r.messages){const p=JSON.parse(m.payload);delete p.attachments;m.payload=JSON.stringify(p)}delete r.attachments;for(const o of r.outcomes){delete o.deadline;delete o.source_version}for(const o of r.outcome_versions)delete o.deadline}const p=unpack(mapSQLiteArchive(rootArchive(version,r)));assert.equal(p.state.messages[0].id,rows.messages[0].id);assert.deepEqual(p.state.imports,[])}
  for(const version of [2,3]){const p=unpack(mapSQLiteArchive(rootArchive(3,rows)));p.schemaVersion=version;p.state.schemaVersion=version;p.ledger=p.ledger.slice(0,version);p.d1Migrations=p.d1Migrations.slice(0,version);delete p.state.imports;if(version===2){for(const k of ['preferences','thread_follows','user_settings','attention'])delete p.state[k];for(const m of p.state.messages){const q=JSON.parse(m.payload);delete q.mentions;delete q.urgent;delete q.urgentReason;m.payload=JSON.stringify(q)}}const raw=JSON.stringify(p),a={...rootArchive(version,p),format:'team-chat-d1'};const next=unpack(a);assert.equal(next.state.messages[0].id,rows.messages[0].id);assert.deepEqual(next.state.imports,[])}
  const quota=structuredClone(recovered),bytes=Buffer.alloc(1024*1024,65),data=bytes.toString('base64'),sha256=createHash('sha256').update(bytes).digest('hex')
  quota.state.attachments=[]
  // Remove the old live attachment intent before replacing it with genuine staged bytes.
  const live=quota.state.messages.find(m=>m.id==='legacy-urgent'),payload=JSON.parse(live.payload);payload.attachments=[];live.payload=JSON.stringify(payload)
  for(let i=0;i<16;i++)quota.state.attachments.push({id:'quota-'+i,conversation:rows.conversations[0].id,author:ra.id,message:null,name:'quota.txt',mime:'text/plain',size:bytes.length,sha256,data,state:'staged',created:new Date().toISOString(),expires:Date.now()+86400000})
  const over=join(dir,'combined-quota.json'),target=join(dir,'combined-quota.sqlite');writeFileSync(over,JSON.stringify(envelope(quota)));assert.throws(()=>restore(over,target),/media quota/);assert.equal(existsSync(target),false)
  for(const change of [r=>r.imported_records[0].body='forged',r=>r.history_imports[0].plan_digest='0'.repeat(64),r=>r.imported_files[0].conversation='foreign',r=>r.imported_actors.push({...r.imported_actors[0],job:'orphan'})]){const r=structuredClone(legacy);change(r);assert.throws(()=>mapSQLiteArchive(rootArchive(4,r)))}
 }finally{rmSync(dir,{recursive:true,force:true})}
})
test('rehashed graph, media, attention and provenance reject before creating a target',()=>{
 const dir=mkdtempSync(join(tmpdir(),'nook-reject-'))
 try{const {rows,ra,rb}=rootV3(),original=unpack(mapSQLiteArchive(rootArchive(3,rows)))
 const fixture=source(dir,ra.id,rb.id),capture=captureImport(fixture.dir,fixture.mapping,fixture.supplied),plan=importPlan(original.state,ra,capture)
 applyImport(original.state,ra,{capture,intent:'recovery-identities',planDigest:plan.planDigest})
 const reject=(payload,label)=>{const ar=join(dir,label+'.json'),target=join(dir,label+'.sqlite');writeFileSync(ar,JSON.stringify(envelope(payload)));assert.throws(()=>restore(ar,target),undefined,label);assert.equal(existsSync(target),false,label+' must reject before target creation')}
 const s=original.state,j=s.imports[0],identities=[s.users[0].id,s.conversations[0].id,s.messages[0].id,s.outcomes[0].id,s.attachments[0].id,s.attention[0].id,j.id,j.channels[0].id,j.records[0].id,j.files[0].id]
 const malformed=[42,true,null,'',' padded','padded ','two words','path/segment','path\\segment','query?x','fragment#x','encoded%2Fid','ambiguous|id','.','..','control\0id','control\u007fid','control\u0085id','control\u202eid','\ud800']
 for(const [i,id]of identities.entries())for(const [k,value]of malformed.entries())reject({...original,state:renamedIdentity(s,id,value)},'identity-'+i+'-'+k)
 for(const [i,change]of [s=>{s.messages[0].parent=false;const p=JSON.parse(s.messages[0].payload);p.parent=false;s.messages[0].payload=JSON.stringify(p)},s=>s.outcomes[0].source=false,s=>s.attention.at(-1).message=false].entries()){const p=structuredClone(original);change(p.state);reject(p,'nullable-'+i)}
 // Historic opaque/composite names remain recoverable; admission does not demand UUIDs.
 for(const id of ['42','historic.channel_42','historic:channel:42']){const p={...original,state:renamedIdentity(s,s.conversations[0].id,id)},ar=join(dir,'supported-'+id.replaceAll(':','-')+'.json'),target=ar+'.sqlite';writeFileSync(ar,JSON.stringify(envelope(p)));restore(ar,target);assert.ok(existsSync(target))}
 // The offline door observes the same physical document capacity as native writes.
 const capacity=structuredClone(original),bytes=Buffer.alloc(1048576,65),data=bytes.toString('base64'),sha256=createHash('sha256').update(bytes).digest('hex')
 const staged=id=>({id,conversation:s.conversations[0].id,author:ra.id,message:null,name:'capacity.txt',mime:'text/plain',data,size:bytes.length,sha256,state:'staged',created:new Date().toISOString(),expires:Date.now()+86400000})
 capacity.state.attachments.push(staged('capacity-first'))
 const one=join(dir,'one-file.json'),target=join(dir,'one-file.sqlite');writeFileSync(one,JSON.stringify(envelope(capacity)));restore(one,target);assert.ok(existsSync(target))
 capacity.state.attachments.push(staged('capacity-second'));reject(capacity,'document-capacity')
 for(const [i,change]of [s=>s.conversations[0].seq++,s=>s.messages[1].parent=s.messages[2].id,s=>s.attachments[0].author=s.users[1].id,s=>s.attachments[0].data='Zm9yZ2Vk',s=>s.attachments[0].state='staged',s=>{const p=JSON.parse(s.messages[2].payload);p.attachments.push('missing');s.messages[2].payload=JSON.stringify(p)},s=>s.attention[0].event_seq=2,s=>s.user_settings[0].dnd_until=1.5,s=>s.user_settings[0].dnd_until='future',s=>s.reads.push({conversation:s.conversations[0].id,user:s.users[0].id,seq:999})].entries()){const p=structuredClone(original);change(p.state);const ar=join(dir,i+'.json'),target=join(dir,i+'.sqlite');writeFileSync(ar,JSON.stringify(envelope(p)));assert.throws(()=>restore(ar,target));assert.equal(existsSync(target),false)}
 for(const value of [null,0,1]){const p=structuredClone(original);p.state.user_settings[0].dnd_until=value;const ar=join(dir,'valid-'+value),target=ar+'.sqlite';writeFileSync(ar,JSON.stringify(envelope(p)));restore(ar,target);assert.ok(existsSync(target))}
 }finally{rmSync(dir,{recursive:true,force:true})}
})
