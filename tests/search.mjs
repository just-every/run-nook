import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {sourceDoor} from './import-fixture.mjs'

export function searchPdf(text){
 const stream=`BT /F1 14 Tf 40 750 Td (${text.replace(/[()\\]/g,'\\$&')}) Tj ET`,objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`]
 let pdf='%PDF-1.4\n',offsets=[0]
 objects.forEach((body,index)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${index+1} 0 obj\n${body}\nendobj\n`})
 const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(offset=>String(offset).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
 return Buffer.from(pdf)
}
export async function searchJourney(h){
 const {post,get,patch,owner,member,outsider,check,sql,restart,origin}=h
 const room=(await post('/api/conversations',{name:'Revenue operations',kind:'private',participants:[member.user.id]})).data
 const dm=(await post('/api/conversations',{name:'Search colleague DM',kind:'dm',participants:[member.user.id]})).data
 const send=async(body,extra={},actor=owner,where=room.id)=>(await post(`/api/conversations/${where}/messages`,{body,intent:crypto.randomUUID(),...extra},actor.cookie)).data
 const upload=async(name,mime,bytes)=>(await post(`/api/conversations/${room.id}/attachments`,{name,mime,data:Buffer.from(bytes).toString('base64'),intent:crypto.randomUUID()})).data
 const find=async(q,actor=member,extra='')=>(await get('/api/search?q='+encodeURIComponent(q)+'&conversation='+room.id+extra,actor.cookie)).data
 let document,message
 await check('NOOK-019 combined Unicode terms, phrases, prefixes, modifiers, private file text and live deletion',async()=>{
  const root=await send('HR Q3 launch résumé 東京; approved plan https://example.com/launch')
  const reply=await send('The rollout handoff is approved',{parent:root.id},member)
  const draft=await send('HR Q3 launch draft')
  const direct=await send('HR direct reply',{},member,dm.id)
  await post(`/api/messages/${root.id}/reactions`,{emoji:'✅',add:true},member.cookie)
  const ids=page=>page.items.map(item=>item.id)
  assert.deepEqual(new Set(ids(await find('Q3 HR -draft'))),new Set([root.id]))
  assert.deepEqual(ids(await find('"approved plan" rés* 東*')), [root.id])
  assert.ok(ids(await find('3')).includes(root.id));assert.ok(ids(await find('rÉSuMÉ')).includes(root.id))
  assert.deepEqual(ids(await find('has:link has::white_check_mark: is:thread')), [root.id])
  assert.deepEqual(ids(await find(`with:@${member.user.id} from:me`,owner)).sort(),[root.id,draft.id].sort())
  const directResults=(await get('/api/search?q='+encodeURIComponent(`in:@${member.user.id} to:me`),owner.cookie)).data
  assert.ok(ids(directResults).includes(direct.id));assert.ok(!ids(directResults).includes(root.id))
  assert.equal((await find('Q3 type:dm')).items.length,0)
  const stamp='2026-10-01T03:30:00.000Z'
  await sql(`UPDATE nook_messages SET created='${stamp}' WHERE id='${draft.id}'`)
  assert.ok(ids(await find('draft during:september',member,'&timeZone=America/New_York')).includes(draft.id))
  assert.ok(!ids(await find('draft during:september',member,'&timeZone=UTC')).includes(draft.id))
  document=await upload('Q3-retention-policy.pdf','application/pdf',searchPdf('Customer success handoff: reference PO 5k for Q3 HR approval.'))
  const text=await upload('sales-team-notes.txt','text/plain','The AI launch briefing covers payroll and café staffing.')
  const png=await upload('staffing-chart.png','image/png',await readFile(new URL('../public/icons/nook-192.png',import.meta.url)))
  message=await send('The supporting documents are ready',{attachments:[document.id,text.id,png.id],parent:root.id})
  const pdf=await find('"Customer success handoff" has:file')
  assert.deepEqual(ids(pdf),[message.id]);assert.equal(pdf.items[0].files.find(f=>f.attachment===document.id).status,'indexed')
  assert.match(pdf.items[0].files.find(f=>f.attachment===document.id).excerpt,/reference PO 5k/)
  assert.deepEqual(ids(await find('AI café')),[message.id]);assert.deepEqual(ids(await find('Q3-retention-policy.pdf')),[message.id])
  assert.ok((await find('staffing')).unsearchedFiles.some(f=>f.attachment===png.id&&f.status==='unsupported'))
  assert.equal((await get('/api/search?q=payroll',outsider.cookie)).data.items.length,0)
  await get('/api/search?q='+encodeURIComponent('"unfinished'),member.cookie,400)
  await get('/api/search?q='+encodeURIComponent('during:soon'),member.cookie,400)
  assert.ok((await find('custom:payroll')).hints.length)
  await restart()
  assert.deepEqual(ids(await find('"Customer success handoff"')),[message.id])
  await patch('/api/attachments/'+document.id,{delete:true})
  assert.equal((await find('"Customer success handoff"')).items.length,0)
  assert.equal((await find('Q3-retention-policy.pdf')).items.length,0)
  await post(`/api/conversations/${room.id}/members`,{user:member.user.id,remove:true})
  assert.ok(!(await get('/api/search?q=payroll',member.cookie)).data.items.some(i=>i.id===message.id))
  assert.ok(!(await get('/api/search?q=staffing',member.cookie)).data.unsearchedFiles.some(f=>f.attachment===png.id))
 })
 await check('NOOK-019 imported replies and private imported file text use the same current-authority search',async()=>{
   const fixture=await sourceDoor({origin,owner,member,sql,namespace:'search-'+crypto.randomUUID()})
   await fixture.door.finish(fixture.plan)
   const conversation=(await fixture.door.status(fixture.plan)).destinations[0].id
   const query=text=>'/api/search?q='+encodeURIComponent(text+' in:#'+conversation)
   const file=(await get(query('proof'),member.cookie)).data.items
   assert.equal(file.length,1);assert.equal(file[0].source,'imported');assert.equal(file[0].files[0].name,'proof.txt');assert.equal(file[0].files[0].excerpt,'proof')
   const reply=(await get(query('reply is:thread'),member.cookie)).data.items
   assert.equal(reply.length,1);assert.ok(reply[0].parent);assert.equal(reply[0].source,'imported')
   await post('/api/conversations/'+conversation+'/members',{user:member.user.id,remove:true})
   assert.ok(!(await get('/api/search?q=proof',member.cookie)).data.items.some(i=>i.conversation===conversation))
 })
 await check('NOOK-019 completely page an 80,000-message corpus through authenticated search',async()=>{
  const corpus=(await post('/api/conversations',{name:'Seven years of operations',kind:'private',participants:[member.user.id]})).data
  // Fixture creation only; enumeration and authority are exercised through HTTP.
  await sql(`WITH RECURSIVE n(value) AS (VALUES(1) UNION ALL SELECT value+1 FROM n WHERE value<80000)
   INSERT INTO nook_messages(id,conversation,author,body,body_lower,parent,version,deleted,created,intent,payload,sequence,ordinal,author_ordinal)
   SELECT 'search-corpus-'||printf('%05d',value),'${corpus.id}','${owner.user.id}','HR Q3 operational archive '||value,'hr q3 operational archive '||value,NULL,1,0,'2026-09-15T12:00:00.000Z','corpus-'||value,'fixture',value,value,value FROM n`)
  await sql(`INSERT INTO nook_search(message,conversation,source,scope,body_lower) SELECT id,conversation,'native','|'||conversation||'|',body_lower FROM nook_messages WHERE conversation='${corpus.id}'`)
  const seen=new Set(),query=encodeURIComponent(`HR in:#${corpus.id} during:2026-09`);let after='',pages=0
  do{
   const page=(await get('/api/search?q='+query+'&after='+encodeURIComponent(after),member.cookie)).data;pages++;if(pages%100===0)console.log('Search corpus: '+seen.size+' / 80000 messages paged')
   for(const item of page.items){assert.ok(!seen.has(item.id));seen.add(item.id)}
   if(!page.hasMore)break
   assert.notEqual(page.cursor,after);after=page.cursor
  }while(true)
  assert.equal(seen.size,80000);assert.ok(pages>=800)
  for(let n=1;n<=80000;n++)assert.ok(seen.has('search-corpus-'+String(n).padStart(5,'0')))
  await post(`/api/conversations/${corpus.id}/members`,{user:member.user.id,remove:true})
  assert.equal((await get('/api/search?q=HR&after='+encodeURIComponent(after),member.cookie,400)).response.status,400)
  assert.ok(!(await get('/api/search?q=HR',member.cookie)).data.items.some(i=>i.conversation===corpus.id))
 })
}
