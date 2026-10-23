import {test} from 'node:test'
import assert from 'node:assert/strict'
import {installation,until} from './push/fixture.mjs'
import {createPortability,readArchive} from '@runeditrun/rer/modules/portability'
import {productPolicy} from '../src/platform/portability-policy.mjs'
import {migrationHistory} from './migration-history.mjs'
import {pollsBrowser} from './polls-browser.mjs'

// NOOK-070 polls through the real Worker, local D1 and the archive service. No outbound edge exists: any send fails the test.
test('NOOK-070 anonymous polls seal custody, count one vote set per member until close, refuse non-members and restricted posters, never become a decision, export, restore closed and erase without revealing an anonymous voter',{timeout:240000},async()=>{
 const app=await installation(async()=>new Response(null,{status:201}),{workerOptions:{assets:{directory:process.cwd()+'/dist/client',binding:'ASSETS',run_worker_first:true}}}),{call,db,ownerCookie,origin}=app;let restore
 try{
  const room=await call('/api/conversations','POST',{name:'Launch review polls',kind:'private'},ownerCookie),other=await call('/api/conversations','POST',{name:'Other team',kind:'private'},ownerCookie)
  const ana=await app.invite('Ana-Poll',room.id),lee=await app.invite('Lee-Poll',room.id),kim=await app.invite('Kim-Poll',room.id),outsider=await app.invite('Morgan-Poll',other.id)
  const make=(who,over={})=>call(`/api/conversations/${room.id}/polls`,'POST',{question:'Which day should the launch review happen?',options:['Tuesday','Wednesday','Thursday'],multiple:false,anonymous:true,closes:null,intent:crypto.randomUUID(),...over},who.cookie??who),poll=(id,who=ownerCookie)=>call('/api/polls/'+id,'GET',undefined,who.cookie??who)
  const vote=(id,choices,who,status=200)=>call(`/api/polls/${id}/vote`,'POST',{choices},who.cookie,status),counts=p=>p.options.map(o=>o.count)
  const outcomes=async()=>(await db.prepare('SELECT count(*) AS n FROM nook_outcomes').first()).n
  const messages=async()=>(await call(`/api/conversations/${room.id}/messages`,'GET',undefined,ownerCookie)).length

  // Creation validates the clause's bounds and posts exactly one message.
  const bad=async(over,status=400)=>call(`/api/conversations/${room.id}/polls`,'POST',{question:'Bounded?',options:['Yes','No'],multiple:false,anonymous:true,closes:null,intent:crypto.randomUUID(),...over},ana.cookie,status)
  const base=await messages()
  await bad({options:['Only one']});await bad({options:Array.from({length:21},(_,i)=>'Option '+i)});await bad({options:['Same','same']});await bad({closes:Date.now()-1000});await bad({multiple:'yes'});await bad({extra:true});await bad({anonymous:false})
  await call(`/api/conversations/${room.id}/polls`,'POST',{question:'Outside',options:['Yes','No'],multiple:false,anonymous:true,closes:null,intent:crypto.randomUUID()},outsider.cookie,403)
  assert.equal(await messages(),base,'refused polls create nothing')
  const intent=crypto.randomUUID(),named=await make(ana,{intent}),again=await make(ana,{intent})
  assert.equal(named.poll,true);assert.equal(again.id,named.id,'a retried create is one poll');assert.equal(await messages(),base+1,'one poll is one message')
  await call(`/api/conversations/${room.id}/polls`,'POST',{question:'Which day should the launch review happen?',options:['Tuesday','Wednesday','Thursday','Friday'],multiple:false,anonymous:true,closes:null,intent},ana.cookie,409)
  const listed=(await call(`/api/conversations/${room.id}/messages`,'GET',undefined,lee.cookie)).find(m=>m.id===named.id);assert.equal(listed.poll,true)

  // One vote set per member, changeable until close; named polls show voters to members.
  await vote(named.id,[1],ana);await vote(named.id,[1,2],lee,400);await vote(named.id,[4],lee,400);await vote(named.id,[2],lee)
  let shown=await poll(named.id,lee.cookie);assert.deepEqual(counts(shown),[1,1,0]);assert.deepEqual(shown.mine,[2]);assert.ok(shown.options.every(o=>!('voters' in o)))
  await vote(named.id,[3],ana);shown=await poll(named.id,ana.cookie);assert.deepEqual(counts(shown),[0,1,1],'changing a vote replaces it');assert.equal(shown.voters,2)
  assert.equal(await outcomes(),0,'a vote is never a decision or an accepted commitment')

  // A person who is not a member, or no longer one, cannot vote and sees nothing.
  await vote(named.id,[1],outsider,403);await call('/api/polls/'+named.id,'GET',undefined,outsider.cookie,403)
  await vote(named.id,[1],kim);await call('/api/team/remove','POST',{user:kim.user.id,conversation:room.id},ownerCookie)
  await vote(named.id,[2],kim,403);await call('/api/polls/'+named.id,'GET',undefined,kim.cookie,403)

  // Anonymous, multiple choice, with a close time: members see counts and their own vote, never who voted for what.
  const anonymous=await make(ana,{question:'Which rooms should we book?',options:['Atrium','Studio','Library'],multiple:true,anonymous:true,closes:Date.now()+3600_000})
  await vote(anonymous.id,[1,2],ana);await vote(anonymous.id,[2],lee)
  for(const who of [ana,lee,{cookie:ownerCookie}]){const view=await poll(anonymous.id,who.cookie);assert.deepEqual(counts(view),[1,2,0]);assert.ok(view.options.every(o=>!('voters' in o)));assert.ok(!JSON.stringify(view).includes(ana.user.id)&&!JSON.stringify(view).includes(lee.user.id))}
  assert.deepEqual((await poll(anonymous.id,ana.cookie)).mine,[1,2]);assert.deepEqual((await poll(anonymous.id,lee.cookie)).mine,[2]);await vote(anonymous.id,[3],lee);assert.deepEqual((await poll(anonymous.id,lee.cookie)).mine,[3]);await vote(anonymous.id,[2],lee);assert.deepEqual(counts(await poll(anonymous.id)),[1,2,0],'an anonymous voter may change their own vote until close')
  const custody=await db.prepare('SELECT * FROM nook_poll_votes WHERE message=? AND voter=?').bind(anonymous.id,lee.user.id).first();assert.equal(typeof custody.sealed,'string');assert.equal('position' in custody,false,'person-to-choice custody stores no plaintext choice');
  assert.equal((await db.prepare("SELECT count(*) AS n FROM nook_events WHERE kind='poll' AND actor IS NOT NULL").first()).n,0,'no event names a voter')

  // Close: only the creator or a manager, then final. The close time moves through the database, never by waiting.
  await call(`/api/polls/${named.id}/close`,'POST',{},lee.cookie,403)
  const closed=await call(`/api/polls/${named.id}/close`,'POST',{},ownerCookie);assert.equal(closed.open,false);assert.deepEqual(counts(closed),[1,1,1],'a vote cast before removal stays counted')
  await vote(named.id,[1],ana,409);await call(`/api/polls/${named.id}/close`,'POST',{},ownerCookie,409)
  await db.prepare('UPDATE nook_polls SET closes=? WHERE message=?').bind(Date.now()-1000,anonymous.id).run()
  assert.equal((await poll(anonymous.id)).open,false);await vote(anonymous.id,[3],ana,409);assert.deepEqual(counts(await poll(anonymous.id)),[1,2,0])

  // A restricted poster cannot create a poll; nothing is written.
  const version=async()=>(await call(`/api/channels/${room.id}/details`,'GET',undefined,ownerCookie)).version,before=await messages()
  await call(`/api/channels/${room.id}/posting`,'PATCH',{version:await version(),level:'admins',replies:'same',people:[]},ownerCookie)
  await call(`/api/conversations/${room.id}/polls`,'POST',{question:'Allowed?',options:['Yes','No'],multiple:false,anonymous:true,closes:null,intent:crypto.randomUUID()},lee.cookie,403)
  assert.equal(await messages(),before);assert.equal((await db.prepare('SELECT count(*) AS n FROM nook_polls').first()).n,2)

  // Readable export: counts for every poll, voters for the named poll only.
  const exportRecords=async(who)=>{let job=await call('/api/readable-exports','POST',{scope:'conversation',conversationId:room.id,custodyAccepted:true},who);for(let n=0;!job.complete&&n<100;n++)job=await call(`/api/readable-exports/${job.id}/step`,'POST',{},who);assert.ok(job.complete);const records=[];for(const page of (await call(`/api/readable-exports/${job.id}/index`,'GET',undefined,who)).items)records.push(...(await call(`/api/readable-exports/${job.id}/pages/${page.ordinal}`,'GET',undefined,who)).records);return records}
  let exported=await exportRecords(ownerCookie)
  assert.deepEqual(exported.find(r=>r.type==='polls'&&r.data.message===named.id).data.options.map(o=>o.count),[1,1,1])
  const exportedAnonymous=exported.find(r=>r.type==='polls'&&r.data.message===anonymous.id).data;assert.deepEqual(exportedAnonymous.options.map(o=>o.count),[1,2,0]);assert.equal(exportedAnonymous.anonymous,1)
  assert.equal(exported.filter(r=>r.type==='poll_votes').length,0,'every poll export contains aggregate counts only')
  assert.equal(exported.filter(r=>r.type==='poll_votes'&&r.data.message===anonymous.id).length,0,'an anonymous poll exports counts only')

  // Operational backup and restore bring both polls back exactly; the closed poll stays closed and nothing is sent.
  const sorted=async(source,table)=>(await source.prepare(`SELECT * FROM ${table} ORDER BY 1,2,3`).all()).results,service=await createPortability({db,buckets:{FILES:await app.mf.getR2Bucket('FILES')},policy:await productPolicy(db)}),exportId=await service.exports.create(),records=[]
  try{while((await service.exports.advance(exportId,{maxParts:16})).phase==='building'){};for await(const record of readArchive(await service.exports.download(exportId)))records.push(record)}finally{await service.exports.abort(exportId)}
  restore=await installation(async()=>{assert.fail('restoring polls must emit no external effect')},{bootstrap:false})
  const importer=await createPortability({db:restore.db,buckets:{FILES:await restore.mf.getR2Bucket('FILES')},policy:await productPolicy(restore.db),migrations:migrationHistory(await productPolicy(restore.db))}),importId=await importer.imports.create(records[0])
  for(const record of records)if(record.kind==='part')await importer.imports.uploadPart(importId,record.index,record)
  const end=records.at(-1);await importer.imports.finalize(importId,{contentHash:end.contentHash,archiveHash:end.archiveHash})
  for(const table of ['nook_poll_options'])assert.deepEqual(await sorted(restore.db,table),await sorted(db,table),table+' restores exactly');assert.deepEqual(await sorted(restore.db,'nook_polls'),(await sorted(db,'nook_polls')).map(row=>({...row,closed_at:row.closed_at??row.created})),'aggregate snapshots restore closed');assert.deepEqual(await sorted(restore.db,'nook_poll_votes'),[],'sealed person-to-choice custody never enters an archive');assert.ok(!records.some(part=>part.items?.some(item=>item.table==='nook_poll_votes')),'operational exports are aggregate-only')
  assert.ok((await restore.db.prepare('SELECT closed_at FROM nook_polls WHERE message=?').bind(named.id).first()).closed_at,'a restored closed poll stays closed')
  await restore.close();restore=undefined

  // Erasure: a erased member's named votes go and the anonymous count stays; erasing the poll message removes the whole poll.
  await call(`/api/channels/${room.id}/posting`,'PATCH',{version:await version(),level:'everyone',replies:'everyone',people:[]},ownerCookie)
  const erase=async(kind,target)=>{let receipt=await call('/api/erasures','POST',{kind,target,confirmation:'ERASE'},ownerCookie);for(let n=0;receipt.state!=='complete'&&n<60;n++)receipt=await call(`/api/erasures/${receipt.id}/resume`,'POST',{},ownerCookie);assert.equal(receipt.state,'complete');await until(async()=>!(await db.prepare("SELECT 1 FROM nook_erasure_receipts WHERE state<>'complete' UNION ALL SELECT 1 FROM nook_erasure_work").first()),'erasure settled',60_000)}
  await erase('member',lee.user.id)
  assert.deepEqual(counts(await poll(named.id)),[1,0,1],'named votes leave with the member');assert.deepEqual(counts(await poll(anonymous.id)),[1,1,0],'erasure removes the erased member’s sealed vote from aggregate counts')
  assert.equal((await db.prepare('SELECT count(*) AS n FROM nook_poll_votes WHERE voter=?').bind(lee.user.id).first()).n,0)
  assert.equal((await db.prepare('SELECT count(*) AS n FROM nook_poll_votes v JOIN nook_polls p ON p.message=v.message WHERE p.anonymous=1').first()).n,1,'only the unaffected member’s sealed vote survives')
  exported=await exportRecords(ownerCookie);assert.ok(!exported.some(r=>r.type==='poll_votes'&&r.data.voter===lee.user.id))
  await erase('message',named.id)
  await call('/api/polls/'+named.id,'GET',undefined,ownerCookie,404)
  assert.equal((await db.prepare('SELECT (SELECT count(*) FROM nook_polls WHERE message=?1)+(SELECT count(*) FROM nook_poll_options WHERE message=?1)+(SELECT count(*) FROM nook_poll_votes WHERE message=?1) AS n').bind(named.id).first()).n,0,'erasing the message erases its poll')
  assert.deepEqual(counts(await poll(anonymous.id)),[1,1,0])

  // The screens at both widths: create, vote from a second person, live counts, close, final count.
  await fetch(origin+'/setup',{method:'POST',redirect:'manual',headers:{cookie:ownerCookie,origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'})
  if(!process.argv.includes('--without-browser'))await pollsBrowser({origin,owner:{cookie:ownerCookie},member:ana,room})
 }finally{await restore?.close();await app.close()}
})
