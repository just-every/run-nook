import assert from 'node:assert/strict';

// Slack-compatible incoming webhooks through the real Worker: the exact request shapes the slackapi/slack-github-action step and a
// curl post produce (JSON, and the form `payload=` body), rendering, threads, every Slack error string with nothing committed, and
// revocation. No outbound call is made and no Slack SDK or real GitHub Action runs.
export async function notificationWebhooks({call,db,ownerCookie,origin}){
 const messages=async room=>await call(`/api/conversations/${room.id}/messages`,'GET',undefined,ownerCookie);
 const count=async()=>(await db.prepare('SELECT count(*) AS n FROM nook_messages').first()).n;
 const hook=async(token,body,{type='application/json',raw}={})=>fetch(`${origin}/hooks/slack/${token}`,{method:'POST',headers:{'content-type':type},body:raw??(type==='application/json'?JSON.stringify(body):new URLSearchParams({payload:JSON.stringify(body)}).toString())});
 const refused=async(token,body,status,code,options)=>{const before=await count(),response=await hook(token,body,options);assert.equal(response.status,status,code);assert.equal(await response.text(),code);assert.equal(await count(),before,code+' commits no message');return response};
 const room=await call('/api/conversations','POST',{name:'Webhook alerts',kind:'private'},ownerCookie);
 const approval=(await call('/api/notification-apps','POST',{name:'GitHub Actions',channels:[room.id]},ownerCookie)).approvals[0],token=approval.token;
 // The JSON body a repointed slack-github-action incoming-webhook step sends, with blocks, mrkdwn and ignored presentation fields.
 const rich=await hook(token,{text:'Build *passed* on <https://example.test/run/1|run 1>',username:'ci-bot',icon_emoji:':rocket:',icon_url:'https://example.test/icon.png',unfurl_links:true,mrkdwn:true,blocks:[{type:'header',text:{type:'plain_text',text:'Deploy'}},{type:'section',text:{type:'mrkdwn',text:'*main* deployed'},fields:[{type:'mrkdwn',text:'*Env*\nprod'}]},{type:'divider'},{type:'context',elements:[{type:'mrkdwn',text:'by ci'}]}]});
 assert.equal(rich.status,200);assert.equal(await rich.text(),'ok');
 let posted=(await messages(room)).find(m=>m.body.includes('Deploy'));assert.ok(posted,'the blocks render');
 for(const part of ['## Deploy','**main** deployed','**Env**\nprod','---','by ci','Build **passed** on [run 1](https://example.test/run/1)'])assert.ok(posted.body.includes(part)||posted.body.includes(part.replace('\n\n','\n')),part);
 assert.equal(posted.authorName,'GitHub Actions');assert.equal(posted.app,1,'shown as the app, never as a person');assert.ok(!posted.body.includes('ci-bot')&&!posted.body.includes('icon.png'),'username and icon are never shown as a person or fetched');
 // The form `payload=` shape, and a curl post with text only.
 assert.equal(await (await hook(token,{text:'Form payload post'},{type:'application/x-www-form-urlencoded'})).text(),'ok');
 assert.equal(await (await hook(token,{text:'curl post'})).text(),'ok');
 const roots=await messages(room),root=roots.find(m=>m.body==='curl post');
 // thread_ts lands the post in that thread.
 assert.equal(await (await hook(token,{text:'Threaded reply',thread_ts:root.id})).text(),'ok');
 const thread=await call(`/api/conversations/${room.id}/messages/window?thread=${root.id}`,'GET',undefined,ownerCookie);assert.ok(thread.items.some(m=>m.body==='Threaded reply'&&m.parent===root.id));
 // Unsupported formatting falls back to the text with a visible notice.
 assert.equal(await (await hook(token,{text:'Fallback text',blocks:[{type:'image',image_url:'https://example.test/chart.png',alt_text:'chart'}]})).text(),'ok');
 const fallback=(await messages(room)).find(m=>m.body.includes('Fallback text'));assert.ok(fallback.body.includes('Nook does not support')&&!fallback.body.includes('chart.png'));
 // Slack's error strings, each with no message committed.
 await refused(token,{},400,'no_text');await refused(token,{text:'   '},400,'no_text');
 await refused(token,undefined,400,'invalid_payload',{raw:'{not json'});await refused(token,undefined,400,'invalid_payload',{raw:'[1]'});await refused(token,undefined,400,'invalid_payload',{type:'text/plain',raw:'hello'});
 await refused(token,{text:'x'.repeat(120_000)},400,'invalid_payload');
 await refused(token,{text:'No such thread',thread_ts:'no-such-thread'},404,'channel_not_found');
 const details=await call('/api/channels/'+room.id+'/details','GET',undefined,ownerCookie);
 await call('/api/channels/'+room.id+'/posting','PATCH',{version:details.version,level:'admins',replies:'everyone',people:[]},ownerCookie);
 await refused(token,{text:'Blocked by the posting fence'},403,'action_prohibited');
 const again=await call('/api/channels/'+room.id+'/details','GET',undefined,ownerCookie);await call('/api/channels/'+room.id+'/posting','PATCH',{version:again.version,level:'everyone',replies:'everyone',people:[]},ownerCookie);
 // Rate limit: the channel's burst is spent, then 429 with Retry-After.
 const burst=await call('/api/conversations','POST',{name:'Webhook burst',kind:'private'},ownerCookie),fast=(await call('/api/notification-apps','POST',{name:'Burst app',channels:[burst.id]},ownerCookie)).approvals[0].token;
 const statuses=[];for(let n=0;n<24;n++)statuses.push(await hook(fast,{text:'burst '+n}));
 assert.ok(statuses.slice(0,20).every(r=>r.status===200)&&statuses.some(r=>r.status===429));const limited=statuses.find(r=>r.status===429);assert.equal(await limited.text(),'rate_limited');assert.ok(Number(limited.headers.get('retry-after'))>=1);
 // A revoked or unknown URL changes nothing and says no_service.
 const live=await count();await call(`/api/notification-apps/${approval.id}/revoke`,'POST',{},ownerCookie);
 await refused(token,{text:'After revoke'},404,'no_service');await refused('nookapp_00000000-0000-0000-0000-000000000000.'+'A'.repeat(43),{text:'Unknown'},404,'no_service');assert.equal(await count(),live);
 const listed=JSON.stringify(await call('/api/notification-apps','GET',undefined,ownerCookie));assert.ok(!listed.includes(token.split('.')[1]),'the URL secret is shown once and never listed');
}
