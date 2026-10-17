import assert from 'node:assert/strict';
import {request as httpRequest} from 'node:http';
import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {signIn} from './auth-support.mjs';
export async function storageGuards(h){
 const {check,post,patch,get,request,owner,member,outsider,origin,fnId,facts,restart,root}=h;
 const c=(await post('/api/conversations',{name:'Guarded private history',kind:'private',participants:[member.user.id]})).data,path='/api/conversations/'+c.id;
 const foreign=(await post('/api/conversations',{name:'Foreign roots',participants:[]})).data;
 const rootMessage=(await post(path+'/messages',{body:'Guard root',intent:'guard-root'})).data,foreignRoot=(await post('/api/conversations/'+foreign.id+'/messages',{body:'Foreign root',intent:'foreign-root'})).data;
 let reply;
 await check('fixed DMs, thread roots, exact mutation versions and terminal outcome controls',async()=>{
  const dm=(await post('/api/conversations',{name:'Fixed DM',kind:'dm',participants:[member.user.id]})).data;await post('/api/conversations/'+dm.id+'/members',{user:outsider.user.id},owner.cookie,403);
  await post(path+'/messages',{body:'Wrong scope',intent:'wrong-scope',parent:foreignRoot.id},owner.cookie,400);
  reply=(await post(path+'/messages',{body:'Guard foreign reply',intent:'guard-reply',parent:rootMessage.id},member.cookie)).data;
  await post(path+'/messages',{body:'Nested reply',intent:'nested-reply',parent:reply.id},owner.cookie,400);
  await patch('/api/messages/'+rootMessage.id,{body:'Wrong author',version:1},member.cookie,403);
  const updates=await Promise.all([0,1].map(async i=>{const response=await fetch(origin()+'/api/messages/'+rootMessage.id,{method:'PATCH',headers:{Origin:origin(),Cookie:owner.cookie,'Content-Type':'application/json'},body:JSON.stringify({body:'Concurrent edit '+i,version:1})});return response.status}));assert.deepEqual(updates.sort(),[200,409]);
  const decision=(await post(path+'/outcomes',{kind:'decision',body:'Recorded decision',source:rootMessage.id})).data;await patch('/api/outcomes/'+decision.id,{body:'Not author',version:1},member.cookie,403);await patch('/api/outcomes/'+decision.id,{body:'Revised decision',version:1});
  const cancelled=(await post(path+'/outcomes',{kind:'commitment',body:'Cancelled work',assignee:member.user.id})).data;await patch('/api/outcomes/'+cancelled.id,{action:'cancel',version:1});await patch('/api/outcomes/'+cancelled.id,{action:'accept',version:2},member.cookie,403);await patch('/api/outcomes/'+cancelled.id,{body:'Cannot reopen',version:2},owner.cookie,409);
  const due=(await post(path+'/outcomes',{kind:'commitment',body:'Same work',assignee:member.user.id,deadline:'2026-10-05'})).data;await patch('/api/outcomes/'+due.id,{action:'accept',version:1},member.cookie);assert.equal((await patch('/api/outcomes/'+due.id,{body:'Same work',deadline:'2026-10-06',version:2})).data.status,'proposed');await patch('/api/outcomes/'+due.id,{action:'accept',version:2},member.cookie,409);await patch('/api/outcomes/'+due.id,{body:'Wrong scope',conversation:foreign.id,version:3},owner.cookie,400);
 });
 await check('cached sender retries, files, search and loader recheck removed membership',async()=>{
  const file=(await post(path+'/attachments',{name:'guarded.txt',mime:'text/plain',data:Buffer.from('Guarded private R2 bytes').toString('base64')})).data;
  await post(path+'/messages',{body:'Steal staged',intent:'stolen-stage',attachments:[file.id]},member.cookie,400);await post('/api/conversations/'+foreign.id+'/messages',{body:'Cross-scope staged',intent:'foreign-stage',attachments:[file.id]},owner.cookie,400);
  const intent={body:'GuardedSearchMarker',intent:'guard-file',attachments:[file.id]},bound=(await post(path+'/messages',intent)).data;
  assert.equal((await get('/api/attachments/'+file.id+'/download',member.cookie)).raw,'Guarded private R2 bytes');await patch('/api/attachments/'+file.id,{delete:true},member.cookie,403);await post(path+'/messages',{body:'Rebind',intent:'rebind-stage',attachments:[file.id]},owner.cookie,400);
  await post(path+'/members',{user:member.user.id,remove:true});await post(path+'/messages',{body:'Guard foreign reply',intent:'guard-reply',parent:rootMessage.id},member.cookie,403);
  for(const suffix of ['messages','messages/window','replay','outcomes','members','preferences'])await get(path+'/'+suffix,member.cookie,403);await post(path+'/read',{seq:0},member.cookie,403);await get('/api/attachments/'+file.id+'/download',member.cookie,404);assert.equal((await get('/api/search?q=GuardedSearchMarker',member.cookie)).data.items.length,0);
  const rpc=await request('/_serverFn/'+fnId,{cookie:member.cookie,extra:{'x-tsr-serverFn':'true'}});assert.doesNotMatch(rpc.raw,/Guarded private history/);
  await post(path+'/members',{user:member.user.id});assert.ok((await get(path+'/messages',member.cookie)).data.some(m=>m.id===bound.id));await patch('/api/messages/'+bound.id,{delete:true,version:1});await post(path+'/messages',intent,owner.cookie,409);await post(path+'/messages',{body:'Deleted root',intent:'deleted-root',parent:bound.id},member.cookie,400);assert.equal((await get('/api/search?q=GuardedSearchMarker')).data.items.length,0);
 });
 await check('history cursor admission, multisession monotonic reads and restart preserve committed rows',async()=>{
  const before=await facts();for(const after of ['not-a-cursor',rootMessage.id,rootMessage.created+'missing',foreignRoot.created+foreignRoot.id])await get(path+'/messages?after='+encodeURIComponent(after),owner.cookie,400);assert.deepEqual(await facts(),before);
  const frontier=(await get(path+'/replay')).data.frontier;await get(path+'/replay?after='+(frontier+1),owner.cookie,400);await post(path+'/read',{seq:frontier+1},owner.cookie,400);
  const other=await signIn(origin(),'nativeowner@example.test');await post(path+'/read',{seq:frontier},other.cookie);await post(path+'/read',{seq:0});assert.equal((await get('/api/conversations')).data.find(row=>row.id===c.id).readSeq,frontier);
  const list=(await get('/api/conversations')).data,counts=await facts();await restart();assert.deepEqual(await facts(),counts);assert.deepEqual((await get('/api/conversations')).data,list);assert.equal((await get('/api/me')).data.id,owner.user.id);
 });
 await check('public origin/input/host boundaries and emitted asset isolation remain enforced',async()=>{
  for(const body of [null,[],42,'bad',{body:'  ',intent:'empty'},{body:'x'.repeat(40001),intent:'bounded'},{body:'x',intent:'y'.repeat(129)}])await post(path+'/messages',body,owner.cookie,400);
  await request('/api/conversations',{method:'POST',body:{name:'Wrong type'},cookie:owner.cookie,status:415,extra:{'content-type':'text/plain'}});
  for(const after of ['-1','1.5','NaN'])await get(path+'/replay?after='+after,owner.cookie,400);for(const limit of ['0','1001','1.5','NaN'])await get(path+'/messages?limit='+limit,owner.cookie,400);
  await post(path+'/messages',{body:'x'.repeat(262145),intent:'oversized-json'},owner.cookie,413);await request('/api/conversations',{method:'POST',body:{name:'Cross origin'},cookie:owner.cookie,status:403,extra:{origin:'https://attacker.invalid'}});
  for(const path of ['/missing','/assets/missing.js','/@vite/client'])await get(path,owner.cookie,404);
  const status=await new Promise((ok,bad)=>{const q=httpRequest(origin()+'/api/me',{headers:{host:'unsupported.invalid',cookie:owner.cookie}},r=>{r.resume();r.once('end',()=>ok(r.statusCode))});q.on('error',bad);q.end()});assert.equal(status,404);assert.equal((await request('/health')).data.status,'ok');await request('/');
  for(const file of (await readdir(resolve(root,'dist/client/assets'))).filter(name=>name.endsWith('.js')))assert.doesNotMatch(await readFile(resolve(root,'dist/client/assets',file),'utf8'),/cloudflare:workers|passwordHash|UPDATE nook_messages/);
 });
}
