import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {invite} from '../auth-support.mjs'
import {readSlackZip} from '../../src/imports/zip.mjs'
import {zipFixture} from '../slack-import/fixture.mjs'
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
export async function mattermostJourney({origin,owner,restart,sql,validateArchive,check}){
 const backup=await readFile(new URL('./fixtures/mattermost-export.zip',import.meta.url)),expected=JSON.parse(await readFile(new URL('./fixtures/expected.json',import.meta.url))),suffix=crypto.randomUUID().slice(0,8)
 const people={}
 for(const username of ['maya','leo','aisha','sam'])people[username]=await invite(origin,owner.cookie,'Mattermost'+username+suffix)
 const outsider=await invite(origin,owner.cookie,'MattermostOutsider'+suffix),mapped=Object.fromEntries(Object.entries(people).map(([name,actor])=>[name,actor.user.id]))
 const sourceLines=readSlackZip(backup).files.get('import.jsonl').toString('utf8').trim().split('\n').map(JSON.parse),sourcePosts=sourceLines.filter(r=>['post','direct_post'].includes(r.type)).flatMap(r=>{const p=r[r.type];return [p,...p.replies??[]]}),sourceByBody=new Map(sourcePosts.map(p=>[p.message,p])),missingSourceReactions=expected.posts.filter(p=>p.reactions.length&&sourceByBody.get(p.message)?.reactions==null)
 const base='/api/mattermost-imports'
 async function call(path,{body,bytes,actor=owner,status=200,method}={}){
  const response=await fetch(origin+path,{method:method??(body!==undefined||bytes?'POST':'GET'),headers:{Connection:'close',origin,cookie:actor.cookie,...(bytes?{'Content-Type':'application/zip'}:body!==undefined?{'Content-Type':'application/json'}:{})},body:bytes??(body!==undefined?JSON.stringify(body):undefined)}),raw=await response.text()
  assert.equal(response.status,status,`${path}: ${raw}`);return response.headers.get('content-type')?.includes('json')?JSON.parse(raw):raw
 }
 const accounts=await sql('SELECT id,role FROM oa_operators ORDER BY id'),upload=await call(base+'/upload',{bytes:backup}),review={namespace:'mattermost-'+suffix,actors:{...Object.fromEntries(upload.actors.map(a=>[a.sourceId,null])),...mapped},roles:Object.fromEntries(upload.roleInventory.map(role=>[role,'historical-only'])),acceptedOmissions:[]}
 let preview=await call(base+'/preview',{body:{upload:upload.upload,review}})
 if(preview.needsOmissionReview){review.acceptedOmissions=[preview.omissionDigest];preview=await call(base+'/preview',{body:{upload:upload.upload,review}})}
 await check('NOOK-046 genuine two-team Mattermost export reviews roles, original hashes and source state',async()=>{
  assert.equal(preview.counts.teams,expected.teams.length);assert.equal(preview.counts.files,expected.files.length)
  assert.equal(preview.counts.emoji,expected.emoji.length)
  assert.deepEqual(preview.emojiHashes.map(e=>({name:e.name,size:e.size,sha256:e.sha256})),expected.emoji.map(e=>({name:e.name,size:e.size,sha256:e.sha256})))
  assert.equal(preview.counts.sourceRecords,readSlackZip(backup).files.get('import.jsonl').toString('utf8').trim().split('\n').length)
  assert.equal(preview.counts.saved,expected.posts.reduce((n,p)=>n+p.saved_by.length,0))
  assert.equal(preview.counts.pinned,expected.posts.filter(p=>p.is_pinned).length)
  assert.equal(preview.counts.reactions,sourcePosts.reduce((n,p)=>n+(p.reactions??[]).length,0))
  assert.equal(preview.counts.reactions+missingSourceReactions.reduce((n,p)=>n+p.reactions.length,0),expected.posts.reduce((n,p)=>n+p.reactions.length,0))
  for(const post of missingSourceReactions){assert.ok(['D','G'].includes(expected.channels.find(c=>c.key===post.channel).type));assert.equal(post.root,null);assert.ok(preview.omissions.some(o=>o.reason==='source-direct-reactions-not-exported'&&o.createdAt===new Date(post.create_at).toISOString()))}
  assert.deepEqual(preview.fileHashes.map(f=>({name:f.name,size:f.size,sha256:f.sha256})).sort((a,b)=>a.name.localeCompare(b.name)),expected.files.map(f=>({name:f.name,size:f.size,sha256:f.sha256})).sort((a,b)=>a.name.localeCompare(b.name)))
  await call(base+'/preview',{body:{upload:upload.upload,review:{...review,roles:{}}},status:400})
  await call(base+'/preview',{body:{upload:upload.upload,review:{...review,roles:{...review.roles,system_admin:'owner'}}},status:400})
  await call(base+'/preview',{body:{upload:upload.upload,review:{...review,actors:{...review.actors,leo:mapped.maya}}},status:400})
  await call(base+'/upload',{bytes:backup,actor:outsider,status:403})
  await call(base+'/'+preview.review+'/apply',{body:{fingerprint:'changed-approval'},status:409})
  assert.doesNotMatch(JSON.stringify(preview),/"(?:password|password_hash|auth_data|access_token)"\s*:/)
 })
 async function finish(plan){
  let result=await call(base+'/'+plan.review+'/apply',{body:{fingerprint:plan.fingerprint}})
  while(!result.job&&result.files)result=await call(base+'/'+plan.review+'/apply',{body:{fingerprint:plan.fingerprint}})
  for(let n=0;result.job.state!=='completed'&&n<100;n++)result=await call(base+'/'+plan.review+'/resume',{body:{}})
  assert.equal(result.job.state,'completed');return result
 }
 await finish(preview)
 await restart()
 await call(base+'/'+preview.review+'/resume',{body:{}})
 const status=await call(base+'/'+preview.review),histories=new Map(),byBody=new Map(),channels=new Map()
 for(const destination of status.destinations){
  const source=upload.channels.find(c=>c.sourceId===destination.sourceId),actor=people[source.sourceMembers[0]],history=await call(`/api/conversations/${destination.id}/messages`,{actor})
  histories.set(destination.id,history);channels.set(destination.id,source)
  for(const message of history)byBody.set(message.body,message)
 }
 await check('NOOK-046 resumed inert history preserves authors, replies, reactions, saves, pins and private audiences',async()=>{
  await call(base+'/'+preview.review+'/apply',{body:{fingerprint:preview.fingerprint}})
  assert.deepEqual(await sql('SELECT id,role FROM oa_operators ORDER BY id'),accounts,'source system/team administrators gain no Nook role or credential')
  for(const post of expected.posts){
   const actual=byBody.get(post.message);assert.ok(actual,post.key);assert.equal(actual.provenance.actor,post.author);assert.equal(actual.created,new Date(post.create_at).toISOString());assert.equal(actual.immutable,true)
   assert.equal(actual.parent,post.root?byBody.get(expected.posts.find(p=>p.key===post.root).message).id:null)
   assert.deepEqual(actual.slack.reactions.map(r=>[r.name,r.count]).sort(),(sourceByBody.get(post.message).reactions??[]).map(r=>[r.emoji_name,1]).sort())
   assert.ok(!('flagged_by' in actual.provenance.sourceRecord));assert.ok(!('mappedSavedUsers' in actual.provenance.sourceRecord))
   const sourceChannel=expected.channels.find(c=>c.key===post.channel),actualMembers=await call(`/api/conversations/${actual.conversation}/members`,{actor:people[sourceChannel.members[0]]})
   assert.deepEqual(actualMembers.map(m=>m.id).sort(),sourceChannel.members.map(name=>mapped[name]).sort())
   if(sourceChannel.type!=='O'){
    await call(`/api/conversations/${actual.conversation}/messages/window`,{actor:outsider,status:403})
    await call(`/api/conversations/${actual.conversation}/messages/window`,{actor:owner,status:403})
   }
   for(const attachment of actual.attachments){const response=await fetch(origin+`/api/attachments/${attachment.id}/download`,{headers:{cookie:people[post.author].cookie}});assert.equal(response.status,200);const bytes=Buffer.from(await response.arrayBuffer()),file=expected.files.find(f=>f.post===post.key);assert.equal(hash(bytes),file.sha256);assert.equal(bytes.length,file.size);await call(`/api/attachments/${attachment.id}/download`,{actor:outsider,status:404})}
   if(sourceChannel.type==='O'||sourceChannel.type==='P'){
    const pins=await call(`/api/conversations/${actual.conversation}/pins`,{actor:people[post.author]});assert.equal(pins.items.some(p=>p.message?.id===actual.id),post.is_pinned)
    if(post.is_pinned)assert.equal(pins.items.find(p=>p.message?.id===actual.id).pinnedBy,null)
   }
  }
  for(const [name,actor]of Object.entries(people)){
   const saves=(await call('/api/saved',{actor})).items
   for(const post of expected.posts)assert.equal(saves.some(s=>s.message?.id===byBody.get(post.message).id),post.saved_by.includes(name),name+' private saved state')
  }
  const root=byBody.get(expected.posts.find(p=>p.key==='public-root').message),emoji=expected.emoji[0],response=await fetch(origin+`/api/mattermost-emoji/${root.conversation}/${emoji.name}`,{headers:{cookie:people.maya.cookie}})
  assert.equal(response.status,200);assert.equal(hash(Buffer.from(await response.arrayBuffer())),emoji.sha256)
  await call(`/api/mattermost-emoji/${root.conversation}/${emoji.name}`,{actor:outsider,status:403})
  assert.equal((await sql(`SELECT COUNT(*) AS n FROM nook_import_records WHERE job=(SELECT domain_job FROM nook_import_reviews WHERE id='${preview.review}')`))[0].n,preview.counts.messages)
  assert.equal((await sql(`SELECT COUNT(*) AS n FROM nook_events WHERE conversation IN (SELECT conversation FROM nook_import_channels WHERE job=(SELECT domain_job FROM nook_import_reviews WHERE id='${preview.review}'))`))[0].n,0)
  for(const [id,source]of channels){const actor=people[source.sourceMembers[0]],conversation=(await call('/api/conversations',{actor})).find(c=>c.id===id);assert.equal(conversation.unread,0)}
  await validateArchive()
 })
 await check('NOOK-046 missing files, unsupported versions and ambiguous memberships are refused; deleted and unsupported records are inventoried',async()=>{
  const source=readSlackZip(backup).files,raw=source.get('import.jsonl').toString('utf8').trim().split('\n').map(JSON.parse)
  const changed=mutate=>{const entries=new Map(source);mutate(entries);return zipFixture([...entries],{deflate:true})}
  for(const kind of ['version','file','membership']){
   const bytes=changed(entries=>{
    const lines=structuredClone(raw)
    if(kind==='version')lines[0].version=999
    if(kind==='file'){const record=lines.find(r=>r.post?.attachments?.length||r.direct_post?.attachments?.length),post=record.post??record.direct_post;entries.delete('data/'+post.attachments[0].path)}
    if(kind==='membership'){const user=lines.find(r=>r.type==='user'&&r.user.teams?.some(t=>t.channels?.length));const team=user.user.teams.find(t=>t.channels?.length);team.channels.push(structuredClone(team.channels[0]))}
    entries.set('import.jsonl',lines.map(r=>JSON.stringify(r)).join('\n')+'\n')
   })
   await call(base+'/upload',{bytes,status:400})
  }
  const withOmissions=changed(entries=>{const lines=structuredClone(raw),post=lines.find(r=>r.type==='post'&&!r.post.type);lines.push({...structuredClone(post),post:{...post.post,delete_at:post.post.create_at+1}});lines.push({type:'future_record',future_record:{name:'unknown'}});entries.set('import.jsonl',lines.map(r=>JSON.stringify(r)).join('\n')+'\n')})
  const negative=await call(base+'/upload',{bytes:withOmissions});assert.ok(negative.omissions.some(o=>o.reason==='deleted-source-post'));assert.ok(negative.omissions.some(o=>o.reason==='unsupported-record-type'))
 })
 await check('NOOK-046 an interrupted multi-batch import resumes from its durable checkpoint without duplicate history',async()=>{
  const entries=new Map(readSlackZip(backup).files),lines=entries.get('import.jsonl').toString('utf8').trim().split('\n').map(JSON.parse),source=lines.find(r=>r.type==='post'&&!r.post.type).post
  for(let i=0;i<1205;i++)lines.push({type:'post',post:{...source,message:source.message+' · continuation '+i,create_at:source.create_at+i+1,edit_at:0,replies:[],attachments:[],reactions:[],flagged_by:[],is_pinned:false}})
  entries.set('import.jsonl',lines.map(r=>JSON.stringify(r)).join('\n')+'\n')
  const large=await call(base+'/upload',{bytes:zipFixture([...entries],{deflate:true})}),choices={...review,namespace:review.namespace+'-resume',acceptedOmissions:[]}
  let planned=await call(base+'/preview',{body:{upload:large.upload,review:choices}})
  if(planned.needsOmissionReview){choices.acceptedOmissions=[planned.omissionDigest];planned=await call(base+'/preview',{body:{upload:large.upload,review:choices}})}
  let progress=await call(base+'/'+planned.review+'/apply',{body:{fingerprint:planned.fingerprint}})
  while(!progress.job)progress=await call(base+'/'+planned.review+'/apply',{body:{fingerprint:planned.fingerprint}})
  assert.ok(progress.job.checkpoint<progress.job.total,'the first request leaves actual durable work to resume')
  const checkpoint=progress.job.checkpoint;await restart()
  const recovered=await call(base+'/'+planned.review);assert.equal(recovered.job.checkpoint,checkpoint)
  for(let n=0;progress.job.state!=='completed'&&n<100;n++)progress=await call(base+'/'+planned.review+'/resume',{body:{}})
  assert.equal(progress.job.state,'completed')
  await call(base+'/'+planned.review+'/apply',{body:{fingerprint:planned.fingerprint}})
  assert.equal((await sql(`SELECT COUNT(*) AS n FROM nook_import_records WHERE job=(SELECT domain_job FROM nook_import_reviews WHERE id='${planned.review}')`))[0].n,planned.counts.messages)
  let undone=await call(base+'/'+planned.review+'/undo',{body:{}})
  for(let n=0;undone.job.state!=='undone'&&n<100;n++)undone=await call(base+'/'+planned.review+'/undo',{body:{}})
  assert.equal(undone.job.state,'undone')
 })
 await check('NOOK-046 supplied direct/group reactions survive even when the upstream exporter omits its own roots',async()=>{
  const entries=new Map(readSlackZip(backup).files),lines=structuredClone(sourceLines)
  for(const post of missingSourceReactions){const source=lines.find(r=>r.type==='direct_post'&&r.direct_post.message===post.message).direct_post;source.reactions=post.reactions.map(r=>({user:r.user,emoji_name:r.emoji_name,create_at:post.create_at+1}))}
  entries.set('import.jsonl',lines.map(r=>JSON.stringify(r)).join('\n')+'\n')
  const supplied=await call(base+'/upload',{bytes:zipFixture([...entries],{deflate:true})}),choices={...review,namespace:review.namespace+'-supplied',acceptedOmissions:[]}
  let planned=await call(base+'/preview',{body:{upload:supplied.upload,review:choices}})
  if(planned.needsOmissionReview){choices.acceptedOmissions=[planned.omissionDigest];planned=await call(base+'/preview',{body:{upload:supplied.upload,review:choices}})}
  assert.equal(planned.counts.reactions,expected.posts.reduce((n,p)=>n+p.reactions.length,0));await finish(planned)
  for(const channel of (await call(base+'/'+planned.review)).destinations){const room=supplied.channels.find(c=>c.sourceId===channel.sourceId);if(room.kind!=='dm')continue;const messages=await call(`/api/conversations/${channel.id}/messages`,{actor:people[room.sourceMembers[0]]});for(const post of missingSourceReactions){const message=messages.find(m=>m.body===post.message);if(message)assert.deepEqual(message.slack.reactions.map(r=>[r.name,r.count]).sort(),post.reactions.map(r=>[r.emoji_name,1]).sort())}}
  let undone=await call(base+'/'+planned.review+'/undo',{body:{}})
  for(let n=0;undone.job.state!=='undone'&&n<100;n++)undone=await call(base+'/'+planned.review+'/undo',{body:{}})
  assert.equal(undone.job.state,'undone')
 })
 const root=byBody.get(expected.posts.find(p=>p.key==='public-root').message),native=await call(`/api/conversations/${root.conversation}/messages`,{body:{body:'Native launch decision after Mattermost migration',intent:crypto.randomUUID()},actor:people.maya})
 await check('NOOK-046 guarded undo preserves subsequent native work and clean reversal removes only its own history',async()=>{
  await call(base+'/'+preview.review+'/undo',{body:{},status:409})
  assert.ok((await call(`/api/conversations/${root.conversation}/messages`,{actor:people.maya})).some(m=>m.id===native.id))
  const cleanReview={...review,namespace:review.namespace+'-undo'},clean=await call(base+'/preview',{body:{upload:upload.upload,review:cleanReview}})
  await finish(clean)
  let undone=await call(base+'/'+clean.review+'/undo',{body:{}})
  for(let n=0;undone.job.state!=='undone'&&n<100;n++)undone=await call(base+'/'+clean.review+'/undo',{body:{}})
  assert.equal(undone.job.state,'undone')
  assert.ok((await call(`/api/conversations/${root.conversation}/messages`,{actor:people.maya})).some(m=>m.id===native.id));await validateArchive()
 })
 return {call,base,upload,preview,people,mapped,outsider,byBody,expected,backup}
}
