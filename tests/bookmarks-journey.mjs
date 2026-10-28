import {test} from 'node:test'
import assert from 'node:assert/strict'
import {installation,until} from './push/fixture.mjs'
import {createPortability,readArchive} from '@runeditrun/rer/modules/portability'
import {productPolicy} from '../src/platform/portability-policy.mjs'
import {migrationHistory} from './migration-history.mjs'
import {bookmarksBrowser} from './bookmarks-browser.mjs'

// NOOK-118 channel bookmarks through the real Worker, local D1 and the archive service. No outbound edge exists: any send fails the test.
test('NOOK-118 a channel bookmarks bar is added to, reordered and trimmed by members who may post, refuses a guest and an announcement-only member, checks file access at read, audits each change, and exports, restores and erases with its channel',{timeout:240000},async()=>{
 const app=await installation(async()=>new Response(null,{status:201}),{workerOptions:{assets:{directory:process.cwd()+'/dist/client',binding:'ASSETS',run_worker_first:true}}}),{call,db,ownerCookie,origin}=app;let restore
 try{
  const room=await call('/api/conversations','POST',{name:'Launch bookmarks',kind:'private'},ownerCookie),other=await call('/api/conversations','POST',{name:'Other bookmarks',kind:'private'},ownerCookie)
  const ana=await app.invite('Ana-Mark',room.id),lee=await app.invite('Lee-Mark',room.id),guest=await app.invite('Guest-Mark',room.id,'guest'),outsider=await app.invite('Morgan-Mark',other.id)
  const path=`/api/channels/${room.id}/bookmarks`,read=who=>call(path,'GET',undefined,who.cookie??who),add=(body,who=ana,status=200)=>call(path,'POST',body,who.cookie,status)
  const audit=async()=>(await db.prepare("SELECT kind,count,version,actor FROM nook_audit WHERE service='bookmarks' ORDER BY at,rowid").all()).results
  const uploaded=await fetch(origin+`/api/conversations/${room.id}/attachments`,{method:'POST',headers:{cookie:ana.cookie,Origin:origin,'Content-Type':'text/plain','X-Filename':encodeURIComponent('Launch plan.txt'),'X-Upload-Intent':crypto.randomUUID()},body:'Launch checklist bytes'});assert.equal(uploaded.status,200)
  const file=await uploaded.json()
  const message=await call(`/api/conversations/${room.id}/messages`,'POST',{body:'The plan is attached',intent:crypto.randomUUID(),attachments:[file.id]},ana.cookie)

  // Members who may post add a link, a file and a folder; each change writes one audit row in its batch.
  assert.deepEqual((await read(ana)).items,[]);assert.equal((await read(ana)).canManage,true)
  await add({kind:'link',title:'Launch brief',url:'https://docs.example.test/launch-brief'})
  await add({kind:'file',title:'Launch plan',file:file.id},lee)
  let state=await add({kind:'folder',title:'Customer material'})
  const folder=state.items.find(i=>i.kind==='folder')
  state=await add({kind:'link',title:'FAQ',url:'https://docs.example.test/faq',parent:folder.id})
  assert.deepEqual(state.items.map(i=>i.title),['Launch brief','Launch plan','Customer material','FAQ'])
  assert.deepEqual((await audit()).map(r=>r.kind),['bookmark.add','bookmark.add','bookmark.add','bookmark.add'])
  assert.ok((await audit()).every((row,index,all)=>row.version===index+1&&row.actor!==null),'one versioned audit row per change')
  await add({kind:'link',title:'Bad',url:'javascript:alert(1)'},ana,400);await add({kind:'link',title:'Bad',url:'https://u:p@docs.example.test/'},ana,400);await add({kind:'file',title:'Nope',file:crypto.randomUUID()},ana,404);await add({kind:'folder',title:'Nested',parent:folder.id},ana,400);await add({kind:'link',title:'x',url:'https://a.example.test/',extra:1},ana,400)

  // A link is stored text: reading a link bookmark makes no outbound request (the harness edge fails any send).
  assert.equal(state.items.find(i=>i.title==='Launch brief').url,'https://docs.example.test/launch-brief')

  // Reorder is versioned: a stale order, a partial order and a foreign id are refused and change nothing.
  const top=state.items.filter(i=>!i.parent).map(i=>i.id),reversed=[...top].reverse()
  await call(path,'PATCH',{version:state.version-1,parent:null,order:reversed},ana.cookie,409)
  await call(path,'PATCH',{version:state.version,parent:null,order:reversed.slice(1)},ana.cookie,409)
  await call(path,'PATCH',{version:state.version,parent:null,order:[...reversed.slice(1),crypto.randomUUID()]},ana.cookie,409)
  assert.deepEqual((await read(ana)).items.filter(i=>!i.parent).map(i=>i.id),top,'refused reorders change nothing')
  state=await call(path,'PATCH',{version:state.version,parent:null,order:reversed},ana.cookie);assert.deepEqual(state.items.filter(i=>!i.parent).map(i=>i.id),reversed)
  await call(path,'PATCH',{version:state.version-1,parent:null,order:top},lee.cookie,409)

  // A guest and an announcement-only member read the bar and are refused every change, with nothing written.
  const audited=(await audit()).length
  assert.equal((await read(guest)).canManage,false);assert.equal((await read(guest)).items.length,4)
  await add({kind:'link',title:'Guest link',url:'https://docs.example.test/guest'},guest,403);await call(path,'PATCH',{version:state.version,parent:null,order:top},guest.cookie,403);await call(`${path}/${state.items[0].id}`,'DELETE',{},guest.cookie,403)
  const version=async()=>(await call(`/api/channels/${room.id}/details`,'GET',undefined,ownerCookie)).version
  await call(`/api/channels/${room.id}/posting`,'PATCH',{version:await version(),level:'admins',replies:'same',people:[]},ownerCookie)
  assert.equal((await read(lee)).canManage,false)
  await add({kind:'link',title:'Held link',url:'https://docs.example.test/held'},lee,403);await call(`${path}/${state.items[0].id}`,'DELETE',{},lee.cookie,403)
  assert.equal((await audit()).length,audited);assert.equal((await read(ana)).items.length,4)
  await call(path,'GET',undefined,outsider.cookie,403);await call(path,'POST',{kind:'folder',title:'Outside'},outsider.cookie,403)
  await call(`/api/channels/${room.id}/posting`,'PATCH',{version:await version(),level:'everyone',replies:'everyone',people:[]},ownerCookie)

  // Previews follow current access: a reader sees a file's name while it is live and a bare unavailable entry once it is gone.
  assert.equal((await read(guest)).items.find(i=>i.kind==='file').file.name,'Launch plan.txt')
  await call(`/api/attachments/${file.id}/preview`,'GET',undefined,outsider.cookie,404)
  const bookmarkId=state.items.find(i=>i.kind==='file').id

  // Readable export and operational backup carry the bar; a restore sends nothing.
  const exportRecords=async()=>{let job=await call('/api/readable-exports','POST',{scope:'conversation',conversationId:room.id,custodyAccepted:true},ownerCookie);for(let n=0;!job.complete&&n<100;n++)job=await call(`/api/readable-exports/${job.id}/step`,'POST',{},ownerCookie);assert.ok(job.complete);const records=[];for(const page of (await call(`/api/readable-exports/${job.id}/index`,'GET',undefined,ownerCookie)).items)records.push(...(await call(`/api/readable-exports/${job.id}/pages/${page.ordinal}`,'GET',undefined,ownerCookie)).records);return records}
  let exported=(await exportRecords()).filter(r=>r.type==='bookmarks')
  assert.deepEqual(exported.map(r=>r.data.title).sort(),['Customer material','FAQ','Launch brief','Launch plan']);assert.equal(exported.find(r=>r.data.title==='FAQ').data.parent,folder.id)
  const sorted=async(source,table)=>(await source.prepare(`SELECT * FROM ${table} ORDER BY 1,2`).all()).results,service=await createPortability({db,buckets:{FILES:await app.mf.getR2Bucket('FILES')},policy:await productPolicy(db)}),exportId=await service.exports.create(),records=[]
  try{while((await service.exports.advance(exportId,{maxParts:16})).phase==='building'){};for await(const record of readArchive(await service.exports.download(exportId)))records.push(record)}finally{await service.exports.abort(exportId)}
  restore=await installation(async()=>{assert.fail('restoring bookmarks must emit no external effect')},{bootstrap:false})
  const importer=await createPortability({db:restore.db,buckets:{FILES:await restore.mf.getR2Bucket('FILES')},policy:await productPolicy(restore.db),migrations:migrationHistory(await productPolicy(restore.db))}),importId=await importer.imports.create(records[0])
  for(const record of records)if(record.kind==='part')await importer.imports.uploadPart(importId,record.index,record)
  const end=records.at(-1);await importer.imports.finalize(importId,{contentHash:end.contentHash,archiveHash:end.archiveHash})
  for(const table of ['nook_bookmarks','nook_bookmark_versions'])assert.deepEqual(await sorted(restore.db,table),await sorted(db,table),table+' restores exactly')
  assert.equal((await restore.db.prepare("SELECT count(*) AS n FROM nook_audit WHERE service='bookmarks'").first()).n,(await audit()).length)
  await restore.close();restore=undefined

  // Remove: a folder takes its bookmarks with it in one audit row; a member's erasure keeps the bar and drops attribution; erasing the file drops its bookmark.
  state=await call(`${path}/${folder.id}`,'DELETE',{},lee.cookie);assert.deepEqual(state.items.map(i=>i.title).sort(),['Launch brief','Launch plan'])
  assert.deepEqual((await audit()).at(-1),{kind:'bookmark.remove',count:2,version:state.version,actor:lee.user.id})
  await call(`${path}/${folder.id}`,'DELETE',{},lee.cookie,404)
  const erase=async(kind,target)=>{let receipt=await call('/api/erasures','POST',{kind,target,confirmation:'ERASE'},ownerCookie);for(let n=0;receipt.state!=='complete'&&n<60;n++)receipt=await call(`/api/erasures/${receipt.id}/resume`,'POST',{},ownerCookie);assert.equal(receipt.state,'complete');await until(async()=>!(await db.prepare("SELECT 1 FROM nook_erasure_receipts WHERE state<>'complete' UNION ALL SELECT 1 FROM nook_erasure_work").first()),'erasure settled',60_000)}
  await erase('member',lee.user.id)
  state=await read(ana);assert.equal(state.items.length,2,'an erased member leaves the bar intact');assert.ok(state.items.every(i=>i.addedBy?.id!==lee.user.id));assert.equal((await db.prepare('SELECT count(*) AS n FROM nook_bookmarks WHERE author=?').bind(lee.user.id).first()).n,0)
  assert.equal((await db.prepare("SELECT count(*) AS n FROM nook_audit WHERE service='bookmarks' AND actor=?").bind(lee.user.id).first()).n,0)
  await erase('message',message.id)
  state=await read(ana);const gone=state.items.find(i=>i.id===bookmarkId);assert.ok(!gone||gone.file.available===false&&!('name' in gone.file),'an erased file leaves no name behind')
  assert.equal((await db.prepare("SELECT count(*) AS n FROM nook_bookmarks WHERE kind='file'").first()).n,0,'erasing the file removes its bookmark')
 // The screens at both widths, with a fresh file because the first was erased above.
  await fetch(origin+'/setup',{method:'POST',redirect:'manual',headers:{cookie:ownerCookie,origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'})
  if(!process.argv.includes('--without-browser')){
   const again=await (await fetch(origin+`/api/conversations/${room.id}/attachments`,{method:'POST',headers:{cookie:ana.cookie,Origin:origin,'Content-Type':'text/plain','X-Filename':encodeURIComponent('Roadmap.txt'),'X-Upload-Intent':crypto.randomUUID()},body:'Roadmap bytes'})).json()
   await call(`/api/conversations/${room.id}/messages`,'POST',{body:'The roadmap is attached',intent:crypto.randomUUID(),attachments:[again.id]},ana.cookie)
   await bookmarksBrowser({origin,manager:ana,restricted:guest,room,file:{id:again.id,name:'Roadmap.txt'}})
  }
 }finally{await restore?.close();await app.close()}
})
