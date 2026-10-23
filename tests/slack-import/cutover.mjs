import assert from 'node:assert/strict';
import {zipFixture} from './fixture.mjs';

// The member list of the Monday export: two Workspace roles, two guests, one member whose
// display name looks like an address but who has none, two deactivated users and two bots.
export function cutoverPreview(summary){
 const rows=new Map(summary.cutover.rows.map(row=>[row.sourceId,row]));
 assert.deepEqual([...rows.keys()].sort(),['U2','U3','U4','U5','U6','U7'],'one row per active member and guest; none for deactivated users or bots');
 assert.ok(summary.cutover.rows.every(row=>['member','guest'].includes(row.proposed)),'no row is proposed as admin or owner');
 assert.deepEqual([rows.get('U2').proposed,rows.get('U2').adminFlag,rows.get('U6').proposed,rows.get('U6').adminFlag,rows.get('U3').adminFlag],['member','workspace-admin','member','workspace-owner',null]);
 assert.deepEqual([rows.get('U4').proposed,rows.get('U4').channels,rows.get('U5').proposed,rows.get('U5').channels],['guest',['C1','C2'],'guest',['C2']],'guests stay limited to channels this import mapped');
 assert.deepEqual([rows.get('U7').needsAddress,rows.get('U7').email],[true,''],'an address is never guessed from the display name');
 assert.deepEqual(summary.cutover.counts,{members:4,guests:2,deactivated:2,bots:2,needsAddress:1,workspaceAdmins:2});
}

async function created(db){
 const counts={};for(const table of ['oa_operators','oa_sessions','oa_tokens','nook_access','nook_members','nook_notify_queue','nook_audit'])counts[table]=(await db.prepare(`SELECT count(*) AS n FROM ${table}`).first()).n;return counts;
}
export async function cutoverChoices({app,door,pass,admin,outsider}){
 const {db}=app,namespace=pass.sourceNamespace??'synthetic-nook-177',before=await created(db),save=(choices,options={})=>door.request('cutover-choices',{planId:pass.planId,choices},{namespace,...options});
 for(const actor of [admin,outsider])await save({U2:'admin'},{actor,status:403});
 for(const choices of [{U3:'admin'},{U4:'admin'},{U2:'owner'},{U9:'admin'},[],null])await save(choices,{status:400});
 await door.request('cutover-choices',{planId:'synthetic-nook-unknown',choices:{}},{namespace,status:404});
 assert.deepEqual(await created(db),before,'refused saves change nothing');
 assert.deepEqual((await save({U2:'admin',U6:'member'})).choices,{U2:'admin'},'only an explicit admin choice is recorded');
 const after=await created(db);assert.deepEqual({...after,nook_audit:before.nook_audit},before,'saving sends no mail and creates no account, session, token, role or membership');
 const summary=(await door.history()).jobs.find(job=>job.planId===pass.planId).summary;assert.deepEqual(summary.cutoverChoices,{U2:'admin'});
 return summary.cutoverChoices;
}

// 120 active members, 3 guests, 5 deactivated users and some bots give 120 + 3 rows and none for the others.
export async function cutoverScale({door,owner}){
 const members=Array.from({length:120},(_,n)=>({id:'M'+String(n).padStart(3,'0'),name:'Member '+n,deleted:false,...(n%30===7?{}:{profile:{email:`member${n}@example.test`}}),...(n===0?{is_admin:true}:{})}));
 const guests=['G1','G2','G3'].map((id,n)=>({id,name:'Guest '+id,deleted:false,[n?'is_ultra_restricted':'is_restricted']:true,profile:{email:id.toLowerCase()+'@example.test'}}));
 const gone=Array.from({length:5},(_,n)=>({id:'D'+n,name:'Gone '+n,deleted:true,profile:{email:`gone${n}@example.test`}})),bots=[{id:'B1',name:'ci',deleted:false,is_bot:true},{id:'B2',name:'app',deleted:false,is_app_user:true},{id:'USLACKBOT',name:'slackbot',deleted:false}];
 const users=[...members,...guests,...gone,...bots],zip=zipFixture([['users.json',users],['channels.json',[{id:'C1',name:'general',members:users.map(u=>u.id)},{id:'C2',name:'elsewhere',members:['G3']}]],['general/2026-10-20.json',[{type:'message',user:'D0',ts:'1790000000.000001',text:'Message from a deactivated user.'}]]]);
 const source=await door.inspect(zip),summary=(await door.prepare(source,{namespace:'synthetic-nook-scale',channels:[{sourceId:'C1',name:'General archive',members:[owner.user.id]}],actors:Object.fromEntries(users.map(u=>[u.id,null])),acceptedOmissions:[]})).summary;
 const rows=summary.cutover.rows;assert.equal(rows.filter(r=>r.proposed==='member').length,120);assert.equal(rows.filter(r=>r.proposed==='guest').length,3);assert.equal(rows.length,123);
 assert.ok(!rows.some(r=>/^(D|B|USLACKBOT)/.test(r.sourceId)),'no row for deactivated users or bots');assert.equal(summary.cutover.counts.needsAddress,4);assert.deepEqual(rows.find(r=>r.sourceId==='G3').channels,['C1'],'a guest is limited to the channel this import mapped');
 assert.ok(summary.actors.some(a=>a.sourceId==='D0'),'a deactivated user still imports their history under the reviewed identity');
}
