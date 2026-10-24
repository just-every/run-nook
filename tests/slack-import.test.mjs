import test from 'node:test';
import assert from 'node:assert/strict';
import { readSlackZip } from '../src/imports/zip.mjs';
import { inspectSlackArchive, captureSlackArchive } from '../src/imports/slack.mjs';
import { zipFixture, slackFixture, fixtureUsers, fixtureReview } from './slack-import/fixture.mjs';
test('ordinary stored, deflate and descriptor ZIPs preserve bytes without extraction', () => {
    for (const options of [{}, { deflate: true }, { deflate: true, descriptor: true }, { deflate: true, descriptor: true, descriptorSignature: false }])
        assert.equal(readSlackZip(zipFixture([['a/', ''], ['a/b.txt', 'café 👋']], options)).files.get('a/b.txt').toString(), 'café 👋');
});
test('ZIP admission rejects malicious names, aliases, symlinks, overlaps and format hazards', () => {
    for (const path of ['../escape', '/absolute', 'a\\b', 'a/../b', 'C:/x', 'a//b', 'cafe\u0301', 'a\0b', 'a／..／b', 'a\u200eb'])
        assert.throws(() => readSlackZip(zipFixture([[path, 'x']])), /ZIP_REJECTED/);
    for (const names of [['a', 'a'], ['A', 'a'], ['Ｋ', 'K'], ['a', 'a/b']])
        assert.throws(() => readSlackZip(zipFixture(names.map(x => [x, 'x']))), /ZIP_REJECTED/);
    const base = zipFixture([['a', 'hello']]), central = base.readUInt32LE(base.length - 6);
    for (const mutate of [b => b.writeUInt32LE(0xa1ff0000, central + 38), b => b.writeUInt16LE(1, central + 8), b => b.writeUInt16LE(99, central + 10), b => b.writeUInt32LE(0xffffffff, central + 20), b => b.writeUInt16LE(1, b.length - 18), b => b.writeUInt32LE(1, central + 42), b => b[30] = 98, b => b[31] ^= 1, b => b.writeUInt32LE(4, central + 24)]) {
        const b = Buffer.from(base);
        mutate(b);
        assert.throws(() => readSlackZip(b), /ZIP_REJECTED/);
    }
    const overlap = zipFixture([['a', 'hello'], ['b', 'world']]), cd = overlap.readUInt32LE(overlap.length - 6);
    overlap.writeUInt32LE(0, cd + 47 + 42);
    assert.throws(() => readSlackZip(overlap), /ZIP_REJECTED/);
    assert.throws(() => readSlackZip(zipFixture([['bomb', Buffer.alloc(1000000)]], { deflate: true })), /ZIP_REJECTED/);
    const corrupt = zipFixture([['a', 'hello']], { deflate: true, descriptor: true });
    corrupt[31] ^= 0xff;
    assert.throws(() => readSlackZip(corrupt), /ZIP_REJECTED/);
    const invalid = zipFixture([['a', 'hello']]);
    invalid[30] = 0xff;
    invalid[central + 46] = 0xff;
    assert.throws(() => readSlackZip(invalid), /ZIP_REJECTED/);
});
test('Slack review preserves external actors, exact text, threads and supplied file bytes across channels', async () => {
    const { kitSource } = await import('../src/imports/source.ts'), { buildImportPlan } = await import('../src/base/modules/import-kit/src/plan/index.ts');
    const inspected = inspectSlackArchive(slackFixture(), fixtureUsers);
    assert.equal(inspected.actors.find(a => a.sourceId === 'U1').match, 'suggested');
    assert.equal(inspected.actors.find(a => a.sourceId === 'U2').match, 'ambiguous');
    const capture = captureSlackArchive(inspected, fixtureReview, 'owner', fixtureUsers);
    assert.deepEqual(capture.counts, { channels: 2, actors: 3, messages: 4, threads: 2, files: 2, bytes: 11, omissions: 1 });
    assert.equal(capture.messages[0].body, '  Exact café 日本語 👋\n');
    assert.equal(capture.messages[1].threadRoot, capture.messages[0].key);
    assert.equal(capture.messages[0].files[0].bytes.toString(), 'hello');
    assert.equal(capture.actors.find(a => a.sourceId === 'U404').association, null);
    assert.deepEqual(capture.actors.find(a => a.sourceId === 'U404').sourceRecord, inspected.users.find(u => u.id === 'U404'));
    assert.equal(capture.messages[2].files[0].bytes.toString(), 'second');
    assert.equal(capture.messages[3].threadRoot, capture.messages[2].key);
    assert.equal(capture.blocked, false);
    assert.equal(capture.omissionsAccepted, false);
    assert.ok(!JSON.stringify(capture).includes('PRIVATE CANARY'));
    const approved = captureSlackArchive(inspected, { ...fixtureReview, acceptedOmissions: [capture.omissionDigest] }, 'owner', fixtureUsers);
    assert.equal(approved.omissionsAccepted, true);
    assert.throws(() => kitSource(capture, 'owner', 'unapproved', 'fixture-review'), /exclusion review required/);
    const { source, mapping } = kitSource(approved, 'owner', 'approved', 'fixture-review');
    const plan = buildImportPlan(source, mapping, { destination: 'owner', namespace: approved.namespace, mappingVersion: mapping.version, authorization: { principalId: 'owner' } });
    assert.equal(plan.counts.rejected, 0);
    assert.equal(plan.counts.effects, 9);
    assert.throws(() => captureSlackArchive(inspected, { ...fixtureReview, actors: { U1: null } }, 'owner', fixtureUsers), /explicit actor decision/);
    assert.throws(() => captureSlackArchive(inspected, { ...fixtureReview, channels: [{ sourceId: 'G1', name: 'leak', members: ['owner'] }] }, 'owner', fixtureUsers), /unavailable/);
    const aliasZip=zipFixture([
        ['users.json',[]],
        ['channels.json',[{id:'C1',name:'D1'}]],
        ['dms.json',[{id:'D1',members:['U1','U2']}]]
    ]);
    assert.throws(()=>inspectSlackArchive(aliasZip),/channel folder alias/);
    const confusedFile = zipFixture([['users.json', [{ id: 'U1' }]], ['channels.json', [{ id: 'C1', name: 'general' }]], ['general/2024-01-01.json', [{ type: 'message', user: 'U1', ts: '1.000001', text: 'public', files: [{ id: 'F1', name: 'private.txt', mimetype: 'text/plain', local_path: 'secret/2024-01-01.json' }] }]], ['secret/2024-01-01.json', 'PRIVATE CANARY']]);
    assert.throws(() => captureSlackArchive(inspectSlackArchive(confusedFile), { namespace: 'custody', channels: [{ sourceId: 'C1', name: 'history', members: ['owner'] }], actors: { U1: null }, acceptedOmissions: [] }, 'owner', fixtureUsers), /file identity/);

});
test('selected source fidelity failures block the whole import even with accepted exclusions; deselecting a channel is explicit', async () => {
    const { kitSource } = await import('../src/imports/source.ts'), { buildImportPlan } = await import('../src/base/modules/import-kit/src/plan/index.ts'), { importTargets } = await import('../src/imports/target.ts'), { canonicalJson, sha256 } = await import('../src/imports/kit.ts');
    const message = { type: 'message', user: 'U1', ts: '1.000001', text: 'ordinary history' }, file = { id: 'F1', name: 'history.txt', mimetype: 'text/plain' };
    const review = { namespace: 'test', channels: [{ sourceId: 'C1', name: 'history', members: ['owner'] }, { sourceId: 'C2', name: 'other history', members: ['owner'] }], actors: { U1: null }, acceptedOmissions: [] };
    const cases = [
        { rows: [{ ...message, user: 'U404' }], reason: 'source-actor-missing-from-export' },
        { rows: [{ ...message, subtype: 'file_share', user: 'U404', file }], files: [['files/F1/history.txt', 'bytes']], reason: 'source-actor-missing-from-export' },
        { rows: [{ ...message, files: [file] }], reason: 'missing-supplied-bytes' },
        ...['message_deleted', 'message_changed'].map(subtype => ({ rows: [{ ...message, text: 'old secret' }, { type: 'message', subtype, ts: '2.000001', previous_message: { ts: message.ts, text: 'old secret' }, ...(subtype === 'message_deleted' ? { deleted_ts: message.ts } : { message: { ts: message.ts, text: 'replacement secret' } }) }, { ...message, ts: '3.000001', thread_ts: message.ts }], reason: 'source-change-or-deletion-not-reconstructed' })),
        { rows: [{ ...message, subtype: 'future_unknown_record' }], reason: 'unsupported-message-type:message:subtype:future_unknown_record' },
        { rows: [{ ...message, type: 'reaction_added' }], reason: 'unsupported-message-type:reaction_added:subtype:(none)' },
        { rows: [{ ...message, thread_ts: '0.000001' }], reason: 'missing-or-unsupported-thread-parent' },
        { rows: [{ ...message, files: [file] }], files: [['files/F1/history.txt', Buffer.alloc(1024 * 1024 + 1, 65)]], reason: 'slack-file-size-limit' },
        { rows: [{ ...message, files: [{ ...file, mimetype: 'application/octet-stream' }] }], files: [['files/F1/history.txt', 'unsupported']], reason: 'unsupported-or-invalid-file-bytes' },
        { rows: [{ ...message, files: Array.from({ length: 6 }, (_, i) => ({ ...file, id: 'F' + i })) }], files: Array.from({ length: 6 }, (_, i) => [`files/F${i}/history.txt`, 'bytes']), reason: 'attachment-count-limit' }
    ];
    for (const fixture of cases) {
        const inspected = inspectSlackArchive(zipFixture([['users.json', [{ id: 'U1' }]], ['channels.json', [{ id: 'C1', name: 'general' }, { id: 'C2', name: 'other' }]], ['general/2024-01-01.json', fixture.rows], ['other/2024-01-01.json', [message]], ...(fixture.files ?? [])]));
        assert.equal(inspected.actors.some(a => a.sourceId === 'U404'), false);
        const preview = captureSlackArchive(inspected, review, 'owner', fixtureUsers);
        const attempted = captureSlackArchive(inspected, { ...review, acceptedOmissions: [preview.omissionDigest] }, 'owner', fixtureUsers);
        assert.equal(attempted.blocked, true, fixture.reason);
        assert.ok(attempted.blockers.some(b => b.channel === 'C1' && b.reason === fixture.reason), fixture.reason);
        assert.throws(() => kitSource(attempted, 'owner', 'blocked', 'fixture-review'), /blocking fidelity/);
        assert.ok(!JSON.stringify(attempted).includes('old secret'));
        assert.ok(!JSON.stringify(attempted).includes('replacement secret'));
        const subset = { ...review, channels: review.channels.slice(1) }, diagnostic = captureSlackArchive(inspected, subset, 'owner', fixtureUsers);
        const approved = captureSlackArchive(inspected, { ...subset, acceptedOmissions: [diagnostic.omissionDigest] }, 'owner', fixtureUsers);
        assert.equal(approved.blocked, false);
        assert.deepEqual(approved.messages.map(m => m.body), [message.text]);
        assert.ok(approved.omissions.some(o => o.kind === 'channel' && o.key === 'C1' && o.reason === 'not-selected'));
        const { source, mapping } = kitSource(approved, 'owner', 'subset', 'fixture-review');
        const plan = buildImportPlan(source, mapping, { destination: 'owner', namespace: approved.namespace, mappingVersion: mapping.version, authorization: { principalId: 'owner' } });
        assert.equal(plan.counts.effects, 3);
        assert.equal(plan.counts.rejected, 0);
    }
    const absent = inspectSlackArchive(zipFixture([['users.json', []], ['channels.json', [{ id: 'C1', name: 'general' }]], ['general/2024-01-01.json', [message]]]));
    const missingActor = captureSlackArchive(absent, { ...review, channels: review.channels.slice(0, 1), actors: {} }, 'owner', fixtureUsers);
    assert.equal(absent.actors.length, 0);
    assert.equal(missingActor.actors.length, 0);
    assert.equal(missingActor.blocked, true);
    assert.throws(() => kitSource(missingActor, 'owner', 'empty-users', 'fixture-review'), /blocking fidelity/);
    const bytes = Buffer.alloc(1024 * 1024, 65), valid = inspectSlackArchive(zipFixture([['users.json', [{ id: 'U1' }]], ['channels.json', [{ id: 'C1', name: 'general' }]], ['general/2024-01-01.json', [{ ...message, files: [file] }]], ['files/F1/history.txt', bytes]]));
    const capture = captureSlackArchive(valid, { ...review, channels: review.channels.slice(0, 1) }, 'owner', fixtureUsers), { source, mapping } = kitSource(capture, 'owner', 'file-boundary', 'fixture-review');
    const context = { destination: 'owner', namespace: capture.namespace, mappingVersion: mapping.version, authorization: { principalId: 'owner' } }, plan = buildImportPlan(source, mapping, context), effect = plan.entries.find(e => e.source.kind === 'message').effects[0];
    assert.equal(plan.counts.rejected, 0);
    assert.ok(importTargets().write({ ...effect, destination: 'owner', revision: 'fixture' }).length);
    const oversized = structuredClone(source), row = oversized.records.find(r => r.kind === 'message');
    row.payload.files[0].size++;
    row.payloadHash = sha256(canonicalJson(row.payload));
    assert.throws(() => buildImportPlan(oversized, mapping, context), /Slack 1 MiB limit/);
    assert.throws(() => importTargets().write({ ...effect, value: row.payload, destination: 'owner', revision: 'fixture' }), /Slack 1 MiB limit/);
    const missingBytes = structuredClone(effect.value); missingBytes.files = [];
    assert.throws(() => importTargets().write({ ...effect, value: missingBytes, destination: 'owner', revision: 'fixture' }), /all referenced file bytes/);
});
test('export JSON refuses duplicate keys, invalid Unicode and malformed schemas', () => {
    for (const users of ['[{"id":"U1","id":"U2"}]', '[{"id":"U1","name":"\\ud800"}]', '{"users":[]}', '[{"id":"U1","count":1e999}]', '[{"id":"U1","count":9007199254740993}]', '[{"id":"U1","count":9007199254740993.0}]', '[{"id":"U1","count":9007199254740993e0}]'])
        assert.throws(() => inspectSlackArchive(zipFixture([['users.json', users], ['channels.json', []]])), /SLACK_INVALID/);
    for (const bot_profile of [[], {id:'OTHER',name:'Robot'}, {id:'B1',name:{}}, {id:'B1',name:'Robot',icons:[]}]) assert.throws(() => inspectSlackArchive(zipFixture([['users.json', []], ['channels.json', [{id:'C1',name:'general'}]], ['general/2024-01-01.json', [{type:'message',subtype:'bot_message',bot_id:'B1',bot_profile,ts:'1.000001',text:'Bot'}]]])), /bot profile identity/);
});
test('large synthetic Slack archive crosses the former actor/message caps through the actual Base planner', async () => {
    const { largeSlackFixture } = await import('./slack-import/fixture.mjs'), { kitSource } = await import('../src/imports/source.ts'), { buildImportPlan } = await import('../src/base/modules/import-kit/src/plan/index.ts');
    const inspected = inspectSlackArchive(largeSlackFixture(), fixtureUsers), review = { namespace: 'large-fixture', channels: inspected.channels.map(c => ({ sourceId: c.id, name: c.name, members: ['owner'] })), actors: Object.fromEntries(inspected.actors.map(a => [a.sourceId, null])), acceptedOmissions: [] }, capture = captureSlackArchive(inspected, review, 'owner', fixtureUsers), { source, mapping } = kitSource(capture, 'owner', 'large-upload', 'fixture-review');
    const plan = buildImportPlan(source, mapping, { destination: 'owner', namespace: capture.namespace, mappingVersion: mapping.version, authorization: { principalId: 'owner' } });
    assert.equal(capture.counts.messages, 1205);
    assert.equal(capture.counts.actors, 205);
    assert.equal(capture.counts.threads, 6);
    assert.equal(plan.counts.rejected, 0);
    assert.equal(plan.counts.effects, 1412);
});
