import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectSlackArchive, captureSlackArchive } from '../src/imports/slack.mjs';
import { realisticFixture, realisticSlackFixture, realisticSlackManifest, realisticReview, realisticLocalUsers } from './slack-import/realistic-fixture.mjs';

test('realistic Slack readiness repeats exactly and refuses unknown records without a silent import', () => {
    const fixture = realisticFixture(), manifest = realisticSlackManifest();
    assert.deepEqual(fixture.zip, realisticSlackFixture());
    const inspect = bytes => inspectSlackArchive(bytes, realisticLocalUsers);
    const review = realisticReview(), capture = bytes => captureSlackArchive(inspect(bytes), review, 'owner', realisticLocalUsers);
    const first = capture(fixture.zip), second = capture(realisticSlackFixture());
    assert.deepEqual(second, first);
    assert.equal(first.sourceAuthenticityVerified, false);
    assert.equal(first.completeness, 'unknown');
    const sourceRows = [...inspect(fixture.zip).archive.files].filter(([path]) => /^general\/.*\.json$/.test(path)).flatMap(([, bytes]) => JSON.parse(bytes));
    assert.equal(sourceRows.length * (manifest.channels - manifest.emptyChannels.length), manifest.messages);
    assert.equal(inspect(fixture.zip).actors.find(a => a.sourceId === manifest.duplicateEmailSourceIds[0]).match, 'ambiguous');
    // Admission of documented subtypes changes in Part 2. Preserve the ordinary
    // canary and verify source fidelity for every currently admitted record.
    const canary = first.messages.find(m => m.channel === fixture.markers.channel && m.sourceTimestamp === fixture.markers.historySearch.ts);
    assert.equal(canary.body, fixture.markers.historySearch.text);
    for (const admitted of first.messages.filter(m => m.channel === fixture.markers.channel)) {
        const original = sourceRows.find(row => row.ts === admitted.sourceTimestamp);
        // Broadcast provenance references the real parent, without a duplicate
        // parent body that would survive erasure. All other source fields remain.
        assert.deepEqual(admitted.sourceRecord, original.root ? {...original, root:{ts:original.root.ts}} : original);
    }
    const unknown = realisticFixture({ includeUnknown: true }), refused = capture(unknown.zip), repeated = capture(realisticSlackFixture({ includeUnknown: true }));
    assert.deepEqual(refused, repeated);
    assert.equal(refused.blocked, true);
    assert.ok(refused.blockers.some(b => b.channel === unknown.markers.channel && b.key.endsWith(`:${unknown.markers.unknown.ts}`)));
    assert.ok(!refused.messages.some(m => m.channel === unknown.markers.channel && m.sourceTimestamp === unknown.markers.unknown.ts));
    assert.ok(!inspect(fixture.zip).archive.files.has(`files/${fixture.missingFile.id}/${fixture.missingFile.name}`));
    assert.ok(inspect(realisticSlackFixture({ supplyMissingFile: true })).archive.files.has(`files/${fixture.missingFile.id}/${fixture.missingFile.name}`));
});
