import assert from 'node:assert/strict';
import { slackFixture, largeSlackFixture, zipFixture } from './fixture.mjs';
import { invite, signIn } from '../auth-support.mjs';
export async function importJourney({ origin, owner, restart, sql }) {
    const report = [], suffix = crypto.randomUUID().slice(0, 8), member = await invite(origin, owner.cookie, 'ImportReader' + suffix), outsider = await invite(origin, owner.cookie, 'ImportOutsider' + suffix);
    async function call(path, { actor = owner, body, zip, status = 200, method } = {}) { const r = await fetch(origin + path, { method: method ?? (body !== undefined || zip ? 'POST' : 'GET'), headers: { Origin: origin, cookie: actor.cookie, ...(zip ? { 'Content-Type': 'application/zip' } : body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, body: zip ?? (body !== undefined ? JSON.stringify(body) : undefined) }); const raw = await r.text(); assert.equal(r.status, status, `${path}: ${raw}`); return r.headers.get('content-type')?.includes('json') ? JSON.parse(raw) : raw; }
    const welcome=(await call('/api/conversations')).find(c=>c.kind==='channel');
    async function scopedActor(name,role,mode){
        const email=(name+suffix).toLowerCase()+'@example.test';
        await call('/api/team/invitations',{body:{email,role,mode,scopes:[welcome.id]}});
        const response=await fetch(origin+'/auth/invite',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',cookie:owner.cookie},body:JSON.stringify({email,displayName:name,role,returnTo:'/app'})});
        assert.equal(response.status,202);
        return signIn(origin,email,{requestLink:false});
    }
    const guest=await scopedActor('ImportGuest','member','guest'),admin=await scopedActor('ImportAdmin','admin','member');
    report.push(await sourceFidelityJourney({ call, owner, suffix }));
    const upload = await call('/api/slack-imports/upload', { zip: slackFixture() }), namespace = 'slack-proof-' + suffix;
    assert.equal(upload.channels.length, 2);
    assert.ok(upload.actors.some(a => a.sourceId === 'U404'));
    for(const actor of [member,guest,admin])await call('/api/slack-imports', { actor, status: 403 });
    const review = { namespace, channels: upload.channels.map((c, i) => ({ sourceId: c.sourceId, name: 'Imported ' + c.name + ' ' + suffix, members: i === 0 ? [owner.user.id, member.user.id, guest.user.id] : [owner.user.id] })), actors: { U1: owner.user.id, U2: null, U404: null }, acceptedOmissions: [] };
    const omitted = await call('/api/slack-imports/preview', { body: { upload: upload.upload, review } });
    assert.equal(omitted.needsOmissionReview, true);
    assert.deepEqual(omitted.counts, { channels: 2, actors: 3, messages: 4, threads: 2, files: 2, bytes: 11, omissions: 1 });
    review.acceptedOmissions = [omitted.omissionDigest];
    const preview = await call('/api/slack-imports/preview', { body: { upload: upload.upload, review } });
    assert.ok(preview.fingerprint);
    await call(`/api/slack-imports/${preview.review}/apply`, { body: { fingerprint: 'stale-plan' }, status: 409 });
    await call(`/api/slack-imports/${preview.review}`, { actor: member, status: 403 });
    // Discard a successful acknowledgement, reopen Worker, then retry the same plan.
    await call(`/api/slack-imports/${preview.review}/apply`, { body: { fingerprint: preview.fingerprint } });
    await restart();
    let result = await call(`/api/slack-imports/${preview.review}/apply`, { body: { fingerprint: preview.fingerprint } });
    for (let i = 0; result.job.state !== 'completed' && i < 20; i++)
        result = await call(`/api/slack-imports/${preview.review}/resume`, { body: {} });
    assert.equal(result.job.state, 'completed');
    assert.equal(result.job.total, 9);
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
    await call(`/api/slack-imports/uploads/${upload.upload}`,{body:{},status:409});
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
    await call(`/api/conversations/${general.id}/messages`, { actor: member, body: { body: 'Native reply cannot rewrite imported thread', parent: history[0].id, intent: 'immutable-root-' + suffix }, status: 400 });
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
    await call(`/api/slack-imports/${preview.review}/apply`, { body: { fingerprint: preview.fingerprint } });
    assert.equal((await call(`/api/conversations/${general.id}/messages`)).length, 2);
    const duplicateReview = { ...review, channels: review.channels.map(c => ({ ...c, name: c.name + ' duplicate' })) };
    const duplicateOmissions = await call('/api/slack-imports/preview', { body: { upload: upload.upload, review: duplicateReview } });
    duplicateReview.acceptedOmissions = [duplicateOmissions.omissionDigest];
    const duplicatePlan = await call('/api/slack-imports/preview', { body: { upload: upload.upload, review: duplicateReview } });
    await call(`/api/slack-imports/${duplicatePlan.review}/apply`, { body: { fingerprint: duplicatePlan.fingerprint }, status: 409 });
    assert.equal((await call(`/api/conversations/${general.id}/messages`)).length, 2);
    report.push({ name: 'local ZIP mapping and omission review, actual D1 kit lost-ack cold retry, two normal histories, thread, R2 bytes, normal search and ACL', passed: true, counts: omitted.counts });
    let undone = await call(`/api/slack-imports/${preview.review}/undo`, { body: {} });
    for (let i = 0; undone.job.state !== 'undone' && i < 20; i++)
        undone = await call(`/api/slack-imports/${preview.review}/undo`, { body: {} });
    assert.equal(undone.job.state, 'undone');
    assert.equal((await call('/api/search?q=caf%C3%A9')).items.some(x => x.id === history[0].id), false);
    assert.equal((await call('/api/conversations')).some(x => x.id === general.id), false);
    const deleted = await fetch(`${origin}/api/attachments/${history[0].attachments[0].id}/download`, { headers: { cookie: owner.cookie } });
    assert.equal(deleted.status, 404);
    let reused=await call(`/api/slack-imports/${duplicatePlan.review}/apply`,{body:{fingerprint:duplicatePlan.fingerprint}});
    for(let i=0;reused.job.state!=='completed'&&i<20;i++)reused=await call(`/api/slack-imports/${duplicatePlan.review}/resume`,{body:{}});
    assert.equal(reused.job.state,'completed');
    assert.equal((await call(`/api/conversations/${general.id}/messages`)).length,2);
    let cleared=await call(`/api/slack-imports/${duplicatePlan.review}/undo`,{body:{}});
    for(let i=0;cleared.job.state!=='undone'&&i<20;i++)cleared=await call(`/api/slack-imports/${duplicatePlan.review}/undo`,{body:{}});
    assert.equal(cleared.job.state,'undone');
    report.push({ name: 'owner guarded undo removes owned history, index, channels and attachment reachability', passed: true });
    // A distinct namespace represents an independently reviewed source. Live work
    // prevents channel removal, and a member authority change invalidates a plan.
    const review2 = { ...review, namespace: namespace + '-live' }, p2 = await call('/api/slack-imports/preview', { body: { upload: upload.upload, review: review2 } });
    review2.acceptedOmissions = [p2.omissionDigest];
    const ready2 = await call('/api/slack-imports/preview', { body: { upload: upload.upload, review: review2 } });
    let applied = await call(`/api/slack-imports/${ready2.review}/apply`, { body: { fingerprint: ready2.fingerprint } });
    for (let i = 0; applied.job.state !== 'completed' && i < 20; i++)
        applied = await call(`/api/slack-imports/${ready2.review}/resume`, { body: {} });
    const liveChannel = (await call('/api/conversations')).find(c => c.name === review2.channels[0].name);
    const live = await call(`/api/conversations/${liveChannel.id}/messages`, { body: { body: 'Later live work survives undo', intent: 'live-' + suffix } });
    await call(`/api/slack-imports/${ready2.review}/undo`, { body: {}, status: 409 });
    assert.ok((await call(`/api/conversations/${liveChannel.id}/messages`)).some(m => m.id === live.id));
    const mixed = await call(`/api/conversations/${liveChannel.id}/messages/window?limit=1`);
    assert.equal(mixed.items[0].id, live.id);
    assert.ok(mixed.items[0].sequence > 0);
    const older = await call(`/api/conversations/${liveChannel.id}/messages/window?limit=1&before=${mixed.cursor}`);
    assert.equal(older.items[0].immutable, true);
    assert.ok(older.items[0].sequence < 0);
    assert.equal(older.hasNewer, true);

    report.push({ name: 'undo rejects later live work and preserves it', passed: true });
    if (sql) {
        // A job one apply request cannot finish: requests fill the import kit's statement budget.
        const bigUpload = await call('/api/slack-imports/upload', { zip: largeSlackFixture(200, 5) });
        const stale = { namespace: namespace + '-stale', channels: bigUpload.channels.map((c, i) => ({ sourceId: c.sourceId, name: 'Stale ' + c.name + ' ' + suffix, members: i === 0 ? [owner.user.id, member.user.id, guest.user.id] : [owner.user.id] })), actors: Object.fromEntries(bigUpload.actors.map(a => [a.sourceId, null])), acceptedOmissions: [] }, p = await call('/api/slack-imports/preview', { body: { upload: bigUpload.upload, review: stale } });
        if (p.needsOmissionReview) stale.acceptedOmissions = [p.omissionDigest];
        const ready = await call('/api/slack-imports/preview', { body: { upload: bigUpload.upload, review: stale } });
        const partial = await call(`/api/slack-imports/${ready.review}/apply`, { body: { fingerprint: ready.fingerprint } });
        assert.ok(partial.job.checkpoint > 0 && partial.job.checkpoint < partial.job.total);
        await sql(`UPDATE oa_operators SET role='admin' WHERE id='${member.user.id}'`);
        const changed = await call(`/api/slack-imports/${ready.review}`);
        assert.equal(changed.job.checkpoint, partial.job.checkpoint);
        assert.equal(changed.forwardAuthority, false);
        assert.equal(changed.reversalSafe, true);
        assert.ok((await call('/api/slack-imports')).jobs.some(j => j.review === ready.review && !j.forwardAuthority));
        await call(`/api/slack-imports/${ready.review}/apply`, { body: { fingerprint: ready.fingerprint }, status: 409 });
        await call(`/api/slack-imports/${ready.review}/resume`, { body: {}, status: 409 });
        let rollback = await call(`/api/slack-imports/${ready.review}/undo`, { body: {} });
        for (let n = 0; rollback.job.state !== 'rolled_back' && n < 20; n++) rollback = await call(`/api/slack-imports/${ready.review}/undo`, { body: {} });
        assert.equal(rollback.job.state, 'rolled_back');
        const again = await call(`/api/slack-imports/${ready.review}/review`, { body: {} });
        assert.equal(again.source.upload, bigUpload.upload);
        const fresh = await call('/api/slack-imports/preview', { body: { upload: again.source.upload, review: again.review } });
        assert.notEqual(fresh.review, ready.review);
        let reapproved = await call(`/api/slack-imports/${fresh.review}/apply`, { body: { fingerprint: fresh.fingerprint } });
        for (let n = 0; reapproved.job.state !== 'completed' && n < 20; n++) reapproved = await call(`/api/slack-imports/${fresh.review}/resume`, { body: {} });
        assert.equal(reapproved.job.state, 'completed');
        await call(`/api/slack-imports/${ready.review}/undo`, { body: {} });
        const recoveredChannel = (await call('/api/conversations')).find(c => c.id !== liveChannel.id && c.name === stale.channels[0].name);
        assert.ok(recoveredChannel);
        assert.equal((await call(`/api/conversations/${recoveredChannel.id}/messages?limit=100`)).length, 100);
        await sql(`UPDATE oa_operators SET status='inactive' WHERE id='${member.user.id}'`);
        await call(`/api/slack-imports/${fresh.review}/apply`, { body: { fingerprint: fresh.fingerprint }, status: 409 });
        assert.equal((await call(`/api/slack-imports/${fresh.review}`)).forwardAuthority, false);
        report.push({ name: 'changed authority retains owner status, blocks forward work, permits guarded rollback and a fresh same-upload approval; stale cleanup cannot remove its replacement', passed: true });
    }
    report.push(await largeImportJourney({ call, owner, restart, suffix }));
    return report;
}
async function sourceFidelityJourney({ call, owner, suffix }) {
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
    const before = await call('/api/slack-imports'), channels = await call('/api/conversations');
    for (const [index, fixture] of fixtures.entries()) {
        const upload = await call('/api/slack-imports/upload', { zip: zipFixture([['users.json', fixture.users ?? [{ id: 'U1' }]], ['channels.json', [{ id: 'C1', name: 'general' }]], ['general/2024-01-01.json', fixture.rows], ...(fixture.files ?? [])]) });
        const review = { namespace: `blocked-${suffix}-${index}`, channels: [{ sourceId: 'C1', name: 'Blocked history', members: [owner.user.id] }], actors: Object.fromEntries(upload.actors.map(a => [a.sourceId, null])), acceptedOmissions: [] };
        const preview = await call('/api/slack-imports/preview', { body: { upload: upload.upload, review } });
        const retry = await call('/api/slack-imports/preview', { body: { upload: upload.upload, review: { ...review, acceptedOmissions: [preview.omissionDigest] } } });
        assert.equal(retry.blocked, true);
        assert.ok(retry.blockers.some(b => b.channel === 'C1' && b.reason === fixture.reason));
        assert.equal(retry.review, undefined);
        assert.equal(retry.fingerprint, undefined);
        await call(`/api/slack-imports/uploads/${upload.upload}`, { body: {} });
    }
    assert.deepEqual(await call('/api/slack-imports'), before);
    assert.deepEqual(await call('/api/conversations'), channels);
    return { name: 'selected history fidelity blockers cannot create a reviewed job or channel even with an accepted exclusion digest', passed: true, cases: fixtures.length };
}
async function largeImportJourney({ call, owner, restart, suffix }) {
    const source = await call('/api/slack-imports/upload', { zip: largeSlackFixture() }), review = { namespace: 'large-runtime-' + suffix, channels: source.channels.map(c => ({ sourceId: c.sourceId, name: 'Large ' + c.name + ' ' + suffix, members: [owner.user.id] })), actors: Object.fromEntries(source.actors.map(a => [a.sourceId, null])), acceptedOmissions: [] };
    const preview = await call('/api/slack-imports/preview', { body: { upload: source.upload, review } });
    assert.equal(preview.counts.messages, 1205);
    assert.equal(preview.counts.actors, 205);
    assert.equal(preview.needsOmissionReview, false);
    let result = await call(`/api/slack-imports/${preview.review}/apply`, { body: { fingerprint: preview.fingerprint } }), requests = 1;
    while (result.job.state !== 'completed' && requests < 220) {
        if (requests === 3)
            await restart();
        result = await call(`/api/slack-imports/${preview.review}/resume`, { body: {} });
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
