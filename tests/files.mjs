import {importedPreviewFiles} from './file-preview-fixture.mjs'
import {zipFixture} from './slack-import/fixture.mjs'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {sourceDoor} from './import-fixture.mjs'

export async function filesJourney({owner,registered,post,patch,get,check,restart,origin,sql,validateArchive}){
 await check('NOOK-061 ordered multipart resumes after restart and verifies bytes before one binding',async()=>{
  const base=typeof origin==='function'?origin():origin,room=(await post('/api/conversations',{name:'synthetic-nook multipart custody',kind:'private',participants:[]})).data;
  const call=async(path,{method='GET',body,status=200,type='application/json'}={})=>{const response=await fetch(base+path,{method,headers:{Connection:'close',cookie:owner.cookie,Origin:base,'Content-Type':type},body:body===undefined?undefined:body instanceof Uint8Array?body:JSON.stringify(body)});const result=await response.json();assert.equal(response.status,status,JSON.stringify(result));return result};
  const policy=(await get('/api/team/file-policy')).data;
  await patch('/api/team/file-policy',{...policy,maxBytes:1073741824,blockedExtensions:['exe']});
  const invalid=await call('/api/conversations/'+room.id+'/uploads',{method:'POST',body:{name:'synthetic-nook-bad-checksum.zip',mime:'application/zip',size:17,sha256:'0'.repeat(64),intent:crypto.randomUUID()}});
  await call('/api/uploads/'+invalid.id+'/parts/1',{method:'PUT',type:'application/octet-stream',body:Buffer.alloc(17,65)});
  await call('/api/uploads/'+invalid.id+'/complete',{method:'POST',status:409});
  await patch('/api/attachments/'+invalid.id,{delete:true});
  const bytes=Buffer.alloc(8*1024*1024+17,65),checksum=createHash('sha256').update(bytes).digest('hex'),input={name:'synthetic-nook-large.zip',mime:'application/zip',size:bytes.length,sha256:checksum,intent:crypto.randomUUID()},path='/api/conversations/'+room.id+'/uploads';
  await call(path,{method:'POST',body:{...input,size:1073741825},status:400});
  await call(path,{method:'POST',body:{...input,name:'synthetic-nook-blocked.exe'},status:415});
  const declaration=await call(path,{method:'POST',body:input});assert.equal((await call(path,{method:'POST',body:input})).id,declaration.id);
  await call('/api/uploads/'+declaration.id+'/parts/2',{method:'PUT',type:'application/octet-stream',body:bytes.subarray(8*1024*1024),status:409});
  await call('/api/uploads/'+declaration.id+'/parts/1',{method:'PUT',type:'application/octet-stream',body:bytes.subarray(0,8*1024*1024)});
  await restart();assert.equal((await call('/api/uploads/'+declaration.id)).parts.length,1);
  await call('/api/uploads/'+declaration.id+'/parts/1',{method:'PUT',type:'application/octet-stream',body:bytes.subarray(0,8*1024*1024)});
  await call('/api/uploads/'+declaration.id+'/parts/2',{method:'PUT',type:'application/octet-stream',body:bytes.subarray(8*1024*1024)});
  const completed=await call('/api/uploads/'+declaration.id+'/complete',{method:'POST'});assert.equal(completed.file.sha256,checksum);
  assert.equal((await call('/api/uploads/'+declaration.id+'/complete',{method:'POST'})).file.id,completed.file.id);
  const message=(await post('/api/conversations/'+room.id+'/messages',{body:'synthetic-nook resumable file',attachments:[completed.file.id],intent:crypto.randomUUID()})).data;
  const downloaded=await fetch(base+'/api/attachments/'+completed.file.id+'/download',{headers:{Connection:'close',cookie:owner.cookie}});assert.equal(createHash('sha256').update(Buffer.from(await downloaded.arrayBuffer())).digest('hex'),checksum);
  if(validateArchive)await validateArchive();
  await patch('/api/messages/'+message.id,{delete:true,version:1});
  await get('/api/attachments/'+completed.file.id+'/download',owner.cookie,404);
  const current=(await get('/api/team/file-policy')).data;await patch('/api/team/file-policy',{...current,maxBytes:policy.maxBytes,blockedExtensions:policy.blockedExtensions});
 });
 await inertPreviewJourney({owner,registered,post,get,check,origin})
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
   // Imported storage custody belongs to owner; the source author maps to member.
   const fixture=await sourceDoor({origin,owner,member,sql,namespace:'files-'+crypto.randomUUID(),sourceAuthor:member.user.id})
   await fixture.door.finish(fixture.plan)
   const conversation=(await fixture.door.status(fixture.plan)).destinations[0].id,base=`/api/conversations/${conversation}/files`
   const items=(await get(base,member.cookie)).data.items
   assert.equal(items.length,1)
   const file=items[0];assert.equal(file.name,'proof.txt');assert.equal(file.source,'imported')
   assert.equal(file.author,member.user.id);assert.equal(file.authorName,'Historic person')
   assert.equal(file.created,new Date(1700000000*1000).toISOString())
   assert.deepEqual((await get(base+'?person=me',member.cookie)).data.items.map(f=>f.id),[file.id])
   assert.equal((await get(base+'?person='+owner.user.id)).data.items.length,0)
   assert.equal((await get(`/api/attachments/${file.id}/download`,member.cookie)).raw,'proof')
   await post(`/api/conversations/${conversation}/members`,{user:member.user.id,remove:true})
   assert.ok(!(await get('/api/files',member.cookie)).data.items.some(f=>f.id===file.id))
   await get(base,member.cookie,403)
   let erased=(await post('/api/erasures',{kind:'imported-message',target:file.message,confirmation:'ERASE'})).data
   while(erased.state!=='complete')erased=(await post(`/api/erasures/${erased.id}/resume`,{})).data
   assert.ok(!(await get(base)).data.items.some(f=>f.id===file.id))
 })
}

export async function inertPreviewJourney({owner,registered,post,get,check,origin}){
 await check('NOOK-061 bounded inert text, CSV and ZIP previews keep current membership',async()=>{
  const member=await registered('SyntheticNookPreviewMember'),outside=await registered('SyntheticNookPreviewOutside')
  const room=(await post('/api/conversations',{name:'Synthetic nook inert previews',kind:'private',participants:[member.user.id]})).data
  const upload=async(name,mime,bytes)=>(await post(`/api/conversations/${room.id}/attachments`,{name,mime,data:Buffer.from(bytes).toString('base64'),intent:crypto.randomUUID()})).data
  const active='<img src=x onerror=alert(1)>',zipName=active+'.txt',text='const value = '+JSON.stringify(active)+';',csv='name,value\nsynthetic,'+active
  const imported=await importedPreviewFiles({origin,owner,member,files:[{name:'synthetic-nook-archive.zip',bytes:zipFixture([[zipName,'Hidden ZIP contents'],['folder/',Buffer.alloc(0)],['folder/note.txt','note']])},{name:'synthetic-nook-broken.zip',bytes:'Malformed archive'},{name:'synthetic-nook-many.zip',bytes:zipFixture(Array.from({length:250},(_,n)=>['entry-'+n+'.txt','note']))},{name:'synthetic-nook-listing.zip',bytes:zipFixture(Array.from({length:100},(_,n)=>['entry-'+n+'-'+('a'.repeat(900))+'.txt','note']))}]}),records=[await upload('synthetic-nook-code.js','text/plain',text),await upload('synthetic-nook-data.csv','text/plain',csv),imported.files.find(file=>file.name==='synthetic-nook-archive.zip')]
  await post(`/api/conversations/${room.id}/messages`,{body:'Synthetic preview files',attachments:records.slice(0,2).map(f=>f.id),intent:crypto.randomUUID()})
  for(const [n,file] of records.entries()){
   const preview=await get(`/api/attachments/${file.id}/preview`,member.cookie)
   assert.match(preview.response.headers.get('content-type'),/^text\/plain/);assert.equal(preview.response.headers.get('x-content-type-options'),'nosniff');assert.match(preview.response.headers.get('content-security-policy'),/sandbox/)
   if(n<2)assert.equal(preview.raw,[text,csv][n]);else{assert.ok(preview.raw.includes(zipName));assert.ok(preview.raw.includes('folder/'));assert.ok(preview.raw.includes(Buffer.byteLength('Hidden ZIP contents')+' bytes'));assert.ok(!preview.raw.includes('Hidden ZIP contents'))}
   await get(`/api/attachments/${file.id}/preview`,outside.cookie,404)
  }
  const long=await upload('synthetic-nook-long.csv','text/plain','column\n'+'é'.repeat(40000)),bounded=await get(`/api/attachments/${long.id}/preview`)
  assert.equal(bounded.response.headers.get('X-Nook-Preview-Truncated'),'true');assert.ok(Buffer.byteLength(bounded.raw)<Buffer.byteLength('column\n'+'é'.repeat(40000)));assert.ok(!bounded.raw.includes('�'))
  const malformed=imported.files.find(file=>file.name==='synthetic-nook-broken.zip')
  await get(`/api/attachments/${malformed.id}/preview`,owner.cookie,415)
  await get(`/api/attachments/${imported.files.find(file=>file.name==='synthetic-nook-many.zip').id}/preview`,owner.cookie,415)
  const listing=await get(`/api/attachments/${imported.files.find(file=>file.name==='synthetic-nook-listing.zip').id}/preview`);assert.equal(listing.response.headers.get('X-Nook-Preview-Truncated'),'true');assert.ok(listing.raw.includes('entry-0-'));assert.ok(!listing.raw.includes('entry-99-'))
  await post(`/api/conversations/${room.id}/members`,{user:member.user.id,remove:true})
  await post(`/api/conversations/${imported.conversation}/members`,{user:member.user.id,remove:true})
  for(const file of records)await get(`/api/attachments/${file.id}/preview`,member.cookie,404)
  assert.equal((await get(`/api/attachments/${records[1].id}/download`)).raw,csv)
 })
}
