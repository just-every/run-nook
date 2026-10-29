import {signIn as operatorSignIn,invite} from '../tests/auth-support.mjs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const fileBytes='Synthetic workflow private file bytes';
function localUrl(base){let url=new URL(base);assert.equal(url.protocol,'http:','Only local HTTP proof is authorized');assert.equal(url.hostname,'127.0.0.1','Only literal loopback proof is authorized');assert.equal(url.pathname,'/');assert.equal(url.username+url.password+url.search+url.hash,'');return url.origin}
function client(base,cookie){return async(path,body,method=body?'POST':'GET',expected=200)=>{let response=await fetch(base+'/api/'+path,{method,headers:{Connection:'close',...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});assert.equal(response.status,expected,`${method} ${path} status`);return {response,data:response.headers.get('content-type')?.includes('application/json')?await response.json():await response.text()}}}
async function signIn(base,actor){return client(base,(await operatorSignIn(base,actor.email)).cookie)}
export async function runWorkflow(base,{ownerEmail='nativeowner@example.test'}={}){base=localUrl(base);let tag='Workflow-'+randomUUID().slice(0,8),actors=[],authority=await operatorSignIn(base,ownerEmail);for(let role of ['owner','member']){let name=tag+'-'+role,email=name.toLowerCase()+'@example.test',result=await invite(base,authority.cookie,name,email);actors.push({name,email,id:result.user.id,cookie:result.cookie})}let [owner,member]=actors,a=client(base,owner.cookie),b=client(base,member.cookie);assert.equal((await a('me')).data.id,owner.id);assert.equal((await b('me')).data.id,member.id);
let conversation=(await a('conversations',{name:tag,kind:'private',participants:[member.id]})).data;await b('conversations/'+conversation.id+'/preferences',{followed:true,muted:false},'PATCH');let root=(await a('conversations/'+conversation.id+'/messages',{body:'Synthetic workflow root',intent:tag+'-root'})).data;await b('messages/'+root.id+'/follow',{follow:true});let upload=(await a('conversations/'+conversation.id+'/attachments',{name:'workflow-proof.txt',mime:'text/plain',data:Buffer.from(fileBytes).toString('base64')})).data;await b('attachments/'+upload.id+'/download',null,'GET',404);let intent={body:'Synthetic workflow file evidence',intent:tag+'-file',attachments:[upload.id]},message=(await a('conversations/'+conversation.id+'/messages',intent)).data;assert.equal((await a('conversations/'+conversation.id+'/messages',intent)).data.id,message.id);assert.equal((await b('attachments/'+upload.id+'/download')).data,fileBytes);
let reply=(await b('conversations/'+conversation.id+'/messages',{body:'Synthetic workflow thread reply',intent:tag+'-reply',parent:root.id})).data;let commitment=(await a('conversations/'+conversation.id+'/outcomes',{kind:'commitment',body:'Synthetic workflow accepted work',assignee:member.id,source:message.id})).data;await a('outcomes/'+commitment.id,{version:1,action:'accept'},'PATCH',403);let accepted=(await b('outcomes/'+commitment.id,{version:1,action:'accept'},'PATCH')).data;assert.equal(accepted.status,'accepted');assert.equal(accepted.version,2);
let quietUntil=Date.now()+3600000;await b('settings',{dndUntil:quietUntil},'PATCH');let urgent=(await a('conversations/'+conversation.id+'/messages',{body:'Synthetic workflow urgent request',intent:tag+'-urgent',mentions:[member.id],urgent:true,urgentReason:'Synthetic blocked review'})).data;let attention=(await b('attention')).data;assert.equal(attention.items.length,1);assert.equal(attention.items[0].message.id,urgent.id);assert.equal(attention.items[0].reason,'urgent-request');assert.ok(attention.deferredCount>=2);let item=attention.items[0];await b('attention/'+item.id,{action:'snooze',until:Date.now()+600000});assert.equal((await b('attention')).data.items.length,0);await b('attention/'+item.id,{action:'done'});let frontier=(await b('conversations/'+conversation.id+'/replay?after=0')).data.frontier;await b('conversations/'+conversation.id+'/read',{seq:frontier});assert.equal((await b('conversations')).data.find(c=>c.id===conversation.id).unread,0);assert.equal((await b('conversations/'+conversation.id+'/outcomes')).data.find(o=>o.id===commitment.id).status,'accepted');let context={base,actors,conversation:conversation.id,root:root.id,reply:reply.id,message:message.id,attachment:upload.id,commitment:commitment.id,urgent:urgent.id,attention:item.id,frontier,quietUntil};await verifyWorkflow(base,context);return context}
export async function verifyWorkflow(base,context,{sessionsExcluded=false,preservedSessions=false}={}){
 base=localUrl(base)
 if(sessionsExcluded)for(let actor of context.actors)await client(base,actor.cookie)('me',null,'GET',401)
 const [owner,member]=context.actors
 const a=preservedSessions?client(base,owner.cookie):await signIn(base,owner)
 const b=preservedSessions?client(base,member.cookie):await signIn(base,member)
 assert.deepEqual((await a('me')).data,{id:owner.id,name:owner.name,role:'member',mode:'member',zone:'UTC',zoneChosen:false,presenceEnabled:true,typingEnabled:true,status:null})
 assert.deepEqual((await b('me')).data,{id:member.id,name:member.name,role:'member',mode:'member',zone:'UTC',zoneChosen:false,presenceEnabled:true,typingEnabled:true,status:null})
 let history=(await b('conversations/'+context.conversation+'/messages?limit=100')).data
 assert.equal(history.length,4);assert.equal(history.find(m=>m.id===context.reply).parent,context.root)
 assert.equal(history.find(m=>m.id===context.message).attachments[0].id,context.attachment)
 assert.equal((await b('attachments/'+context.attachment+'/download')).data,fileBytes)
 let outcome=(await b('conversations/'+context.conversation+'/outcomes')).data.find(o=>o.id===context.commitment)
 assert.equal(outcome.status,'accepted');assert.equal(outcome.version,2)
 let preferences=(await b('conversations/'+context.conversation+'/preferences')).data
 assert.equal(preferences.followed,true);assert.equal(preferences.muted,false)
 // The explicit follow on the root, and the automatic follow from the urgent request's mention.
 assert.deepEqual(preferences.threadFollows,[{message:context.root,source:'explicit'},{message:context.urgent,source:'mentioned'}].sort((x,y)=>x.message<y.message?-1:1))
 assert.equal((await b('settings')).data.dndUntil,context.quietUntil)
 let attention=(await b('attention')).data
 assert.equal(attention.items.length,0);assert.ok(attention.deferredCount>=2)
 const conversation=(await b('conversations')).data.find(c=>c.id===context.conversation)
 assert.equal(conversation.unread,0);assert.equal(conversation.owner,owner.id)
 assert.equal((await a('conversations/'+context.conversation+'/replay?after='+context.frontier)).data.events.length,0)
 return {ok:true,historyCount:history.length,acceptedVersion:outcome.version,deferredCount:attention.deferredCount,frontier:context.frontier}
}
export function workflowReport(context,verification){return {target:context.base,synthetic:true,actors:context.actors.map(({id,name})=>({id,name})),conversation:context.conversation,checks:['two-cookie-sessions','private-channel','root-thread','staged-secret','private-file-bytes','same-intent-retry','assignee-only-exact-acceptance','follow','quiet-time','urgent-request','owned-snooze-done','read-does-not-accept','fresh-login-state'],...verification}}
if(process.argv[1]===fileURLToPath(import.meta.url)){let context=await runWorkflow(process.argv[2]),report=workflowReport(context,await verifyWorkflow(context.base,context));if(process.argv[3])writeFileSync(process.argv[3],JSON.stringify(report,null,2)+'\n',{mode:0o600});console.log(JSON.stringify(report))}
