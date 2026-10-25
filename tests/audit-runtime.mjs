import {test} from 'node:test'
import assert from 'node:assert/strict'
import {installation} from './push/fixture.mjs'
import {auditJourney} from './audit-journey.mjs'
import {runTeamSurfaces} from './team-runtime.mjs'
import {createPortability,readArchive} from '@runeditrun/rer/modules/portability'
import {productPolicy} from '../src/platform/portability-policy.mjs'
import {migrationHistory} from './migration-history.mjs'
import {validateNormalizedArchive} from '../src/platform/storage/archive-validation.mjs'
import {assertContentRoundTrip,assertRestoreAudit} from './archive-content.mjs'

test('NOOK-051 membership revocation, export, erasure and an interrupted step appear in an admin-only filterable log, an erased actor is anonymized with the facts kept, and the log survives archive restore',{timeout:240000},async()=>{
 const app=await installation(async()=>new Response(null,{status:201}),{workerOptions:{assets:{directory:process.cwd()+'/dist/client',binding:'ASSETS',run_worker_first:true}}});let restored
 try{
  const {db,origin}=app,owner={user:app.owner,cookie:app.ownerCookie}
  await fetch(origin+'/setup',{method:'POST',redirect:'manual',headers:{cookie:owner.cookie,origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'})
  // Extend the existing public team journey, including real invitations,
  // cancellation, deactivation and membership decisions, rather than a SQL fixture.
  const team=await runTeamSurfaces({origin,ownerCookie:owner.cookie})
  const room=await app.call('/api/conversations','POST',{name:'Audit fixture welcome',kind:'channel'},owner.cookie)
  const member=await app.invite('AuditReader',room.id)
  const request=async(path,{method='GET',body,cookie=owner.cookie,status=200}={})=>{
   const response=await app.raw(path,method,body,cookie);const raw=await response.text();assert.equal(response.status,status,method+' '+path+': '+raw);return {response,raw,data:response.headers.get('content-type')?.startsWith('application/json')?JSON.parse(raw):undefined}
  }
  const post=(path,body,cookie=owner.cookie,status=200)=>request(path,{method:'POST',body,cookie,status}),get=(path,cookie=owner.cookie,status=200)=>request(path,{cookie,status})
  await auditJourney({post,get,request,owner,member,registered:name=>app.invite(name,room.id),check:async(name,fn)=>fn(),sql:async query=>(await db.prepare(query).all()).results,origin:()=>origin,withoutBrowser:process.argv.includes('--without-browser'),validateArchive:()=>validateNormalizedArchive({read:async table=>(await db.prepare('SELECT * FROM '+table).all()).results}),roundTrip:async({rows})=>{
   // Exercise the active owner's public hosted-export door, then restore into
   // the existing isolated bindings and compare a complete reexport there.
   const id=(await post('/api/portability/exports',{},owner.cookie,201)).data.id
   const records=[];let exported
   try{
    while((await post('/api/portability/exports/'+id+'/advance',{maxParts:16})).data.phase==='building'){}
    exported=(await get('/api/portability/exports/'+id+'/download')).raw
    for await(const record of readArchive(new Blob([exported]).stream()))records.push(record)
   }finally{await post('/api/portability/exports/'+id+'/abort',{})}
   restored=await installation(async()=>{assert.fail('restoring must emit no external effect')},{bootstrap:false})
   const targetPolicy=await productPolicy(restored.db),importer=await createPortability({db:restored.db,buckets:{FILES:await restored.mf.getR2Bucket('FILES')},policy:targetPolicy,migrations:migrationHistory(targetPolicy)}),restoreId=await importer.imports.create(records[0],owner.user.id)
   for(const record of records)if(record.kind==='part')await importer.imports.uploadPart(restoreId,record.index,record)
   const end=records.at(-1),started=Date.now();await importer.imports.finalize(restoreId,{contentHash:end.contentHash,archiveHash:end.archiveHash});const finished=Date.now()
   for(const row of rows){const kept=await restored.db.prepare('SELECT * FROM nook_audit WHERE id=?').bind(row.id).first();assert.ok(kept,row.kind);for(const key of ['actor','at','version','reason','outcome','count'])assert.equal(kept[key],row[key])}
   assert.equal((await restored.db.prepare("SELECT count(*) AS n FROM nook_audit WHERE kind='archive.import.complete' AND outcome='confirmed'").first()).n,1)
   const restore=await restored.db.prepare("SELECT * FROM nook_audit WHERE id=?").bind('archive:'+restoreId+':complete').first()
   assertRestoreAudit(restore,{manifest:records[0],closing:end,actor:owner.user.id,started,finished})
   // A completed finalize is idempotent, including its durable audit event.
   await importer.imports.finalize(restoreId,{contentHash:end.contentHash,archiveHash:end.archiveHash})
   assert.deepEqual(await restored.db.prepare('SELECT * FROM nook_audit WHERE id=?').bind(restore.id).first(),restore)
   assert.equal((await restored.db.prepare("SELECT count(*) AS n FROM nook_audit WHERE kind='archive.import.complete'").first()).n,1)
   await validateNormalizedArchive({read:async table=>(await restored.db.prepare('SELECT * FROM '+table).all()).results})
   assert.equal((await restored.db.prepare('SELECT count(*) AS n FROM oa_sessions').first()).n,0)
   const reexport=await importer.exports.create()
   try{
    while((await importer.exports.advance(reexport,{maxParts:16})).phase==='building'){}
    await assertContentRoundTrip(new Blob([exported]).stream(),await importer.exports.download(reexport))
   }finally{await importer.exports.abort(reexport)}
  }})
 }finally{await restored?.close();await app.close()}
})
