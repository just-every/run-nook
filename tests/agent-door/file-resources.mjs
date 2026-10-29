// Extend the registered native file-policy case through the public MCP door.
// The fixture uses a fresh production Worker and native person/Business setup.
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {installation} from './installation.mjs';
import {autonomousPolicy} from '../../src/base/modules/agent-door/conformance/crypto.mjs';
import {errorCode} from '../../src/base/modules/agent-door/conformance/protocol.mjs';

export async function fileResourceJourney(){
 const f=await installation();
 try{
  const owner=f.protocol(),member=f.protocol({email:f.roster[0].email,cookie:f.roster[0].cookie,sub:f.roster[0].id});
  await owner.adopt(autonomousPolicy());
  const native=async(path,{cookie=f.owner.cookie,method='GET',body,bytes}={})=>f.request(path,{method,headers:{Origin:f.origin,Cookie:cookie,'Content-Type':bytes?'application/octet-stream':'application/json'},...(body===undefined&&bytes===undefined?{}:{body:bytes??JSON.stringify(body)})});
  const json=async(path,options)=>{const response=await native(path,options);assert.equal(response.status,200,path);return response.json()};
  const ari=(await json('/api/team')).find(person=>person.email===f.roster[0].email);
  const room=await json('/api/conversations',{method:'POST',body:{name:'Private upload visibility',kind:'private',participants:[ari.id]}});
  const resource=(protocol,id)=>protocol.mcp('resources/read',{uri:'nook://files/'+id});
  const missing=await resource(member,randomUUID());
  assert.equal(errorCode(missing),'resource_unavailable');assert.equal(missing.result,undefined);
  const hidden=async(id,state)=>{
   const response=await native('/api/uploads/'+id,{cookie:f.roster[0].cookie});assert.equal(response.status,404,state+' is uploader-only natively');await response.body?.cancel();
   const answer=await resource(member,id);
   assert.deepEqual(answer.body.error,missing.body.error,state+' MCP read must match a missing file');
   assert.equal(answer.result,undefined,state+' must return no metadata');
  };
  const metadata=async(protocol,id)=>{
   const answer=await resource(protocol,id);assert.equal(errorCode(answer),null);assert.equal(answer.status,200);
   assert.equal(answer.result?.contents?.length,1);
   const row=JSON.parse(answer.result.contents[0].text);
   assert.deepEqual(Object.keys(row).sort(),['id','conversation','author','message','name','mime','size','state','expires','created'].sort());
   assert.equal(row.id,id);return row;
  };
  const bytes=Buffer.from('Private upload evidence'),name='casey-private-evidence.txt';
  const upload=await json('/api/conversations/'+room.id+'/uploads',{method:'POST',body:{name,mime:'text/plain',size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),intent:randomUUID()}});
  assert.equal(upload.state,'reserved');assert.equal(upload.file,null);
  const row=await f.database.prepare('SELECT state,message FROM nook_attachments WHERE id=?').bind(upload.id).first();assert.deepEqual(row,{state:'reserved',message:null});
  await hidden(upload.id,'reserved');
  const reserved=await metadata(owner,upload.id);assert.equal(reserved.state,'reserved');assert.equal(reserved.name,name);
  await json('/api/uploads/'+upload.id+'/parts/1',{method:'PUT',bytes});
  const completed=await json('/api/uploads/'+upload.id+'/complete',{method:'POST',body:{}});assert.equal(completed.state,'staged');
  await hidden(upload.id,'staged');assert.equal((await metadata(owner,upload.id)).state,'staged');
  const message=await json('/api/conversations/'+room.id+'/messages',{method:'POST',body:{body:'Shared file evidence',attachments:[upload.id],intent:randomUUID()}});
  const shared=await native('/api/attachments/'+upload.id+'/download',{cookie:f.roster[0].cookie});assert.equal(shared.status,200);assert.equal(await shared.text(),bytes.toString());
  const attached=await metadata(member,upload.id);assert.equal(attached.state,'attached');assert.equal(attached.message,message.id);assert.equal(attached.name,name);assert.equal(attached.size,bytes.length);
  await json('/api/conversations/'+room.id+'/members',{method:'POST',body:{user:ari.id,remove:true}});
  const revoked=await native('/api/attachments/'+upload.id+'/download',{cookie:f.roster[0].cookie});assert.equal(revoked.status,404);await revoked.body?.cancel();
  assert.deepEqual((await resource(member,upload.id)).body.error,missing.body.error,'attached file disappears after native membership removal');
  await json('/api/attachments/'+upload.id,{method:'PATCH',body:{delete:true}});
  await hidden(upload.id,'deleted');
  const deleted=await resource(owner,upload.id);assert.deepEqual(deleted.body.error,missing.body.error);assert.equal(deleted.result,undefined);
  console.log('NOOK_FILE_RESOURCES '+JSON.stringify({private_channel:true,reserved_native:404,reserved_mcp:'resource_unavailable',staged_native:404,staged_mcp:'resource_unavailable',uploader_metadata:true,attached_native:200,attached_mcp:'readable',membership_removed_mcp:'resource_unavailable',deleted_mcp:'resource_unavailable',metadata_keys:10,new_registrations:0}));
 }finally{await f.close()}
}
