import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, realpathSync, writeFileSync, readFileSync, readdirSync, existsSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { once } from 'node:events';
import { runSlackFiles } from '../scripts/slack-files/command.mjs';
import { zipFixture } from './slack-import/fixture.mjs';
import { sha256, ZIP_LIMITS } from '../src/imports/zip.mjs';
import { SLACK_FILE_LIMIT } from '../src/imports/policy.mjs';

const token = 'synthetic-bearer-secret-never-persisted';
const querySecret = 'synthetic-query-secret';
const file = (id = 'F1', extra = {}) => ({ id, name: `${id}.txt`, size: 5, mimetype: 'text/plain', url_private: `https://files.slack.com/${id}?signature=${querySecret}`, ...extra });
function fixture(t, items = [file()], extraEntries = []) {
    const root = mkdtempSync(join(realpathSync(tmpdir()), 'nook-slack-files-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const input = join(root, 'export.zip'), output = join(root, 'out');
    writeFileSync(input, zipFixture([['users.json', []], ['channels.json', [{ id: 'C1', name: 'general' }]], ['general/2024-01-01.json', items.map((f, index) => ({ type: 'message', ts: `1.${String(index).padStart(6, '0')}`, files: [f] }))], ...extraEntries]));
    return { root, input, output };
}
async function server(t, handler) {
    const requests = [];
    const server = createServer((req, res) => { requests.push({ url: req.url, authorization: req.headers.authorization }); handler(req, res); });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    // Injection exists only in this test. Production admission still sees and
    // validates the original HTTPS Slack URL, on every redirect.
    const transport = (url, options) => {
        const source = new URL(url);
        assert.equal(source.origin, 'https://files.slack.com');
        return fetch(origin + source.pathname + source.search, options);
    };
    return { requests, transport, origin };
}
async function command(f, transport, flags = ['--fetch', '--token-env', 'OWNER_SELECTED_SLACK_TOKEN']) {
    let stdout = '', stderr = '';
    const code = await runSlackFiles([f.input, f.output, ...flags], { env: { OWNER_SELECTED_SLACK_TOKEN: token }, transport, stdout: text => { stdout += text; }, stderr: text => { stderr += text; } });
    assert.ok(!stdout.includes(token) && !stderr.includes(token), 'bearer token absent from command output');
    assert.ok(!stdout.includes(querySecret) && !stderr.includes(querySecret), 'URL query absent from command output');
    return { code, stdout, stderr };
}
function savedBytes(directory) {
    if (!existsSync(directory)) return [];
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? savedBytes(join(directory, entry.name)) : [readFileSync(join(directory, entry.name))]);
}
function noSecrets(f) { for (const bytes of savedBytes(f.output)) { assert.ok(!bytes.includes(Buffer.from(token))); assert.ok(!bytes.includes(Buffer.from(querySecret))); } }

test('public CLI lists unique references with host only; fetching needs both explicit flags', async t => {
    const f = fixture(t, [file(), file()]);
    const cli = spawnSync(process.execPath, ['scripts/slack-files.mjs', f.input, f.output], { cwd: resolve('.'), encoding: 'utf8' });
    assert.equal(cli.status, 0, cli.stderr);
    const rows = cli.stdout.trim().split('\n').map(JSON.parse);
    assert.equal(rows.filter(row => row.file).length, 1);
    assert.deepEqual(rows[0].file, { id: 'F1', name: 'F1.txt', size: 5, host: 'files.slack.com' });
    assert.ok(!cli.stdout.includes(querySecret)); assert.ok(!cli.stdout.includes('https://'));
    assert.equal(existsSync(f.output), false);
    for (const flags of [['--fetch'], ['--token-env', 'OWNER_SELECTED_SLACK_TOKEN'], ['--fetch', '--token-env', 'MISSING']]) {
        const result = await command(f, () => assert.fail('no network without explicit credentials'), flags);
        assert.equal(result.code, 1); assert.equal(existsSync(f.output), false);
    }
});

test('authenticated redirect fetch publishes import layout, verifies reruns and detects changed bytes', async t => {
    const f = fixture(t), s = await server(t, (req, res) => {
        if (req.url.startsWith('/F1?')) { res.writeHead(302, { Location: '/download' }); res.end(); }
        else res.end('hello');
    });
    const first = await command(f, s.transport);
    assert.equal(first.code, 0, first.stderr);
    assert.equal(readFileSync(join(f.output, 'files/F1-F1.txt'), 'utf8'), 'hello');
    assert.equal(s.requests.length, 2);
    assert.ok(s.requests.every(request => request.authorization === `Bearer ${token}`));
    const second = await command(f, s.transport);
    assert.equal(second.code, 0, second.stderr); assert.equal(s.requests.length, 2);
    assert.match(second.stdout, /verified-existing/);
    writeFileSync(join(f.output, 'files/F1-F1.txt'), 'other');
    assert.equal((await command(f, s.transport)).code, 1); assert.equal(s.requests.length, 2);
    noSecrets(f);
});

test('refuses outside hosts and unsafe redirect destinations before sending credentials there', async t => {
    const s = await server(t, (_req, res) => { res.writeHead(302, { Location: `https://other.example/download?token=${token}` }); res.end(); });
    const f = fixture(t);
    const redirected = await command(f, s.transport);
    assert.equal(redirected.code, 1); assert.match(redirected.stderr, /file-host-refused/);
    assert.equal(s.requests.length, 1); assert.equal(existsSync(join(f.output, 'files/F1-F1.txt')), false); noSecrets(f);
    for (const url of ['https://other.example/file', 'https://files.slack.com.other.example/file', 'https://files.slack.com:444/file', 'http://files.slack.com/file', 'https://user:password@files.slack.com/file', 'http://127.0.0.1/file']) {
        const refused = fixture(t, [file('F1', { url_private: url })]);
        assert.equal((await command(refused, s.transport)).code, 1);
    }
    assert.equal(s.requests.length, 1);
});

test('enforces metadata, aggregate and consumed-byte bounds without publishing oversized bodies', async t => {
    const s = await server(t, (req, res) => {
        if (req.url.startsWith('/header')) { res.writeHead(200, { 'Content-Length': SLACK_FILE_LIMIT + 1 }); res.end('x'); }
        else { res.writeHead(200); res.end(Buffer.alloc(SLACK_FILE_LIMIT + 1, 65)); }
    });
    const metadata = fixture(t, [file('F1', { size: SLACK_FILE_LIMIT + 1 })]);
    assert.equal((await command(metadata, s.transport)).code, 1); assert.equal(s.requests.length, 0);
    const aggregate = fixture(t, Array.from({ length: Math.floor(ZIP_LIMITS.total / SLACK_FILE_LIMIT) + 1 }, (_, i) => file('F' + i, { size: SLACK_FILE_LIMIT })));
    assert.equal((await command(aggregate, s.transport)).code, 1); assert.equal(s.requests.length, 0);
    const count = fixture(t, Array.from({ length: ZIP_LIMITS.entries + 1 }, (_, i) => file('F' + i)));
    assert.equal((await command(count, s.transport)).code, 1); assert.equal(s.requests.length, 0);
    for (const url of ['https://files.slack.com/chunks', 'https://files.slack.com/header']) {
        const f = fixture(t, [file('F1', { size: undefined, url_private: url })]);
        assert.equal((await command(f, s.transport)).code, 1);
        assert.equal(existsSync(join(f.output, 'files/F1-F1.txt')), false); noSecrets(f);
    }
});

test('rerun resumes after an interrupted file while retaining verified completed files', async t => {
    let interrupt = true;
    const s = await server(t, (req, res) => {
        if (req.url.startsWith('/F2') && interrupt) {
            res.writeHead(200, { 'Content-Length': 5 }); res.write('he');
            setImmediate(() => res.destroy());
        } else res.end('hello');
    });
    const f = fixture(t, [file('F1'), file('F2')]);
    const first = await command(f, s.transport);
    assert.equal(first.code, 1); assert.equal(readFileSync(join(f.output, 'files/F1-F1.txt'), 'utf8'), 'hello');
    assert.equal(existsSync(join(f.output, 'files/F2-F2.txt')), false);
    interrupt = false;
    const second = await command(f, s.transport);
    assert.equal(second.code, 0, second.stderr);
    assert.equal(s.requests.filter(request => request.url.startsWith('/F1')).length, 1);
    assert.equal(s.requests.filter(request => request.url.startsWith('/F2')).length, 2);
    assert.equal(readFileSync(join(f.output, 'files/F2-F2.txt'), 'utf8'), 'hello');
    noSecrets(f);
});

test('rejects traversal ZIPs, unsafe filenames and symlink destinations without following them', async t => {
    const never = () => assert.fail('unsafe path must not reach network');
    const traversal = fixture(t, [file()], [['../escaped', 'x']]);
    assert.equal((await command(traversal, never)).code, 1);
    for (const name of ['../escape.txt', 'bad/name.txt', 'bad\\name.txt', 'trail.', '\u202e.txt']) {
        assert.equal((await command(fixture(t, [file('F1', { name })]), never)).code, 1);
    }
    const f = fixture(t), outside = join(f.root, 'outside');
    mkdirSync(outside); mkdirSync(f.output); symlinkSync(outside, join(f.output, 'files'));
    assert.equal((await command(f, never)).code, 1); assert.deepEqual(readdirSync(outside), []);
    const inputLink = fixture(t); symlinkSync(inputLink.input, join(inputLink.root, 'link.zip'));
    assert.equal((await command({ ...inputLink, input: join(inputLink.root, 'link.zip') }, never, [])).code, 1);
});

test('safe failures do not persist echoed credentials, URL queries or transport exceptions', async t => {
    const s = await server(t, (_req, res) => res.end(token));
    const echoed = fixture(t, [file('F1', { size: token.length })]);
    const echoResult = await command(echoed, s.transport);
    assert.equal(echoResult.code, 1); assert.match(echoResult.stderr, /credential-in-response/); noSecrets(echoed);
    const thrown = fixture(t);
    assert.equal((await command(thrown, () => { throw Error(`${token} https://files.slack.com/?signature=${querySecret}`); })).code, 1); noSecrets(thrown);
    const mismatch = fixture(t, [file('F1', { size: token.length, sha256: sha256('different') })]);
    assert.equal((await command(mismatch, s.transport)).code, 1); noSecrets(mismatch);
});


test('hard process interruption releases stale custody on rerun and preserves completed files', async t => {
    let announce;
    const waiting = new Promise(resolve => { announce = resolve; });
    let hold = true;
    const s = await server(t, (req, res) => {
        if (req.url.startsWith('/F2') && hold) { announce(); return; }
        res.end('hello');
    });
    const f = fixture(t, [file('F1'), file('F2')]);
    const script = `import { runSlackFiles } from ${JSON.stringify(pathToFileURL(resolve('scripts/slack-files/command.mjs')).href)};
        process.exitCode = await runSlackFiles(process.argv.slice(1), {transport: (url, options) => {
            const parsed = new URL(url); return fetch(process.env.TEST_LOOPBACK_ORIGIN + parsed.pathname + parsed.search, options);
        }});`;
    const child = spawn(process.execPath, ['--input-type=module', '-e', script, f.input, f.output, '--fetch', '--token-env', 'OWNER_SELECTED_SLACK_TOKEN'], {
        env: { PATH: process.env.PATH, OWNER_SELECTED_SLACK_TOKEN: token, TEST_LOOPBACK_ORIGIN: s.origin }, stdio: ['ignore', 'pipe', 'pipe']
    });
    t.after(() => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); });
    let output = '';
    child.stdout.on('data', bytes => { output += bytes; }); child.stderr.on('data', bytes => { output += bytes; });
    const exited = once(child, 'exit');
    let timer;
    await Promise.race([waiting, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('child did not reach interruption point')), 5000); })]).finally(() => clearTimeout(timer));
    child.kill('SIGKILL'); await exited;
    assert.ok(!output.includes(token) && !output.includes(querySecret));
    assert.equal(existsSync(join(f.output, '.slack-files/lock')), true);
    hold = false;
    const resumed = await command(f, s.transport);
    assert.equal(resumed.code, 0, resumed.stderr);
    assert.equal(s.requests.filter(request => request.url.startsWith('/F1')).length, 1);
    assert.equal(s.requests.filter(request => request.url.startsWith('/F2')).length, 2);
    assert.equal(existsSync(join(f.output, '.slack-files/lock')), false);
    noSecrets(f);
});

test('singular file listing includes pin, unpin and file events with shared strict deduplication', async t => {
    const never = () => assert.fail('listing must not reach network');
    const shapes = [
        { type: 'message', subtype: 'pinned_item', item_type: 'F', item: file() },
        { type: 'message', subtype: 'unpinned_item', item_type: 'F', item: file() },
        { type: 'message', subtype: 'file_share', file: file() }
    ];
    for (const row of shapes) {
        const f = fixture(t, [], [['general/2024-01-02.json', [row]]]);
        const result = await command(f, never, []);
        assert.equal(result.code, 0, result.stderr);
        const listed = result.stdout.trim().split('\n').map(JSON.parse).filter(row => row.file);
        assert.deepEqual(listed, [{ file: { id: 'F1', name: 'F1.txt', size: 5, host: 'files.slack.com' } }]);
    }
    const repeated = fixture(t, [file()], [['general/2024-01-02.json', [...shapes, { type: 'file_created', file: { id: 'F1' } }]]]);
    const deduped = await command(repeated, never, []);
    assert.equal(deduped.code, 0, deduped.stderr);
    assert.equal(deduped.stdout.trim().split('\n').map(JSON.parse).filter(row => row.file).length, 1);
    const conflicting = fixture(t, [file()], [['general/2024-01-02.json', [{ type: 'message', subtype: 'pinned_item', item_type: 'F', item: file('F1', { size: 7 }) }]]]);
    assert.match((await command(conflicting, never, [])).stderr, /conflicting-file-reference/);
    const sparse = fixture(t, [], [['general/2024-01-02.json', [{ type: 'file_created', file: { id: 'F1' } }]]]);
    const sparseListing = await command(sparse, never, []);
    assert.equal(sparseListing.code, 0);
    assert.deepEqual(JSON.parse(sparseListing.stdout.split('\n')[0]).file, { id: 'F1', name: null, size: null, host: null });
    assert.equal((await command(sparse, never)).code, 1);
});

test('singular file fetch downloads a sole pinned reference through the admitted network edge', async t => {
    const pinned = { type: 'message', subtype: 'pinned_item', item_type: 'F', item: file() };
    const f = fixture(t, [], [['general/2024-01-02.json', [pinned]]]);
    const s = await server(t, (_req, res) => res.end('hello'));
    const result = await command(f, s.transport);
    assert.equal(result.code, 0, result.stderr);
    assert.equal(readFileSync(join(f.output, 'files/F1-F1.txt'), 'utf8'), 'hello');
    assert.equal(s.requests.length, 1);
    assert.equal(s.requests[0].authorization, `Bearer ${token}`);
    noSecrets(f);
});
