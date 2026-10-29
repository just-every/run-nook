import assert from 'node:assert/strict';
import {stringify} from 'node:querystring';

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
 await slackWebApi({call,db,ownerCookie,origin},room);
}

// The Slack Web API at /api/slack/<method> through the real Worker. Requests are shaped exactly as @slack/web-api sends them (POST,
// form-encoded, objects as JSON strings, the token only in Authorization); a slack_sdk-style JSON body and GET are sent too. Writes
// go through the notification-destination door. No Slack SDK runs and no outbound call is made.
async function slackWebApi({call,db,ownerCookie,origin},elsewhere){
 const counts=async()=>await db.prepare('SELECT (SELECT count(*) FROM nook_messages) AS messages,(SELECT total(version) FROM nook_messages) AS versions,(SELECT count(*) FROM nook_audit) AS audit').first();
 const audited=async kind=>(await db.prepare('SELECT count(*) AS n FROM nook_audit WHERE kind=?').bind('notification-app.'+kind).first()).n;
 const row=async id=>await db.prepare('SELECT body,deleted,version,parent FROM nook_messages WHERE id=?').bind(id).first();
 const api=(method,options,token)=>fetch(`${origin}/api/slack/${method}`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',...(token?{authorization:'Bearer '+token}:{}),'user-agent':'@slack:web-api/7.9.1 node/22.20.0'},body:stringify(Object.fromEntries(Object.entries(options).map(([k,v])=>[k,typeof v==='object'?JSON.stringify(v):v])))});
 const json=(method,payload,token)=>fetch(`${origin}/api/slack/${method}`,{method:'POST',headers:{'content-type':'application/json;charset=utf-8',authorization:'Bearer '+token},body:JSON.stringify(payload)});
 const ok=async response=>{response=await response;const body=await response.json();assert.equal(response.status,200);assert.equal(body.ok,true,JSON.stringify(body));return body};
 const refused=async(error,request)=>{const before=await counts(),response=await request();assert.deepEqual(await response.json(),{ok:false,error});const after=await counts();assert.deepEqual([after.messages,after.versions],[before.messages,before.versions],error+' commits nothing');return {before,after}};
 const room=await call('/api/conversations','POST',{name:'Web API alerts',kind:'private'},ownerCookie);
 const approve=async(name,channel=room)=>(await call('/api/notification-apps','POST',{name,channels:[channel.id]},ownerCookie)).approvals[0];
 const app=await approve('Deploy bot'),token=app.token,other=(await approve('Other bot')).token;
 // auth.test names the app identity and the workspace, and nobody's personal data.
 const identity=await ok(api('auth.test',{},token));
 assert.equal(identity.user,'Deploy bot');assert.equal(identity.user_id,identity.bot_id);assert.equal(identity.url,origin+'/');assert.ok(identity.team&&identity.team_id);assert.ok(!JSON.stringify(identity).includes('@'),'no email');
 // chat.postMessage then chat.update edits that one message, shown as the app and audited by the door.
 const writes=await audited('write'),posted=await ok(api('chat.postMessage',{channel:room.id,text:'Deploy *started*',blocks:[{type:'section',text:{type:'mrkdwn',text:'*main* deploying'}}],unfurl_links:false},token));
 assert.equal(posted.channel,room.id);assert.equal(posted.message.bot_id,identity.bot_id);assert.equal(await audited('write'),writes+1);
 const shown=(await call(`/api/conversations/${room.id}/messages`,'GET',undefined,ownerCookie)).find(m=>m.id===posted.ts);
 assert.equal(shown.authorName,'Deploy bot');assert.equal(shown.app,1);assert.ok(shown.body.includes('Deploy **started**')&&shown.body.includes('**main** deploying'));
 const updated=await ok(api('chat.update',{channel:room.id,ts:posted.ts,text:'Deploy *finished*'},token));
 assert.equal(updated.ts,posted.ts);assert.equal(updated.text,'Deploy **finished**');assert.deepEqual([(await row(posted.ts)).body,(await row(posted.ts)).version],['Deploy **finished**',2]);
 // chat.getPermalink links into Nook, where it opens under the reader's current membership.
 const link=new URL((await ok(api('chat.getPermalink',{channel:room.id,message_ts:posted.ts},token))).permalink);
 assert.equal(link.origin+link.pathname,origin+'/app');assert.deepEqual(Object.fromEntries(link.searchParams),{conversation:room.id,focus:posted.ts});
 // chat.delete erases it through the door's delete; it can then be neither edited nor linked.
 await ok(api('chat.delete',{channel:room.id,ts:posted.ts},token));assert.equal(await row(posted.ts),null);
 await refused('message_not_found',()=>api('chat.update',{channel:room.id,ts:posted.ts,text:'Too late'},token));await refused('message_not_found',()=>api('chat.getPermalink',{channel:room.id,message_ts:posted.ts},token));
 // A slack_sdk JSON body with an unsupported block keeps the text, shows the notice and reports a warning; a thread reply links into its thread.
 const fallback=await ok(json('chat.postMessage',{channel:room.id,text:'Chart attached',blocks:[{type:'image',image_url:'https://example.test/chart.png',alt_text:'chart'}]},token));
 assert.deepEqual(fallback.response_metadata.warnings,['unsupported_formatting']);const kept=(await row(fallback.ts)).body;assert.ok(kept.includes('Chart attached')&&kept.includes('Nook does not support')&&!kept.includes('chart.png'));
 const threaded=await ok(api('chat.postMessage',{channel:room.id,text:'Retrying the chart',thread_ts:fallback.ts},token));assert.equal(threaded.message.thread_ts,fallback.ts);assert.equal((await row(threaded.ts)).parent,fallback.ts);
 const replyLink=new URL((await ok(fetch(`${origin}/api/slack/chat.getPermalink?${new URLSearchParams({channel:room.id,message_ts:threaded.ts})}`,{headers:{authorization:'Bearer '+token}}))).permalink);
 assert.deepEqual(Object.fromEntries(replyLink.searchParams),{conversation:room.id,thread:fallback.ts,focus:threaded.ts});
 // Another app's message in the same channel can be neither edited nor deleted.
 const foreign=await ok(api('chat.postMessage',{channel:room.id,text:'Other app status'},other));
 await refused('cant_update_message',()=>api('chat.update',{channel:room.id,ts:foreign.ts,text:'Rewritten'},token));await refused('cant_delete_message',()=>api('chat.delete',{channel:room.id,ts:foreign.ts},token));assert.equal((await row(foreign.ts)).body,'Other app status');
 // A conversation outside the grant answers channel_not_found whether or not it exists.
 for(const channel of [elsewhere.id,'C0000000000',''])await refused('channel_not_found',()=>api('chat.postMessage',{channel,text:'Wrong room'},token));
 await refused('channel_not_found',()=>api('chat.getPermalink',{channel:elsewhere.id,message_ts:foreign.ts},token));
 await refused('no_text',()=>api('chat.postMessage',{channel:room.id},token));await refused('invalid_arguments',()=>api('chat.postMessage',{channel:room.id,text:'x',blocks:'not json'},token));
 await refused('msg_too_long',()=>api('chat.postMessage',{channel:room.id,text:'x'.repeat(40_001)},token));
 // The posting fence refuses the app in Slack's words, and the door audits the refusal.
 const posting=async level=>{const details=await call('/api/channels/'+room.id+'/details','GET',undefined,ownerCookie);await call('/api/channels/'+room.id+'/posting','PATCH',{version:details.version,level,replies:'everyone',people:[]},ownerCookie)};
 await posting('admins');const refusals=await audited('refuse');await refused('restricted_action',()=>api('chat.postMessage',{channel:room.id,text:'Blocked by the posting fence'},token));assert.equal(await audited('refuse'),refusals+1);await posting('everyone');
 // The channel's burst of twenty is spent, then 429 ratelimited with Retry-After.
 const burst=await call('/api/conversations','POST',{name:'Web API burst',kind:'private'},ownerCookie),fast=(await approve('Burst bot',burst)).token,statuses=[];
 for(let n=0;n<24;n++)statuses.push(await api('chat.postMessage',{channel:burst.id,text:'burst '+n},fast));
 assert.ok(statuses.slice(0,20).every(r=>r.status===200));const limited=statuses.find(r=>r.status===429);assert.ok(limited);assert.deepEqual(await limited.json(),{ok:false,error:'ratelimited'});assert.ok(Number(limited.headers.get('retry-after'))>=1);
 // Every other method the clause lists, and any unknown name, answers unknown_method and writes nothing, audit included.
 const quiet=await counts();
 for(const method of ['chat.postEphemeral','chat.unfurl','chat.scheduleMessage','reactions.add','conversations.open','conversations.create','conversations.history','users.info','views.open','files.getUploadURLExternal','no.such.method']){const response=await api(method,{channel:room.id,text:'Never posted',name:'inc-123'},token);assert.equal(response.status,200);assert.deepEqual(await response.json(),method==='conversations.history'?{ok:false,error:'missing_scope',needed:'channels:history',provided:''}:{ok:false,error:'unknown_method'},method)}
 assert.deepEqual(await counts(),quiet);
 // A missing, unknown or revoked token is refused and commits nothing.
 await refused('not_authed',()=>api('chat.postMessage',{channel:room.id,text:'No token'}));await refused('invalid_auth',()=>api('chat.postMessage',{channel:room.id,text:'Unknown token'},'nookapp_00000000-0000-0000-0000-000000000000.'+'A'.repeat(43)));
 await call(`/api/notification-apps/${app.id}/revoke`,'POST',{},ownerCookie);
 await refused('invalid_auth',()=>api('auth.test',{},token));await refused('invalid_auth',()=>api('chat.postMessage',{channel:room.id,text:'After revoke'},token));
}
