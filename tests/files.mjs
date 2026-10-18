import assert from 'node:assert/strict'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {resolve} from 'node:path'
import {source} from './import-fixture.mjs'
import {captureImport} from '../scripts/import-preview.mjs'

export async function filesJourney({owner,registered,post,patch,get,check,restart}){
 const member=await registered('FilesColleague'),outside=await registered('FilesOutside')
 const room=(await post('/api/conversations',{name:'Customer launch files',kind:'private',participants:[member.user.id]})).data
 const upload=async(name,body,person=owner,mime='text/plain')=>(await post(`/api/conversations/${room.id}/attachments`,{name,mime,data:Buffer.from(body).toString('base64'),intent:crypto.randomUUID()},person.cookie)).data
 const send=async(body,files,person=owner,parent=null)=>(await post(`/api/conversations/${room.id}/messages`,{body,attachments:files.map(f=>f.id),parent,intent:crypto.randomUUID()},person.cookie)).data
 const path=`/api/conversations/${room.id}/files`
 await check('NOOK-019 Files page complete shared history with person/type filters and current ACL',async()=>{
  const staged=await upload('unshared-working-notes.txt','Private working notes')
  assert.ok(!(await get(path)).data.items.some(f=>f.id===staged.id))
  const expected=new Map()
  let root
  for(let batch=0;batch<11;batch++){
   const actor=batch%2?member:owner,files=[]
   for(let n=0;n<5;n++)files.push(await upload(`launch-checklist-${batch*5+n+1}.txt`,'Customer rollout checklist '+(batch*5+n+1),actor))
   const message=await send('Customer rollout supporting documents',files,actor,root?.id??null)
   root??=message
   for(const file of files)expected.set(file.id,{file,message,actor})
  }
  const pdf=await upload('rollout-brief.pdf','%PDF-1.4\nCustomer rollout brief\n%%EOF',member,'application/pdf')
  const pdfMessage=await send('The final brief is attached.',[pdf],member,root.id)
  expected.set(pdf.id,{file:pdf,message:pdfMessage,actor:member})
  const seen=[],seenIds=new Set();let after='',pages=0
  do{
   const page=(await get(path+'?after='+encodeURIComponent(after),member.cookie)).data;pages++
   for(const file of page.items){
    assert.ok(!seenIds.has(file.id));seenIds.add(file.id);seen.push(file)
    const shared=expected.get(file.id);assert.ok(shared)
    assert.equal(file.message,shared.message.id);assert.equal(file.parent,shared.message.parent)
    assert.equal(file.author,shared.actor.user.id);assert.equal(file.name,shared.file.name)
    assert.equal(file.source,'native');assert.equal(file.created,shared.message.created)
    assert.ok(!('object_key' in file));assert.ok(!('source_record' in file))
   }
   if(!page.hasMore)break
   assert.notEqual(page.cursor,after);after=page.cursor
  }while(true)
  assert.ok(pages>1);assert.deepEqual(seenIds,new Set(expected.keys()))
  assert.deepEqual(seen.map(f=>f.id),[...seen].sort((a,b)=>b.created.localeCompare(a.created)||(a.id<b.id?1:a.id>b.id?-1:0)).map(f=>f.id))
  const filtered=(await get(path+'?type=pdf&person='+member.user.id,member.cookie)).data.items
  assert.deepEqual(filtered.map(f=>f.id),[pdf.id])
  assert.equal((await get(path+'?type=image',member.cookie)).data.items.length,0)
  assert.ok((await get(path+'?person=me',member.cookie)).data.items.every(f=>f.author===member.user.id))
  await get(path+'?type=pdf&after='+encodeURIComponent(after),member.cookie,400)
  await get(path+'?type=unknown',member.cookie,400)
  await get(path+'?after=broken',member.cookie,400)
  await get(path,outside.cookie,403)
  assert.ok(!(await get('/api/files',outside.cookie)).data.items.some(f=>f.conversation===room.id))
  const privateDm=(await post('/api/conversations',{kind:'dm',name:'Files confidential DM',participants:[outside.user.id]},member.cookie)).data
  const privateFile=(await post(`/api/conversations/${privateDm.id}/attachments`,{name:'private.txt',mime:'text/plain',data:Buffer.from('Only DM participants').toString('base64')},member.cookie)).data
  await post(`/api/conversations/${privateDm.id}/messages`,{body:'Private document',attachments:[privateFile.id],intent:crypto.randomUUID()},member.cookie)
  assert.ok(!(await get('/api/files')).data.items.some(f=>f.id===privateFile.id),'owner role does not open another person’s DM')
  await get(`/api/conversations/${privateDm.id}/files`,owner.cookie,403)
  if(restart)await restart()
  assert.deepEqual((await get(path+'?type=pdf',member.cookie)).data.items.map(f=>f.id),[pdf.id])
  await post(`/api/conversations/${room.id}/members`,{user:member.user.id,remove:true})
  await get(path+'?after='+encodeURIComponent(after),member.cookie,403)
  assert.ok(!(await get('/api/files',member.cookie)).data.items.some(f=>f.conversation===room.id))
  await get(`/api/attachments/${pdf.id}/download`,member.cookie,404)
  const own=[...expected.values()].find(item=>item.actor===owner)
  await patch('/api/attachments/'+own.file.id,{delete:true})
  assert.ok(!(await get(path)).data.items.some(f=>f.id===own.file.id))
  await patch('/api/messages/'+own.message.id,{delete:true,version:own.message.version})
  assert.ok(!(await get(path)).data.items.some(f=>f.message===own.message.id))
  await post('/api/logout',{},outside.cookie)
  await get('/api/files',outside.cookie,401)
 })
 await check('NOOK-019 Files include published imports using source time and source author, and hide erased/revoked sources',async()=>{
  const directory=await mkdtemp(resolve(tmpdir(),'nook-files-import-'))
  try{
   // Imported storage custody belongs to owner; the source author maps to member.
   const fixture=source(directory,member.user.id,owner.user.id)
   fixture.mapping.sourceNamespace='files-'+crypto.randomUUID()
   const capture=captureImport(fixture.dir,fixture.mapping,fixture.supplied)
   const plan=(await post('/api/imports/preview',{capture})).data
   const receipt=(await post('/api/imports/apply',{capture,intent:crypto.randomUUID(),planDigest:plan.planDigest})).data
   const conversation=receipt.channels[0].id,base=`/api/conversations/${conversation}/files`
   const items=(await get(base,member.cookie)).data.items
   assert.equal(items.length,1)
   const file=items[0];assert.equal(file.name,'proof.txt');assert.equal(file.source,'imported')
   assert.equal(file.author,member.user.id);assert.equal(file.authorName,'Historic person')
   assert.equal(file.created,new Date(1700000000*1000).toISOString())
   assert.deepEqual((await get(base+'?person=me',member.cookie)).data.items.map(f=>f.id),[file.id])
   assert.equal((await get(base+'?person='+owner.user.id)).data.items.length,0)
   assert.equal((await get(`/api/import-files/${file.id}/download`,member.cookie)).raw,'proof')
   await post(`/api/conversations/${conversation}/members`,{user:member.user.id,remove:true})
   assert.ok(!(await get('/api/files',member.cookie)).data.items.some(f=>f.id===file.id))
   await get(base,member.cookie,403)
   let erased=(await post('/api/erasures',{kind:'imported-message',target:file.message,confirmation:'ERASE'})).data
   while(erased.state!=='complete')erased=(await post(`/api/erasures/${erased.id}/resume`,{})).data
   assert.ok(!(await get(base)).data.items.some(f=>f.id===file.id))
  }finally{await rm(directory,{recursive:true,force:true})}
 })
}
