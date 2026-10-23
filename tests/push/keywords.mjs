import assert from 'node:assert/strict';

// Personal keywords through the public doors: one keyword item per message in a conversation the member can read, never
// their own words, never muted or unreadable conversations unless chosen, and push on by default after the first device.
export async function keywords(c){
 const {call,member,sender,room,send,rows,delivered,signIn,sync,ownerCookie}=c;
 const items=async(message,cookie=member.cookie)=>(await call('/api/attention','GET',undefined,cookie)).items.filter(i=>i.message?.id===message.id);
 const settings=await call('/api/notify','GET',undefined,member.cookie);assert.equal(settings.push.keywords,true,'keyword push is on once the member enabled push');assert.equal(settings.keywordEmail,false,'keyword email stays off until chosen');
 await call('/api/notify','PATCH',{keywords:Array.from({length:21},(_,i)=>'word'+i)},member.cookie,400);await call('/api/notify','PATCH',{keywords:['x'.repeat(65)]},member.cookie,400);await call('/api/notify','PATCH',{keywords:['   ']},member.cookie,400);
 assert.deepEqual((await call('/api/notify','PATCH',{keywords:['Invoice','purchase order','invoice']},member.cookie)).keywords,['Invoice','purchase order'],'case-insensitive duplicates collapse');
 for(const cookie of [sender.cookie,ownerCookie])assert.deepEqual((await call('/api/notify','GET',undefined,cookie)).keywords,[],'nobody else reads a member’s keywords');
 const billing=await room('Billing keywords'),hit=await send(billing,{body:'Please check the INVOICE and the purchase order today'});
 const [notice]=await delivered(hit);assert.match(notice.value.body,/keyword/);assert.ok(!JSON.stringify(notice.value).includes('INVOICE'));
 assert.equal((await sync()).badge,1,'the keyword item counts once in the badge');const mine=await items(hit);assert.equal(mine.length,1,'two matching keywords make one item');assert.equal(mine[0].reason,'keyword');assert.equal((await rows(hit)).length,1);assert.equal((await rows(hit))[0].reason,'keyword');
 assert.equal((await items(hit,sender.cookie)).length,0,'the author gets nothing');
 const own=await send(billing,{body:'my own invoice'},member.cookie);assert.equal((await items(own)).length,0,'never for their own message');
 const partial=await send(billing,{body:'invoicing the whole team'});assert.equal((await items(partial)).length,0,'whole words only');assert.deepEqual(await rows(partial),[]);
 const plain=await send(billing,{body:'nothing relevant here'});await call(`/api/messages/${plain.id}`,'PATCH',{version:1,body:'now it says invoice'},sender.cookie);assert.equal((await items(plain)).length,0,'an edit does not re-alert');
 // A read on a second session clears it everywhere.
 const second=await signIn(settings.address),rooms=await call('/api/conversations','GET',undefined,second.cookie);
 await call(`/api/conversations/${billing.id}/read`,'POST',{seq:rooms.find(r=>r.id===billing.id).seq},second.cookie);assert.equal((await sync()).badge,0,'the item clears when read on another session');
 // Muted conversations stay quiet unless chosen; a private conversation the member cannot read never alerts.
 const muted=await room('Muted keywords');await call(`/api/conversations/${muted.id}/preferences`,'PATCH',{muted:true},member.cookie);
 const quiet=await send(muted,{body:'invoice in a muted room'});assert.equal((await items(quiet)).length,0);assert.deepEqual(await rows(quiet),[]);
 await call('/api/notify','PATCH',{keywordsInMuted:true},member.cookie);const loud=await send(muted,{body:'second invoice in the muted room'});assert.equal((await items(loud)).length,1,'chosen for muted conversations');
 await call('/api/notify','PATCH',{keywordsInMuted:false},member.cookie);
 const hidden=await room('Hidden keywords','private',[sender.user.id]),unreadable=await send(hidden,{body:'invoice nobody here may read'});assert.equal((await items(unreadable)).length,0);assert.deepEqual(await rows(unreadable),[]);
 await call('/api/notify','PATCH',{keywords:[]},member.cookie);
}
