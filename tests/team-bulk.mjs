import assert from 'node:assert/strict';
import {signIn} from './auth-support.mjs';

// Bulk invitations through the real Worker: preview flags, one invitation per remaining address through the ordinary one-use door,
// resend and revoke, acceptance into the named and default channels. Mail goes only to the harness's fake provider.
export async function runBulkInvitations({origin,ownerCookie,call,json,launch,review,publicOther,member,guest,stamp}){
 const post=(path,body,options={})=>call(path,{method:'POST',body,headers:{Connection:'close'},...options}),head='email,name,role,channels',people=async()=>json('/api/team');
 const email=i=>`bulk-${i}-${stamp}@example.test`;
 // 50 pasted rows: 48 distinct addresses (6 guests of the private channel), one repeated address and one invalid address.
 const lines=Array.from({length:48},(_,i)=>i<6?`${email(i)},Guest ${i},guest,${review.name}`:`${email(i)},Person ${i},member,${launch.name}`);
 const csv=[head,...lines,lines[0],'not-an-address,Nobody,member,'+launch.name].join('\n');
 const before=(await people()).length;
 const preview=await (await post('/api/team/invitations/preview',{csv})).json();
 assert.equal(preview.counts.total,50);assert.equal(preview.counts.sendable,48);assert.equal(preview.counts['duplicate-in-batch'],1);assert.equal(preview.counts['invalid-address'],1);
 assert.equal((await people()).length,before,'a preview writes nothing');
 // Other flags: an existing account, a role the bulk door never issues, an unknown channel, a guest with no channel and a missing name; a member with no channel is sendable into the default channels.
 const flags=await (await post('/api/team/invitations/preview',{csv:[head,`${member.email},Existing,member,${launch.name}`,`bulk-admin-${stamp}@example.test,Admin,admin,${launch.name}`,`bulk-x-${stamp}@example.test,Unknown,member,No such channel`,`bulk-g-${stamp}@example.test,Guest,guest,`,`bulk-n-${stamp}@example.test,,member,${launch.name}`,`bulk-d-${stamp}@example.test,Default,member,`].join('\n')})).json();
 assert.deepEqual(flags.rows.map(r=>r.status),['existing-account','role-not-allowed','unknown-channel','guest-needs-channel','name-missing','ok']);
 // Refusals: members and guests cannot use the door; a batch over 1,000 rows or 256 KiB is refused; sending needs confirmation.
 for(const cookie of [member.cookie,guest.cookie])for(const path of ['preview','bulk'])await post('/api/team/invitations/'+path,{csv,confirm:true},{cookie,status:403});
 await post('/api/team/invitations/preview',{csv:Array.from({length:1001},(_,i)=>`over-${i}-${stamp}@example.test,Over,member,${launch.name}`).join('\n')},{status:400});
 await post('/api/team/invitations/preview',{csv:'x'.repeat(262145)},{status:413});
 await post('/api/team/invitations/bulk',{csv},{status:400});
 // One action: a bounded chunk per call until nothing remains sendable.
 let sent=0,remaining=48,calls=0;
 while(remaining&&calls++<20){const result=await (await post('/api/team/invitations/bulk',{csv,confirm:true})).json();assert.deepEqual(result.failed,[]);sent+=result.sent;remaining=result.remaining}
 assert.equal(sent,48);assert.equal(remaining,0);
 const again=await (await post('/api/team/invitations/preview',{csv})).json();assert.equal(again.counts.sendable,0);assert.equal(again.counts['already-pending'],48,'a second send issues nothing');
 const pending=(await people()).filter(p=>p.email.startsWith('bulk-')&&p.status==='invited');assert.equal(pending.length,48);
 // Acceptance lands the person in the named channel plus the default channels; a guest keeps only the named private channel.
 const defaults=(await json('/api/team/default-channels')).channels.filter(c=>c.enabled).map(c=>c.id);assert.ok(defaults.length,'this installation has default channels');
 const accepted=await signIn(origin,email(10),{requestLink:false}),visible=async cookie=>(await json('/api/conversations',{cookie})).map(c=>c.id);
 const ids=await visible(accepted.cookie);assert.ok(ids.includes(launch.id)&&defaults.every(id=>ids.includes(id)),'named plus default channels');
 const acceptedGuest=await signIn(origin,email(0),{requestLink:false}),guestIds=await visible(acceptedGuest.cookie);assert.ok(guestIds.includes(review.id)&&!guestIds.includes(launch.id)&&!defaults.some(id=>guestIds.includes(id)),'a guest keeps only the named private channel');
 // Resend re-issues the single-use link; revoking stops it. Neither is open to a member.
 await post('/api/team/invitations/resend',{email:email(11)},{cookie:member.cookie,status:403});await post('/api/team/invitations/resend',{email:email(10)},{status:404});
 await post('/api/team/invitations/resend',{email:email(11)});assert.ok(await signIn(origin,email(11),{requestLink:false}),'the resent link signs the person in');
 const revoked=(await people()).find(p=>p.email===email(12));await post('/auth/invite/cancel',{operatorId:revoked.id});assert.notEqual((await people()).find(p=>p.email===email(12)).status,'invited');
 await post('/api/team/invitations/resend',{email:email(12)},{status:404});
}
