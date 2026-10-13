import test from 'node:test';
import assert from 'node:assert/strict';
import { slackServiceFixture, testHub } from './slack-import/sqlite-service.mjs';
import { zipFixture } from './slack-import/fixture.mjs';
import { roundTrip } from './slack-import/archive-roundtrip.mjs';
import { reverseRestored } from './slack-import/restored-reversal.mjs';
function richZip() {
    const ordinary = { type: 'message', user: 'U1', ts: '1700000000.000001', text: 'Current edited text for <@U2>', edited: { user: 'U1', ts: '1700000001.000001' }, reactions: [{ name: 'thumbsup', count: 3, users: ['U2'] }] };
    const rows = [ordinary, { type: 'message', subtype: 'thread_broadcast', user: 'U2', ts: '1700000000.000002', thread_ts: ordinary.ts, root: {ts: ordinary.ts, text: ordinary.text}, text: 'Broadcast reply' }, { type: 'message', subtype: 'bot_message', bot_id: 'B1', username: 'Release robot', ts: '1700000000.000003', text: 'Bot report' }, { type: 'message', user: 'UB', ts: '1700000000.000004', text: 'Directory bot report' }, { type: 'message', subtype: 'file_share', user: 'U1', ts: '1700000000.000005', text: 'Files remain visible', files: [{ id: 'F0', name: 'ABSENT_SECRET.txt', mimetype: 'text/plain', size: 17 }, { id: 'F1', name: 'supplied.txt', mimetype: 'text/plain', size: 5 }] }, {type:'message',subtype:'bot_message',bot_id:'B1',username:'Alias robot',ts:'1700000000.000007',text:'Same bot with a presentation override'}, {type:'message',subtype:'bot_message',user:'U2',ts:'1700000000.000008',text:'Unflagged bot declaration'}, {type:'message',subtype:'file_share',user:'U1',ts:'1700000000.000009',text:'',file:{id:'FS',name:'singular.txt',mimetype:'text/plain',size:8}}, {type:'message',subtype:'file_share',user:'U1',ts:'1700000000.000020',text:'Historical missing file',file:{id:'FM',name:'SINGLE_ABSENT.txt',mimetype:'text/plain',size:9}}, ...['channel_join', 'channel_leave', 'channel_topic', 'channel_purpose', 'channel_name', 'pinned_item', 'reminder_add'].map((subtype, n) => ({ type: 'message', subtype, user: 'U1', ts: `1700000000.00001${n}`, text: 'System event' }))];
    return zipFixture([['users.json', [{ id: 'U1', name: 'Ari' }, { id: 'U2', name: 'bee', real_name: 'Bee Source' }, { id: 'UB', name: 'Directory robot', is_bot: true }, { id: 'UNUSED', name: 'Unused' }]], ['channels.json', [{ id: 'C1', name: 'general' }, { id: 'C2', name: 'empty' }]], ['general/2024-01-01.json', rows], ['files/F1/supplied.txt', 'hello'], ['files/FS/singular.txt', 'singular']]);
}
test('Slack review admits explicit missing files, source bots, history metadata and empty channels through real apply, restore and undo', async () => {
    const f = await slackServiceFixture();
    try {
        const upload = await f.custody.localUpload(f.c, new Request('https://fixture.test/upload', { method: 'POST', body: richZip() }));
        const inspection = await f.service.inspectUpload(f.c, upload);
        assert.equal(inspection.actors.find(a => a.sourceId === 'B1').label, 'Release robot');
        assert.ok(inspection.actors.find(a => a.sourceId === 'UB').externalOnly);
        const review = { namespace: 'rich-history', channels: inspection.channels.map(c => ({ sourceId: c.sourceId, name: c.name, members: [f.owner.operatorId] })), actors: Object.fromEntries(inspection.actors.map(a => [a.sourceId, f.owner.operatorId])), acceptedOmissions: [] };
        const blocked = await f.service.previewImport(f.c, { upload, review });
        assert.equal(blocked.blocked, true); assert.equal(blocked.fingerprint, undefined);
        assert.deepEqual(blocked.missingFiles, { count: 2, bytes: 26, unknownSizes: 0, accepted: false });
        assert.deepEqual(blocked.missingFileInventory, [{channel:'C1',key:'rich-history:C1:1700000000.000005',sourceId:'F0',name:'ABSENT_SECRET.txt',size:17},{channel:'C1',key:'rich-history:C1:1700000000.000020',sourceId:'FM',name:'SINGLE_ABSENT.txt',size:9}]);
        assert.equal(Object.values(blocked.skippedKinds).reduce((a, b) => a + b, 0), 6);
        review.importWithoutMissingFiles = true;
        const approved = await f.service.previewImport(f.c, { upload, review });
        const changed = await f.service.previewImport(f.c, { upload, review: { ...review, actors: { ...review.actors, UNUSED: null } } });
        assert.notEqual(changed.fingerprint, approved.fingerprint, 'unused identity decision must bind approval');
        await f.finish(approved);
        const { mixedHistory, mixedSearch } = await import('../src/imports/history.ts');
        const conversation = f.db.prepare("SELECT conversation FROM nook_import_channels WHERE source_id='C1'").get().conversation;
        const history = await mixedHistory(f.c, conversation, {}, async () => []);
        assert.equal(history.length, 10); assert.equal(history[0].body, 'Current edited text for <@U2>');
        assert.equal(history[0].slack.text, 'Current edited text for @Bee Source'); assert.equal(history[0].slack.edited, true);
        assert.deepEqual(history[0].slack.reactions, [{ name: 'thumbsup', count: 3, people: ['Bee Source'] }]);
        assert.equal(history[1].parent, history[0].id);
        assert.deepEqual(history[1].provenance.sourceRecord.root, {ts: history[0].provenance.timestamp});
        const alias=history.find(m=>m.body==='Same bot with a presentation override');assert.equal(alias.authorName,'Alias robot');assert.equal(alias.provenance.actor,history[2].provenance.actor);assert.equal(alias.provenance.association,null);
        for (const bot of history.slice(2, 4)) { assert.equal(bot.author, null); assert.equal(bot.provenance.association, null); }
        assert.deepEqual(history.slice(2, 4).map(m => m.authorName), ['Release robot', 'Directory robot']);
        assert.equal(history[4].attachments[0].name, 'supplied.txt'); assert.equal(history[4].slack.missingFiles[0].name, 'ABSENT_SECRET.txt');
        const singular = history.find(m => m.provenance.sourceRecord.file?.id === 'FS');
        assert.equal(singular.body, ''); assert.equal(singular.attachments[0].name, 'singular.txt');
        assert.equal(singular.provenance.sourceRecord.files, undefined);
        const singularMissing = history.find(m => m.provenance.sourceRecord.file?.id === 'FM');
        assert.deepEqual(singularMissing.slack.missingFiles, [{sourceId:'FM',name:'SINGLE_ABSENT.txt',size:9}]);
        assert.deepEqual(singularMissing.attachments, []);
        const search=(await mixedSearch(f.c, { q: 'edited text' })).items[0];assert.equal(search.id,history[0].id);assert.equal(search.body,history[0].body);assert.equal(search.displayBody,history[0].slack.text);
        for (const table of ['nook_events', 'nook_attention', 'nook_outcomes', 'nook_reactions', 'nook_reads']) assert.equal(f.db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n, 0, table);
        await roundTrip(f, (target, bucket) => reverseRestored(target, bucket, approved.review, f.owner.operatorId));
        await assert.rejects(roundTrip(f, () => {}, items => { const row=items.find(i=>i.table==='nook_import_reviews'&&i.row.id===approved.review).row;row.review_json=JSON.stringify({...JSON.parse(row.review_json),importWithoutMissingFiles:false}); }), /slack_review_choices_changed/);
        const { Context } = await import('../src/platform/storage/context.ts');
        const erasure = await import('../src/team/erasure/service.ts');
        const c = new Context({ ...f.c.env, CHAT_HUB: { idFromName: () => '', get: () => ({ fetch: async () => new Response() }) } }, f.owner);
        let receipt;
        for (const message of [history[4], singularMissing]) {
            receipt = await erasure.erase(c, 'imported-message', message.id, { confirmation: 'ERASE' });
            for (let n = 0; receipt.state !== 'complete' && n < 20; n++) receipt = await erasure.advance(c, receipt.id);
            assert.equal(receipt.state, 'complete');
        }
        for (const table of f.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all()) {
            assert.ok(!JSON.stringify(f.db.prepare(`SELECT * FROM "${table.name}"`).all()).match(/ABSENT_SECRET|SINGLE_ABSENT/), table.name + ' retained erased filename');
        }
        assert.equal(f.db.prepare('SELECT state FROM nook_import_reviews WHERE id=?').get(changed.review).state,'discarded');
        receipt=await erasure.erase(c,'imported-message',history[0].id,{confirmation:'ERASE'});for(let n=0;receipt.state!=='complete'&&n<20;n++)receipt=await erasure.advance(c,receipt.id);assert.equal(receipt.state,'complete');
        for(const table of f.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all())assert.ok(!JSON.stringify(f.db.prepare(`SELECT * FROM "${table.name}"`).all()).includes('Current edited text for'),table.name+' retained erased broadcast root text');
        const declaration=history.find(m=>m.body==='Unflagged bot declaration');receipt=await erasure.erase(c,'imported-message',declaration.id,{confirmation:'ERASE'});for(let n=0;receipt.state!=='complete'&&n<20;n++)receipt=await erasure.advance(c,receipt.id);assert.equal(receipt.state,'complete');
        await roundTrip(f, target => assert.equal(target.db.prepare('SELECT count(*) AS n FROM nook_import_records').get().n, 6));
    } finally { f.close(); }
});

// D1 refuses a Worker invocation's statement after its 1,000th. Count every
// statement each public import request runs at the binding, batch members
// included, while an export with more files than one request stages goes
// through upload, preview, apply and undo.
test('every Slack import request stays within the D1 statement limit through staged files, apply, the imports list and undo', async () => {
    const f = await slackServiceFixture(), box = { n: 0 }, counts = [], origin = 'http://127.0.0.1:15820';
    try {
        const { slackImportRoute } = await import('../src/imports/routes.ts');
        const counted = db => { const raw = new WeakMap(), wrap = s => { const w = { bind: (...a) => wrap(s.bind(...a)), first: (...a) => (box.n++, s.first(...a)), all: (...a) => (box.n++, s.all(...a)), run: (...a) => (box.n++, s.run(...a)) }; raw.set(w, s); return w; }; return { prepare: q => wrap(db.prepare(q)), batch: ss => { box.n += ss.length; return db.batch(ss.map(x => raw.get(x) ?? x)); } }; };
        const env = { DB: counted(f.adapter), FILES: f.bucket, CHAT_HUB: testHub(), AUTH_ORIGIN: origin, AUTH_LOCAL: 'true', OWNER_EMAIL: 'owner@example.test', SESSION_SECRET: 'synthetic-test-secret-at-least-thirty-two-characters', MAIL_PROVIDER: 'development', MAIL_FROM: 'nook@example.test' };
        async function call(path, body) {
            box.n = 0;
            const zip = Buffer.isBuffer(body), response = await slackImportRoute(new Request(origin + '/api/slack-imports' + path, body === undefined ? { headers: { origin, host: new URL(origin).host, cookie: f.ownerCookie } } : { method: 'POST', headers: { origin, host: new URL(origin).host, cookie: f.ownerCookie, 'content-type': zip ? 'application/zip' : 'application/json' }, body: zip ? body : JSON.stringify(body) }), env);
            const result = await response.json();
            assert.equal(response.status, 200, `${path}: ${JSON.stringify(result)}`);
            counts.push({ path, statements: box.n });
            return result;
        }
        const rows = [], files = [];
        for (let i = 0; i < 400; i++) {
            const file = i % 3 === 0 ? { id: 'F' + i, name: `note-${i}.txt`, mimetype: 'text/plain', size: Buffer.byteLength(`file ${i}`) } : null;
            rows.push({ type: 'message', user: 'U1', ts: `1700000000.${String(i + 1).padStart(6, '0')}`, text: `Budget history ${i}`, ...(file ? { files: [file] } : {}) });
            if (file) files.push([`files/${file.id}/${file.name}`, `file ${i}`]);
        }
        const source = await call('/upload', zipFixture([['users.json', [{ id: 'U1', name: 'Ari' }]], ['channels.json', [{ id: 'C1', name: 'general' }]], ['general/2024-01-01.json', rows], ...files]));
        const review = { namespace: 'budget', channels: [{ sourceId: 'C1', name: 'Budget general', members: [f.owner.operatorId] }], actors: { U1: null }, acceptedOmissions: [] };
        let preview = await call('/preview', { upload: source.upload, review });
        if (preview.needsOmissionReview) preview = await call('/preview', { upload: source.upload, review: { ...review, acceptedOmissions: [preview.omissionDigest] } });
        let result = await call(`/${preview.review}/apply`, { fingerprint: preview.fingerprint }), staging = 0;
        for (; !result.job && staging < 10; staging++) result = await call(`/${preview.review}/apply`, { fingerprint: preview.fingerprint });
        assert.ok(staging > 0, 'files are staged across more than one request');
        for (let n = 0; result.job.state !== 'completed' && n < 50; n++) result = await call(`/${preview.review}/resume`, {});
        assert.equal(result.job.state, 'completed');
        assert.equal(f.db.prepare("SELECT count(*) AS n FROM nook_import_files f JOIN nook_attachments a ON a.id=f.attachment WHERE a.state='attached'").get().n, files.length);
        assert.equal(f.db.prepare('SELECT count(*) AS n FROM nook_import_records').get().n, rows.length);
        // The list reads job rows; opening the import runs the kit's full guards.
        assert.deepEqual((await call('')).jobs.map(j => [j.review, j.job.state, j.job.checkpoint, j.reversalSafe]), [[preview.review, 'completed', result.job.total, true]]);
        assert.equal((await call('/' + preview.review)).job.state, 'completed');
        result = await call(`/${preview.review}/undo`, {});
        for (let n = 0; result.job.state !== 'undone' && n < 50; n++) result = await call(`/${preview.review}/undo`, {});
        assert.equal(result.job.state, 'undone');
        assert.equal(f.db.prepare('SELECT count(*) AS n FROM nook_import_records').get().n, 0);
        // Cleanup takes what the last undo request leaves; the hub drains the rest.
        assert.equal(f.db.prepare("SELECT count(*) AS n FROM nook_import_objects o WHERE o.state='deleted' OR EXISTS(SELECT 1 FROM nook_object_deletes d WHERE d.object_key=o.object_key)").get().n, files.length);
        const heaviest = counts.reduce((a, b) => b.statements > a.statements ? b : a);
        assert.ok(heaviest.statements <= 1000, `${heaviest.path} ran ${heaviest.statements} D1 statements`);
    } finally { f.close(); }
});
