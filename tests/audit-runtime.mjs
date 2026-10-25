import {test} from 'node:test'
import assert from 'node:assert/strict'
import {installation} from './push/fixture.mjs'
import {auditJourney} from './audit-journey.mjs'
import {runTeamSurfaces} from './team-runtime.mjs'
import {createPortability,readArchive} from '@runeditrun/rer/modules/portability'
import {productPolicy} from '../src/platform/portability-policy.mjs'
import {migrationHistory} from './migration-history.mjs'
import {validateNormalizedArchive} from '../src/platform/storage/archive-validation.mjs'

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
   const response=await app.raw(path,method,body,cookie);const raw=await response.text();assert.equal(response.status,status,method+' '+path+': '+raw);return {response,raw,data:response.headers.get('content-type')?.includes('json')?JSON.parse(raw):undefined}
  }
  const post=(path,body,cookie=owner.cookie,status=200)=>request(path,{method:'POST',body,cookie,status}),get=(path,cookie=owner.cookie,status=200)=>request(path,{cookie,status})
  await auditJourney({post,get,request,owner,member,registered:name=>app.invite(name,room.id),check:async(name,fn)=>fn(),sql:async query=>(await db.prepare(query).all()).results,origin:()=>origin,withoutBrowser:process.argv.includes('--without-browser'),validateArchive:()=>validateNormalizedArchive({read:async table=>(await db.prepare('SELECT * FROM '+table).all()).results}),roundTrip:async({rows})=>{
   const policy=await productPolicy(db),service=await createPortability({db,buckets:{FILES:await app.mf.getR2Bucket('FILES')},policy}),id=await service.exports.create()
   const records=[];try{while((await service.exports.advance(id,{maxParts:16})).phase==='building'){};for await(const record of readArchive(await service.exports.download(id)))records.push(record)}finally{await service.exports.abort(id)}
   restored=await installation(async()=>{assert.fail('restoring must emit no external effect')},{bootstrap:false})
   const targetPolicy=await productPolicy(restored.db),importer=await createPortability({db:restored.db,buckets:{FILES:await restored.mf.getR2Bucket('FILES')},policy:targetPolicy,migrations:migrationHistory(targetPolicy)}),restoreId=await importer.imports.create(records[0])
   for(const record of records)if(record.kind==='part')await importer.imports.uploadPart(restoreId,record.index,record)
   const end=records.at(-1);await importer.imports.finalize(restoreId,{contentHash:end.contentHash,archiveHash:end.archiveHash})
   for(const row of rows){const kept=await restored.db.prepare('SELECT * FROM nook_audit WHERE id=?').bind(row.id).first();assert.ok(kept,row.kind);for(const key of ['actor','at','version','reason','outcome','count'])assert.equal(kept[key],row[key])}
   // A restore adds no audit row of its own, so a re-export carries the archived content unchanged.
   assert.equal((await restored.db.prepare('SELECT count(*) AS n FROM nook_audit').first()).n,records[0].tables.find(table=>table.name==='nook_audit').count)
   assert.equal((await restored.db.prepare('SELECT count(*) AS n FROM oa_sessions').first()).n,0)
  }})
 }finally{await restored?.close();await app.close()}
})
