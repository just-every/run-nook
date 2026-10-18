import test from 'node:test'
import assert from 'node:assert/strict'
import {teamFixture} from './team-sql-support.mjs'
import {migrationHistory} from './migration-history.mjs'
import {createPortability,readArchive} from '../src/base/modules/portability/index.mjs'
import {normalizedPortability} from '../src/platform/storage/portability.mjs'
import {readableExportExcludedTables,validateReadableExportArchive} from '../src/exit/archive.mjs'
import {erasureArchiveRead} from '../src/team/erasure/archive.mjs'

const bucket={async list(){return {objects:[],truncated:false}},async get(){return null}}
const policy={...normalizedPortability,product:'team-chat/team-workspace',replaceableTables:['schema_migrations','nook_storage'],excludeTables:[...new Set([...normalizedPortability.excludeTables,...readableExportExcludedTables])],async validateStaged(input){
 await normalizedPortability.validateStaged(input)
 const read=erasureArchiveRead(input.read),actors=new Map((await read('nook_actors')).map(actor=>[actor.id,actor])),conversations=new Map((await read('nook_conversations')).map(conversation=>[conversation.id,conversation]))
 await validateReadableExportArchive(read,input.manifest,actors,conversations)
}}
async function exported(f){
 const service=await createPortability({db:f.adapter,buckets:{FILES:bucket},policy}),id=await service.exports.create()
 try{while((await service.exports.advance(id,{maxParts:16})).phase==='building'){}const records=[];for await(const record of readArchive(await service.exports.download(id)))records.push(record);return records}finally{await service.exports.abort(id)}
}
async function restore(target,records){
 const service=await createPortability({db:target.adapter,buckets:{FILES:bucket},policy,migrations:migrationHistory(policy)}),id=await service.imports.create(records[0])
 try{for(const record of records)if(record.kind==='part')await service.imports.uploadPart(id,record.index,record);await service.imports.finalize(id,{contentHash:records.at(-1).contentHash,archiveHash:records.at(-1).archiveHash})}catch(error){await service.imports.abort(id);throw error}
}
test('operational restore preserves the membership journal exactly, drops live export jobs, and rejects a contradictory membership history',async()=>{
 const source=await teamFixture(),target=await teamFixture({bootstrap:false}),badTarget=await teamFixture({bootstrap:false})
 try{
  await source.accept(await source.invite('journal-peer@example.test'))
  const peer=source.db.prepare("SELECT id FROM nook_actors WHERE email='journal-peer@example.test'").get().id
  source.db.prepare("INSERT INTO nook_members VALUES('review',?)").run(peer)
  source.db.prepare("DELETE FROM nook_members WHERE conversation='review' AND user=?").run(peer)
  source.db.prepare("INSERT INTO nook_exit_jobs(id,owner,scope,created,state,identity_revision,cursor_json) VALUES('live-exit',?,'permitted',?,'running',0,?)").run(source.owner.operatorId,new Date().toISOString(),JSON.stringify({dataset:0,after:''}))
  source.db.prepare("INSERT INTO nook_exit_scopes VALUES('live-exit','launch',0)").run()
  const before=source.db.prepare('SELECT * FROM nook_exit_membership ORDER BY seq').all(),archive=await exported(source)
  await restore(target,archive)
  assert.deepEqual(target.db.prepare('SELECT * FROM nook_exit_membership ORDER BY seq').all(),before,'restore fires no synthetic join/leave triggers')
  assert.equal(target.db.prepare('SELECT count(*) AS n FROM nook_exit_jobs').get().n,0,'live export job authority does not survive recovery')
  assert.ok(target.db.prepare('SELECT revision FROM nook_exit_clock WHERE id=1').get(),'the migration-seeded clock remains ready for new jobs')
  assert.equal(target.db.prepare('SELECT count(*) AS n FROM nook_exit_changes').get().n,0,'derived source epochs are not replayed as live activity')
  const reexport=await exported(target)
  const journalRows=records=>records.filter(r=>r.kind==='part').flatMap(r=>r.items).filter(item=>item.kind==='row'&&item.table==='nook_exit_membership').map(item=>item.row)
  assert.deepEqual(journalRows(reexport),journalRows(archive))
  source.db.prepare("INSERT INTO nook_exit_membership(conversation,user,action,at) VALUES('launch',?,'leave',?)").run(peer,new Date().toISOString())
  await assert.rejects(restore(badTarget,await exported(source)),/invalid_readable_export_membership_archive/)
  assert.equal(badTarget.db.prepare('SELECT count(*) AS n FROM nook_members').get().n,0,'invalid journal publishes no restored membership')
  // A pre-feature archive provides no journal: its current members remain
  // separate facts and no invented join row is demanded or synthesized.
  await validateReadableExportArchive(name=>name==='nook_members'?[{conversation:'legacy',user:'peer'}]:[],{tables:[{name:'nook_members'}]},new Map([['peer',{}]]),new Map([['legacy',{}]]))
 }finally{source.close();target.close();badTarget.close()}
})
