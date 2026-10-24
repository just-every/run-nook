import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import { slackFixture, largeSlackFixture, zipFixture } from './fixture.mjs';
import {importDoorClient,importUsers} from '../import-door-support.mjs';
import { invite, signIn } from '../auth-support.mjs';
export async function importJourney({ origin, owner, restart, sql, validateArchive }) {
    const report = [], suffix = crypto.randomUUID().slice(0, 8), member = await invite(origin, owner.cookie, 'ImportReader' + suffix), outsider = await invite(origin, owner.cookie, 'ImportOutsider' + suffix);
    // Worker restarts must not reuse a pooled socket to the disposed listener.
    async function call(path, { actor = owner, body, zip, status = 200, method, plain=false } = {}) { const r = await fetch(origin + path, { method: method ?? (body !== undefined || zip ? 'POST' : 'GET'), headers: { Connection: 'close', Origin: origin, cookie: actor.cookie, ...(zip ? { 'Content-Type': 'application/zip' } : body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, body: zip ?? (body !== undefined ? JSON.stringify(body) : undefined) }); const raw = await r.text(); assert.equal(r.status, status, `${path}: ${raw}`); return !plain&&r.headers.get('content-type')?.includes('json') ? JSON.parse(raw) : raw; }
    const welcome=(await call('/api/conversations')).find(c=>c.kind==='channel'&&!c.archived);
    async function scopedActor(name,role,mode){
        const email=(name+suffix).toLowerCase()+'@example.test';
        await call('/api/team/invitations',{body:{email,role,mode,scopes:[welcome.id]}});
        const response=await fetch(origin+'/auth/invite',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',cookie:owner.cookie},body:JSON.stringify({email,displayName:name,role,returnTo:'/app'})});
        assert.equal(response.status,202);
        return signIn(origin,email,{requestLink:false});
    }
    const guest=await scopedActor('ImportGuest','member','guest'),admin=await scopedActor('ImportAdmin','admin','member');
    const door=importDoorClient({origin,owner,users:()=>importUsers(sql)});
    report.push(await privateHistoryJourney({call,door,owner,member,outsider,admin,guest,suffix,validateArchive}));
    report.push(await sourceFidelityJourney({call,door,owner,suffix}));
    const upload=await door.inspect(slackFixture({incomingWebhook:true})),namespace='slack-proof-'+suffix;
    assert.equal(upload.channels.length,2);assert.ok(upload.actors.some(a=>a.sourceId==='U404'));
    for(const actor of [member,guest,admin])await door.history({actor,status:403});
    const review={namespace,channels:upload.channels.map((c,i)=>({sourceId:c.sourceId,name:'Imported '+c.name+' '+suffix,members:i===0?[owner.user.id,member.user.id,guest.user.id]:[owner.user.id]})),actors:{U1:owner.user.id,U2:null,U404:null},acceptedOmissions:[]};
    const omitted=(await door.prepare(upload,review)).summary;
    assert.equal(omitted.needsOmissionReview,true);assert.deepEqual(omitted.counts,{channels:2,actors:3,messages:4,threads:2,files:2,bytes:11,omissions:1});
    review.acceptedOmissions=[omitted.omissionDigest];const preview=await door.plan(upload,review);
    assert.ok(preview.fingerprint);await door.apply({...preview,fingerprint:'0'.repeat(64)},{status:409});
    await door.request('status',{planId:preview.planId},{actor:member,status:403});
    // Discard the successful acknowledgement, cold restart and retry exactly.
    await door.apply(preview);await restart();const result=await door.finish(preview);
    assert.equal(result.job.total,9);
    const channels = await call('/api/conversations'), general = channels.find(c => c.name === review.channels[0].name), engineering = channels.find(c => c.name === review.channels[1].name);
    assert.ok(general && engineering);
    assert.equal(general.unread, 0);
    assert.equal(engineering.unread, 0);
    const history = await call(`/api/conversations/${general.id}/messages`, { actor: member });
    assert.equal(history.length, 2);
    assert.equal(history[0].body, '  Exact café 日本語 👋\n');
    assert.equal(history[0].provenance.timestamp, '1700000000.000001');
    assert.equal(history[1].parent, history[0].id);
    assert.equal(history[0].immutable, true);
    assert.equal(history[0].author, null);
    assert.equal((await call(`/api/conversations/${general.id}/messages`,{actor:guest})).length,2);
    assert.equal((await call('/api/search?q=caf%C3%A9',{actor:guest})).items.some(m=>m.id===history[0].id),true);
    for(const actor of [outsider,admin]){
        await call(`/api/conversations/${general.id}/messages/window`,{actor,status:403});
        assert.equal((await call('/api/search?q=caf%C3%A9',{actor})).items.some(m=>m.id===history[0].id),false);
        await call(`/api/messages/${history[0].id}`,{actor,status:404});
        await call(`/api/attachments/${history[0].attachments[0].id}/download`,{actor,status:404});
    }
    await call(`/api/conversations/${engineering.id}/messages/window`,{actor:guest,status:403});
    await call(`/api/messages/${history[0].id}`,{method:'PATCH',body:{body:'Changed history',version:1},status:403});
    await call(`/api/messages/${history[0].id}/reactions`,{body:{emoji:'👍',add:true},status:404});
    await call(`/api/attachments/${history[0].attachments[0].id}`,{method:'PATCH',body:{delete:true},status:403});
    await door.request('withdraw',{planId:preview.planId,uploadId:preview.uploadId},{status:409});
    const frozen=await call(`/api/conversations/${general.id}/messages/window?before=0`,{actor:member});
    assert.deepEqual(frozen.items.map(m=>m.id),[history[0].id]);
    assert.equal(frozen.readThrough,0);

    const window = await call(`/api/conversations/${general.id}/messages/window?limit=1`, { actor: member });
    assert.deepEqual(window.items.map(m => m.id), [history[0].id]);
    assert.ok(window.items[0].sequence < 0);
    assert.equal(window.readThrough, 0);
    assert.equal(window.frontier, 0);
    const thread = await call(`/api/conversations/${general.id}/messages/window?around=${history[1].id}&limit=1`, { actor: member });
    assert.equal(thread.root.id, history[0].id);
    assert.deepEqual(thread.target, { id: history[1].id, parent: history[0].id, root: history[0].id });
    assert.deepEqual(thread.items.map(m => m.id), [history[1].id]);
    assert.equal(thread.items[0].provenance.timestamp, history[1].provenance.timestamp);
    assert.equal(thread.readThrough, 0);
    await call(`/api/conversations/${engineering.id}/messages/window?around=${history[0].id}`, { status: 404 });
    assert.deepEqual((await call(`/api/conversations/${general.id}/preferences`,{actor:member})).threads,[], 'Importing history never creates follows');
    const file = await fetch(`${origin}/api/attachments/${history[0].attachments[0].id}/download`, { headers: { cookie: member.cookie } });
    assert.equal(file.status, 200);
    assert.equal(await file.text(), 'hello');
    const engineeringHistory = await call(`/api/conversations/${engineering.id}/messages`);
    assert.equal(engineeringHistory.length, 2);
    assert.equal(engineeringHistory[0].attachments.length, 1);
    assert.equal(engineeringHistory[1].parent, engineeringHistory[0].id);
    const secondThread = await call(`/api/conversations/${engineering.id}/messages/window?around=${engineeringHistory[1].id}`);
    assert.equal(secondThread.root.id, engineeringHistory[0].id);
    assert.ok(secondThread.items.some(m => m.id === engineeringHistory[1].id));
    const secondFile = await fetch(`${origin}/api/attachments/${engineeringHistory[0].attachments[0].id}/download`, { headers: { cookie: owner.cookie } });
    assert.equal(secondFile.status, 200);
    assert.equal(await secondFile.text(), 'second');
    await call(`/api/conversations/${engineering.id}/messages`, { actor: member, status: 403 });
    await call(`/api/conversations/${general.id}/messages`, { actor: outsider, status: 403 });
    const search = await call('/api/search?q=caf%C3%A9', { actor: member });
    assert.equal(search.items.filter(x => x.id === history[0].id).length, 1);
    assert.equal(search.items.find(x => x.id === history[0].id).immutable, true);
    assert.equal((await call('/api/search?q=PRIVATE%20CANARY',{actor:guest})).items.length,0);
    assert.equal((await call('/api/search?q=unknown', { actor: member })).items.some(x => x.conversation === engineering.id), false);
    assert.equal((await call(`/api/conversations/${general.id}/replay`, { actor: member })).frontier, 0);
    await door.apply(preview);
    assert.equal((await call(`/api/conversations/${general.id}/messages`)).length,2);
    report.push({name:'local review, real shared door lost-ack retry, histories, threads, file bytes, search and ACL',passed:true,counts:omitted.counts});
    assert.equal((await door.undo(preview)).job.state,'undone');
    assert.equal((await call('/api/search?q=caf%C3%A9')).items.some(x=>x.id===history[0].id),false);
    assert.equal((await call('/api/conversations')).some(x=>x.id===general.id),false);
    assert.equal((await fetch(`${origin}/api/attachments/${history[0].attachments[0].id}/download`,{headers:{cookie:owner.cookie}})).status,404);
    report.push({name:'guarded undo withdraws owned history, search, channels and file reachability',passed:true});
    const review2={...review,namespace:namespace+'-live'},local2=(await door.prepare(upload,review2)).summary;
    review2.acceptedOmissions=[local2.omissionDigest];const ready2=await door.plan(upload,review2);await door.finish(ready2);
    const liveChannel = (await call('/api/conversations')).find(c => c.name === review2.channels[0].name);
    const live = await call(`/api/conversations/${liveChannel.id}/messages`, { body: { body: 'Later live work survives undo', intent: 'live-' + suffix } });
    await door.request('undo',{planId:ready2.planId},{status:409});
    assert.ok((await call(`/api/conversations/${liveChannel.id}/messages`)).some(m => m.id === live.id));
    const mixed = await call(`/api/conversations/${liveChannel.id}/messages/window?limit=1`);
    assert.equal(mixed.items[0].id, live.id);
    assert.ok(mixed.items[0].sequence > 0);
    const older = await call(`/api/conversations/${liveChannel.id}/messages/window?limit=1&before=${mixed.cursor}`);
    assert.equal(older.items[0].immutable, true);
    assert.ok(older.items[0].sequence < 0);
    assert.equal(older.hasNewer, true);

    const incoming=upload.integrations.find(item=>item.kind==='webhook');assert.ok(incoming);assert.match(incoming.disposition,/NOOK-063/);
    const approval=(await call('/api/notification-apps',{body:{name:incoming.name,channels:[liveChannel.id]}})).approvals[0];
    const hook=await fetch(origin+'/hooks/slack/'+approval.token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'synthetic-nook repointed incoming webhook'})});assert.equal(hook.status,200);assert.equal(await hook.text(),'ok');
    const delivered=(await call('/api/conversations/'+liveChannel.id+'/messages',{actor:member})).filter(m=>m.body==='synthetic-nook repointed incoming webhook');assert.equal(delivered.length,1);assert.equal(delivered[0].conversation,liveChannel.id);assert.equal(!!delivered[0].app,true);assert.equal(delivered[0].authorName,incoming.name);
    await call('/api/conversations/'+liveChannel.id+'/messages',{status:403,actor:outsider});
    await call('/api/notification-apps/'+approval.id+'/revoke',{body:{}});
    const refusedHook=await fetch(origin+'/hooks/slack/'+approval.token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'synthetic-nook revoked incoming webhook'})});assert.equal(refusedHook.status,404);assert.equal(await refusedHook.text(),'no_service');
    const importedRoot=(await call(`/api/conversations/${liveChannel.id}/messages`)).find(m=>m.immutable&&!m.parent);
    const nativeReply=await call(`/api/conversations/${liveChannel.id}/messages`,{actor:member,body:{body:'Continue the imported discussion in Nook',parent:importedRoot.id,intent:'imported-reply-'+suffix}});
    assert.equal(nativeReply.parent,importedRoot.id);
    assert.equal((await call(`/api/conversations/${liveChannel.id}/preferences`,{actor:member})).threadFollows.find(f=>f.message===importedRoot.id)?.source,'replied');
    assert.ok((await call('/api/threads',{actor:member})).items.some(t=>t.root.id===importedRoot.id));
    const continued=await call(`/api/conversations/${liveChannel.id}/messages/window?thread=${importedRoot.id}`,{actor:member});
    assert.ok(continued.items.some(m=>m.id===nativeReply.id));
    assert.equal(continued.root.body,importedRoot.body,'Native participation does not rewrite the source');
    await door.request('undo',{planId:ready2.planId},{status:409});
    report.push({ name: 'undo rejects later live work and preserves it', passed: true });
    const bigUpload=await door.inspect(largeSlackFixture(200,5));
    const stale={namespace:namespace+'-stale',channels:bigUpload.channels.map((c,i)=>({sourceId:c.sourceId,name:'Stale '+c.name+' '+suffix,members:i===0?[owner.user.id,member.user.id,guest.user.id]:[owner.user.id]})),actors:Object.fromEntries(bigUpload.actors.map(a=>[a.sourceId,null])),acceptedOmissions:[]};
    const local=(await door.prepare(bigUpload,stale)).summary;if(local.needsOmissionReview)stale.acceptedOmissions=[local.omissionDigest];
    const ready=await door.plan(bigUpload,stale),partial=await door.apply(ready);
    assert.ok(partial.job.checkpoint>0&&partial.job.checkpoint<partial.job.total);
    await sql(`UPDATE oa_operators SET role='admin',version=version+1 WHERE id='${member.user.id}'`);
    const changed=await door.status(ready);assert.equal(changed.job.checkpoint,partial.job.checkpoint);
    assert.ok((await door.history()).jobs.some(j=>j.planId===ready.planId));
    await door.apply(ready,{status:409});
    assert.equal((await door.undo(ready)).job.state,'rolled_back');
    const freshReview={...stale,namespace:stale.namespace+'-fresh'},freshLocal=(await door.prepare(bigUpload,freshReview)).summary;
    freshReview.acceptedOmissions=[freshLocal.omissionDigest];const fresh=await door.plan(bigUpload,freshReview);await door.finish(fresh);
    await door.undo(ready);
    const recoveredChannel=(await call('/api/conversations')).find(c=>c.name===stale.channels[0].name);assert.ok(recoveredChannel);
    assert.equal((await call(`/api/conversations/${recoveredChannel.id}/messages?limit=100`)).length,100);
    await sql(`UPDATE oa_operators SET status='inactive',version=version+1 WHERE id='${member.user.id}'`);
    await door.apply(fresh,{status:409});
    report.push({name:'changed member authority blocks forward work, preserves owner history and guarded rollback; old reversal cannot remove a new namespace',passed:true});
    report.push(await largeImportJourney({call,door,owner,restart,suffix}));return report;
}
async function sourceFidelityJourney({ call, door, owner, suffix }) {
    const message = { type: 'message', user: 'U1', ts: '1.000001', text: 'bounded selected history' }, file = { id: 'F1', name: 'history.txt', mimetype: 'text/plain' };
    const fixtures = [
        { users: [], rows: [message], reason: 'source-actor-missing-from-export' },
        { rows: [{ ...message, files: [file] }], reason: 'missing-supplied-bytes' },
        { rows: [message, { type: 'message', subtype: 'message_deleted', ts: '2.000001', deleted_ts: message.ts }], reason: 'source-change-or-deletion-not-reconstructed' },
        { rows: [message, { type: 'message', subtype: 'message_changed', ts: '2.000001', message: { ts: message.ts, text: 'changed' } }], reason: 'source-change-or-deletion-not-reconstructed' },
        { rows: [{ ...message, subtype: 'future_unknown_record' }], reason: 'unsupported-message-type:message:subtype:future_unknown_record' },
        { rows: [{ ...message, thread_ts: '0.000001' }], reason: 'missing-or-unsupported-thread-parent' },
        { rows: [{ ...message, files: [file] }], files: [['files/F1/history.txt', Buffer.alloc(1024 * 1024 + 1, 65)]], reason: 'slack-file-size-limit' }
    ];
    const before = await door.history(), channels = await call('/api/conversations');
    for (const [index, fixture] of fixtures.entries()) {
        const upload = await door.inspect(zipFixture([['users.json', fixture.users ?? [{ id: 'U1' }]], ['channels.json', [{ id: 'C1', name: 'general' }]], ['general/2024-01-01.json', fixture.rows], ...(fixture.files ?? [])]));
        const review = { namespace: `blocked-${suffix}-${index}`, channels: [{ sourceId: 'C1', name: 'Blocked history', members: [owner.user.id] }], actors: Object.fromEntries(upload.actors.map(a => [a.sourceId, null])), acceptedOmissions: [] };
        const preview = (await door.prepare(upload,review)).summary;
        const retry = (await door.prepare(upload,{...review,acceptedOmissions:[preview.omissionDigest]})).summary;
        assert.equal(retry.blocked, true);
        assert.ok(retry.blockers.some(b => b.channel === 'C1' && b.reason === fixture.reason));
        assert.equal(retry.planId, undefined);
        assert.equal(retry.fingerprint, undefined);
    }
    assert.deepEqual(await door.history(), before);
    assert.deepEqual(await call('/api/conversations'), channels);
    return { name: 'selected history fidelity blockers cannot create a reviewed job or channel even with an accepted exclusion digest', passed: true, cases: fixtures.length };
}
async function largeImportJourney({ call, door, owner, restart, suffix }) {
    const source = await door.inspect(largeSlackFixture()), review = { namespace: 'large-runtime-' + suffix, channels: source.channels.map(c => ({ sourceId: c.sourceId, name: 'Large ' + c.name + ' ' + suffix, members: [owner.user.id] })), actors: Object.fromEntries(source.actors.map(a => [a.sourceId, null])), acceptedOmissions: [] };
    const preview = await door.plan(source,review);
    assert.equal(preview.counts.messages, 1205);
    assert.equal(preview.counts.actors, 205);
    assert.equal(preview.needsOmissionReview, false);
    let result = await door.apply(preview), requests = 1;
    while (result.job.state !== 'completed' && requests < 220) {
        if (requests === 3)
            await restart();
        result = await door.apply(preview);
        requests++;
    }
    assert.equal(result.job.state, 'completed');
    assert.equal(result.job.total, 1412);
    const channels = (await call('/api/conversations')).filter(c => review.channels.some(r => r.name === c.name));
    assert.equal(channels.length, 2);
    let count = 0, replies = 0;
    for (const c of channels) {
        assert.equal(c.unread, 0);
        let after = '';
        for (;;) {
            const rows = await call(`/api/conversations/${c.id}/messages?limit=100&after=${encodeURIComponent(after)}`);
            count += rows.length;
            replies += rows.filter(r => r.parent).length;
            assert.ok(rows.every(r => r.immutable && r.author === null));
            if (rows.length < 100)
                break;
            after = rows.at(-1).created + rows.at(-1).id;
        }
    }
    assert.equal(count, 1205);
    assert.equal(replies, 6);
    let after = '', found = 0;
    for (;;) {
        const page = await call('/api/search?q=Historical%20fixture&after=' + encodeURIComponent(after));
        found += page.items.filter(x => channels.some(c => c.id === x.conversation)).length;
        if (!page.hasMore)
            break;
        assert.notEqual(page.cursor, after);
        after = page.cursor;
    }
    assert.equal(found, 1205);
    return { name: 'large actual D1 import resumes after cold restart and all 1205 messages across two normal histories/search are reachable', passed: true, counts: { messages: count, actors: 205, replies, kitEntries: 1412, applyRequests: requests } };
}

export async function privateHistoryJourney({call,door,owner,member,outsider,admin,guest,suffix,validateArchive}) {
 const {privateSlackFixture}=await import('../slack-private-fixture.mjs');
 const inspection=await door.inspect(privateSlackFixture({files:true}));
 assert.deepEqual(inspection.channels.map(c=>c.visibility),['private','dm','group-dm']);
 assert.ok(!JSON.stringify(inspection).includes('canary'),'inspection exposes counts and rosters, never history text');
 assert.equal(inspection.integrations.length,5);
 assert.match(inspection.integrations.find(i=>i.name==='Polly').disposition,/NOOK-070/);
 assert.match(inspection.integrations.find(i=>i.name==='Donut').disposition,/NOOK-026/);
 const actors={'synthetic-nook-1':member.user.id,'synthetic-nook-2':outsider.user.id,'synthetic-nook-3':null};
 const review={namespace:'synthetic-nook-private-'+suffix,actors,channels:inspection.channels.map(c=>({sourceId:c.sourceId,name:'Imported '+c.name+' '+suffix,members:c.members.map(id=>actors[id]).filter(Boolean)})),acceptedOmissions:[]};
 let preview=await door.prepare(inspection,review);
 assert.equal(preview.summary.counts.channels,2);
 assert.ok(preview.summary.omissions.some(o=>o.reason==='private-membership-not-exactly-mapped'));
 assert.equal(preview.packet.capture.messages.some(m=>m.body.includes('group DM')),false,'unmapped group history never leaves the local reader');
 const collision=structuredClone(review);collision.actors['synthetic-nook-2']=member.user.id;collision.channels.forEach(c=>c.members=[member.user.id]);
 assert.equal((await door.prepare(inspection,collision)).summary.blocked,true,'one local person cannot stand for two participants');
 review.acceptedOmissions=[preview.summary.omissionDigest];
 const plan=await door.plan(inspection,review);await door.finish(plan);
 const rooms=await call('/api/conversations',{actor:member});
 const privateRoom=rooms.find(c=>c.name===review.channels[0].name),dm=rooms.find(c=>c.name===review.channels[1].name);
 assert.ok(privateRoom&&dm);assert.equal(dm.kind,'dm');
 for(const room of [privateRoom,dm]){
  const messages=await call(`/api/conversations/${room.id}/messages`,{actor:member});assert.equal(messages.length,1);
  assert.equal((await call(`/api/conversations/${room.id}/messages`,{actor:outsider})).length,1);
  for(const actor of [owner,admin,guest]){
   await call(`/api/conversations/${room.id}/messages`,{actor,status:403});
   await call(`/api/messages/${messages[0].id}`,{actor,status:404});
   await call('/api/readable-exports',{actor,body:{scope:'conversation',conversationId:room.id,custodyAccepted:true},status:403});
   for(const file of messages[0].attachments)await call('/api/attachments/'+file.id+'/download',{actor,status:404});
   assert.equal((await call('/api/search?q=Synthetic%20private',{actor})).items.some(m=>m.id===messages[0].id),false);
  }
 }
 const privateFile=(await call(`/api/conversations/${privateRoom.id}/messages`,{actor:member}))[0].attachments[0];assert.ok(privateFile);
 const fileBytes=await call('/api/attachments/'+privateFile.id+'/download',{actor:outsider});assert.equal(fileBytes,'synthetic-nook private file bytes!');
 const exported=await call('/api/portability/exports',{body:{},status:201});let archiveStatus;
 for(let n=0;n<200;n++){archiveStatus=await call('/api/portability/exports/'+exported.id+'/advance',{body:{maxParts:16}});if(archiveStatus.phase!=='building')break}assert.equal(archiveStatus.phase,'complete');
 const archiveText=await call('/api/portability/exports/'+exported.id+'/download',{plain:true}),{readArchive}=await import('@runeditrun/rer/modules/portability'),archiveRecords=[];
 for await(const record of readArchive(new Blob([archiveText]).stream()))archiveRecords.push(record);
 const archiveFile=archiveRecords.flatMap(r=>r.items??[]).find(r=>r.table==='nook_attachments'&&r.row.id===privateFile.id)?.row;assert.ok(archiveFile);assert.ok([member.user.id,outsider.user.id].includes(archiveFile.author));assert.notEqual(archiveFile.author,owner.user.id);assert.equal(archiveFile.sha256,createHash('sha256').update(fileBytes).digest('hex'));assert.ok(archiveRecords[0].objects.some(o=>o.key===archiveFile.object_key&&o.size===Buffer.byteLength(fileBytes)));
 await call('/api/portability/exports/'+exported.id+'/abort',{body:{}});
 const dmMessage=(await call(`/api/conversations/${dm.id}/messages`,{actor:member}))[0];
 assert.match(dmMessage.slack.links[0].href,/focus=/);assert.match(dmMessage.slack.links[0].href,/thread=/);
 const forged=structuredClone((await door.prepare(inspection,review)).packet);forged.capture.channels[0].members.push(owner.user.id);
 await assert.rejects(()=>door.upload(forged),/exact private audience required/);
 if(validateArchive)await validateArchive();
 await door.undo(plan);
 return {name:'private supplied Slack histories publish only to exact injective source audiences; unmapped group stays local; non-member owner and admin denied',passed:true};
}
