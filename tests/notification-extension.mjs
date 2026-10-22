import assert from 'node:assert/strict';

export async function notificationExtension(app){
 const {call,ownerCookie,db,origin}=app;
 const room=await call('/api/conversations','POST',{name:'Release thread review',kind:'private'},ownerCookie);
 const person=await app.invite('synthetic-nook-89',room.id);
 const approve=async(name,channel=room)=> (await call('/api/notification-apps','POST',{name,channels:[channel.id]},ownerCookie)).approvals[0];
 const first=await approve('Release updates'),other=await approve('Support updates');
 const request=async(approval,method,path,body,key='synthetic-nook-89')=>fetch(origin+`/api/notification-destinations/${approval.conversation}/${path}`,{method,headers:{authorization:'Bearer '+approval.token,'content-type':'application/json','idempotency-key':key},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const post=async(approval,body,key)=>{const response=await request(approval,'POST','messages',body,key);assert.equal(response.status,200,await response.clone().text());return response.json()};
 const lookup=async(approval,key)=>{const response=await request(approval,'GET','client-keys/'+key);assert.equal(response.status,200,await response.clone().text());return response.json()};
 const root=await post(first,{body:'Launch review is open.'},'root');
 await call('/api/messages/'+root.id+'/follow','POST',{follow:true},person.cookie);
 const reply=await post(first,{body:'The support checklist needs review.',thread:root.id},'reply');
 const visible=await call('/api/messages/'+reply.id,'GET',undefined,person.cookie);
 assert.equal(visible.parent,root.id);assert.equal(visible.app,1);assert.equal(visible.authorName,'Release updates');
 assert.ok((await call('/api/attention','GET',undefined,person.cookie)).items.some(item=>item.message?.id===reply.id&&item.reason==='thread-follow'));
 const before=await db.prepare('SELECT count(*) AS n FROM nook_messages').first();
 assert.deepEqual(await post(first,{body:'The support checklist needs review.',thread:root.id},'reply'),reply);
 assert.deepEqual(await lookup(first,'reply'),{accepted:true,receipt:reply.receipt});
 assert.equal(reply.receipt.id,reply.id);assert.equal(reply.receipt.version,1);assert.equal(reply.receipt.acceptedAt,reply.created);
 assert.deepEqual(await db.prepare('SELECT count(*) AS n FROM nook_messages').first(),before);
 assert.deepEqual(await lookup(other,'reply'),await lookup(first,'never-accepted'));
 const foreign=await call('/api/conversations','POST',{name:'Separate review',kind:'private'},ownerCookie),sameName=await approve('Release updates',foreign);
 assert.deepEqual(await lookup(sameName,'reply'),await lookup(first,'never-accepted'));
 const foreignRoot=await post(sameName,{body:'Separate private launch.'},'foreign-root');
 const missing=await request(first,'POST','messages',{body:'No disclosure',thread:'synthetic-nook-missing'},'missing');
 const elsewhere=await request(first,'POST','messages',{body:'No disclosure',thread:foreignRoot.id},'elsewhere');
 assert.equal(missing.status,400);assert.equal(elsewhere.status,missing.status);assert.deepEqual(await elsewhere.json(),await missing.json());
 const replacement=await approve('Release updates');
 const changed=await request(replacement,'PATCH','messages/'+reply.id,{body:'The support checklist is ready for human review.',version:1});
 assert.equal(changed.status,200,await changed.clone().text());assert.equal((await changed.json()).version,2);
 assert.deepEqual(await lookup(replacement,'reply'),{accepted:true,receipt:reply.receipt});
 assert.deepEqual(await post(replacement,{body:'The support checklist needs review.',thread:root.id},'reply'),reply);
 const history=(await db.prepare('SELECT body FROM nook_revisions WHERE message=? ORDER BY version').bind(reply.id).all()).results;
 assert.ok(JSON.stringify(history).includes('The support checklist needs review.'));assert.ok(JSON.stringify(history).includes('The support checklist is ready for human review.'));
 assert.ok((await call('/api/team/audit','GET',undefined,ownerCookie)).items.some(row=>row.kind==='notification-app.write'&&row.reason.includes(reply.id)));
 for(const approval of [first,other,sameName]){
  const response=await request(approval,'PATCH','messages/'+reply.id,{body:'Unauthorized edit',version:2});assert.equal(response.status,404);
 }
 assert.equal((await request(first,'GET','client-keys/reply')).status,404);
 // Replies follow the same NOOK-066 fence, including an explicit reply exception.
 let details=await call('/api/channels/'+room.id+'/details','GET',undefined,ownerCookie);
 await call('/api/channels/'+room.id+'/posting','PATCH',{version:details.version,level:'admins',replies:'everyone',people:[]},ownerCookie);
 assert.equal((await request(replacement,'POST','messages',{body:'Restricted root'},'restricted')).status,403);
 const permitted=await post(replacement,{body:'Reply under the channel reply rule.',thread:root.id},'permitted-reply');assert.equal((await call('/api/messages/'+permitted.id,'GET',undefined,person.cookie)).parent,root.id);
 details=await call('/api/channels/'+room.id+'/details','GET',undefined,ownerCookie);
 await call('/api/channels/'+room.id+'/posting','PATCH',{version:details.version,level:'everyone',replies:'same',people:[]},ownerCookie);
 await call('/api/erasures','POST',{kind:'message',target:reply.id,confirmation:'ERASE'},ownerCookie);
 assert.deepEqual(await lookup(replacement,'reply'),{accepted:false,state:'tombstone'});
 await call('/api/erasures','POST',{kind:'message',target:root.id,confirmation:'ERASE'},ownerCookie);
 const deleted=await request(replacement,'POST','messages',{body:'No deleted root',thread:root.id},'deleted-root');assert.equal(deleted.status,400);assert.deepEqual(await deleted.json(),await (await request(replacement,'POST','messages',{body:'No root',thread:'synthetic-nook-missing'},'missing-again')).json());
 details=await call('/api/channels/'+room.id+'/details','GET',undefined,ownerCookie);
 await call('/api/channels/'+room.id+'/archive','POST',{version:details.version,archived:true},ownerCookie);
 assert.equal((await request(replacement,'GET','client-keys/root')).status,409);
 details=await call('/api/channels/'+room.id+'/details','GET',undefined,ownerCookie);
 await call('/api/channels/'+room.id+'/archive','POST',{version:details.version,archived:false},ownerCookie);
 await call('/api/notification-apps/'+replacement.id+'/remove','POST',{},ownerCookie);
 assert.equal((await request(replacement,'GET','client-keys/root')).status,404);
}
