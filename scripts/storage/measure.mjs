// Local storage measurement: 50 people, 24 conversations, a TEST-ONLY bulk
// corpus seeded into local D1 while the Worker is stopped, then ordinary HTTP
// sends from 20 concurrent senders with 50 live subscribers. Resumable: a seed
// that runs out of its time budget exits 2; run the same command again.
import {execFileSync} from 'node:child_process';
import {mkdir, readFile, readdir, stat, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
import {signIn, invite} from '../../tests/auth-support.mjs';
import {measurementBindings, measurementRuntime} from './measurement-runtime.mjs';
import {subscribe} from './websocket.mjs';
import {observer} from './replay-observer.mjs';

const args = process.argv.slice(2), arg = (key, fallback) => args.find(s => s.startsWith(key + '='))?.slice(key.length + 1) ?? fallback;
const state = resolve(arg('--state', 'evidence/nook-1/scale-state')), evidence = resolve(arg('--evidence', 'evidence/nook-1/scale'));
const total = Number(arg('--messages', '1000000')), budget = Number(arg('--seconds', '900')), origin = 'http://127.0.0.1:' + arg('--port', '15832');
if (total !== 1000000 && !args.includes('--smoke')) throw Error('Use --messages=1000000, or --smoke for a smaller labelled run.');
const started = Date.now();
await mkdir(state, {recursive:true, mode:0o700});
await mkdir(evidence, {recursive:true});
const checkpoint = resolve(state, 'measurement.json');
let saved; try { saved = JSON.parse(await readFile(checkpoint, 'utf8')); } catch { saved = {phase:'setup'}; }
const save = () => writeFile(checkpoint, JSON.stringify(saved), {mode:0o600});
const runtime = measurementRuntime({state, origin});
const samples = {}, errors = [];
let bytes = 0, db, subscriptions = [];
const summary = values => { const a = [...values].sort((x, y) => x - y), at = p => a[Math.min(a.length - 1, Math.floor(a.length * p))] ?? null; return {count:a.length, p50:at(.5), p95:at(.95), p99:at(.99), max:a.at(-1) ?? null}; };

async function call(name, path, user, body, method = body ? 'POST' : 'GET') {
 const begin = performance.now();
 try {
  const response = await fetch(origin + path, {method, signal:AbortSignal.timeout(30000), headers:{Origin:origin, ...(user ? {Cookie:user.cookie} : {}), ...(body ? {'Content-Type':'application/json'} : {})}, body:body ? JSON.stringify(body) : undefined});
  const raw = await response.text(); bytes += Buffer.byteLength(raw);
  if (!response.ok) throw Error(`${name}: HTTP ${response.status} ${raw.slice(0, 500)}`);
  (samples[name] ??= []).push(performance.now() - begin);
  return JSON.parse(raw);
 } catch (error) { errors.push({name, message:String(error.message).slice(0, 500)}); throw error; }
}

async function dbPath() {
 let found;
 async function walk(path) { for (const entry of await readdir(path, {withFileTypes:true})) { const child = resolve(path, entry.name); if (entry.isDirectory()) await walk(child); else if (child.endsWith('.sqlite')) { const probe = new DatabaseSync(child, {readOnly:true}); try { if (probe.prepare("SELECT 1 FROM sqlite_master WHERE name='nook_messages'").get()) found = child; } finally { probe.close(); } } } }
 await walk(state); assert.ok(found, 'local D1 database'); return found;
}

async function setup() {
 await runtime.migrate(); await runtime.start();
 const r = await fetch(origin + '/auth/bootstrap', {method:'POST', redirect:'manual', headers:{Origin:origin, 'Content-Type':'application/json'}, body:JSON.stringify({token:measurementBindings(origin).SETUP_TOKEN, displayName:'Scale owner', returnTo:'/app'})});
 assert.ok([303, 409].includes(r.status), 'new or previously completed fixture bootstrap');
 const owner = await signIn(origin, 'scale-owner@example.test');
 saved.users = [owner];
 const directory = await call('setup', '/api/users', owner);
 for (let i = 1; i < 50; i++) { const email = 'scale-' + i + '@example.test'; saved.users[i] = directory.some(u => u.name === 'Scale ' + i) ? await signIn(origin, email) : await invite(origin, owner.cookie, 'Scale ' + i, email); }
 const existing = await call('setup', '/api/conversations', owner);
 saved.channels = [];
 for (let i = 0; i < 24; i++) {
  const name = 'Scale ' + i, kind = i % 3 === 0 ? 'private' : 'channel';
  saved.channels[i] = existing.find(c => c.name === name && c.kind === kind) ?? await call('setup', '/api/conversations', owner, {name, kind, participants:saved.users.slice(1, kind === 'private' ? 26 : 50).map(u => u.user.id)});
 }
 saved.phase = 'seed'; await save(); await runtime.stop();
}

// TEST-ONLY: bulk rows written directly while the Worker is stopped, with the
// same events, revisions, search rows and counters the product writes.
async function seed() {
 db = new DatabaseSync(await dbPath());
 let count = db.prepare("SELECT count(*) AS n FROM nook_messages WHERE id LIKE 'scale-corpus-%'").get().n;
 const insert = db.prepare('INSERT INTO nook_messages VALUES(?,?,?,?,?,?,1,0,?,?,?,?,?,?)'), event = db.prepare("INSERT INTO nook_events VALUES(?,?,'message',?,?)"), revision = db.prepare('INSERT INTO nook_revisions VALUES(?,1,?,?)');
 const fts = db.prepare("INSERT INTO nook_search(rowid,message,conversation,source,scope,body_lower) SELECT rowid*2,id,conversation,'native','|'||conversation||'|',body_lower FROM nook_messages WHERE id=?");
 const roots = new Map(saved.channels.map(c => [c.id, db.prepare('SELECT id FROM nook_messages WHERE conversation=? AND parent IS NULL ORDER BY sequence LIMIT 1').get(c.id)?.id]));
 const counts = new Map(saved.channels.map(c => [c.id, db.prepare('SELECT message_count FROM nook_conversations WHERE id=?').get(c.id).message_count]));
 const authors = new Map(db.prepare('SELECT * FROM nook_author_counts').all().map(r => [r.conversation + ':' + r.user, r.total]));
 while (count < total && Date.now() - started < budget * 1000) {
  db.exec('BEGIN IMMEDIATE');
  for (let n = 0; n < 1000 && count < total; n++, count++) {
   const channel = saved.channels[count % 5 === 0 ? 0 : 1 + count % 23], uid = saved.users[count % (channel.kind === 'private' ? 25 : 50)].user.id;
   const id = 'scale-corpus-' + String(count).padStart(9, '0'), sequence = (counts.get(channel.id) ?? 0) + 1, authorKey = channel.id + ':' + uid, own = (authors.get(authorKey) ?? 0) + 1;
   const created = new Date(Date.UTC(2020, 0, 1) + count * 1000).toISOString();
   const body = `Release ${count % 301} discussion: component ${count % 991} deployment and team follow-up. ${count % 179 === 0 ? 'RareOrchid protocol checkpoint' : 'Review testing notes and customer feedback'}; record ${count}.`;
   const parent = count % 8 === 0 ? (roots.get(channel.id) ?? null) : null;
   const payload = JSON.stringify({body, parent, attachments:[], mentions:[], urgent:false, urgentReason:null});
   counts.set(channel.id, sequence); authors.set(authorKey, own);
   insert.run(id, channel.id, uid, body, body.toLowerCase(), parent, created, 'corpus-' + count, payload, sequence, sequence, own);
   if (!roots.get(channel.id)) roots.set(channel.id, id);
   revision.run(id, body, created); event.run(channel.id, sequence, id, uid); fts.run(id);
  }
  for (const [id, n] of counts) db.prepare('UPDATE nook_conversations SET seq=?,message_count=? WHERE id=?').run(n, n, id);
  for (const [key, n] of authors) { const split = key.lastIndexOf(':'); db.prepare('INSERT INTO nook_author_counts VALUES(?,?,?) ON CONFLICT(conversation,user) DO UPDATE SET total=excluded.total').run(key.slice(0, split), key.slice(split + 1), n); }
  db.exec('COMMIT'); saved.seeded = count; await save();
 }
 db.close(); db = null;
 if (count < total) { console.log(JSON.stringify({paused:true, phase:'seed', seeded:count, total, resume:'repeat the same command'})); process.exitCode = 2; return false; }
 saved.phase = 'measure'; await save(); return true;
}

async function measure() {
 saved.measurementAttempts = (saved.measurementAttempts ?? 0) + 1; await save();
 db = new DatabaseSync(await dbPath(), {readOnly:true});
 const deepSamples = [0, Math.floor(total / 2), total - 1].map(n => {
  const m = db.prepare('SELECT * FROM nook_messages WHERE id=?').get('scale-corpus-' + String(n).padStart(9, '0'));
  const prior = db.prepare('SELECT created,id FROM nook_messages WHERE conversation=? AND sequence<? ORDER BY sequence DESC LIMIT 1').get(m.conversation, m.sequence);
  return {id:m.id, author:m.author, version:m.version, deleted:m.deleted, body:m.body, conversation:m.conversation, after:prior ? prior.created + prior.id : ''};
 });
 const mutationSamples = [deepSamples[0], db.prepare("SELECT id,author,version,deleted FROM nook_messages WHERE id>=? AND id GLOB 'scale-corpus-*' AND deleted=0 ORDER BY id LIMIT 1").get('scale-corpus-' + String(Math.floor(total / 2)).padStart(9, '0'))];
 assert.ok(mutationSamples[1], 'an old corpus message remains for deletion');
 db.close(); db = null;
 await runtime.start();
 const owner = await signIn(origin, 'scale-owner@example.test'); saved.users[0] = owner;
 for (let i = 1; i < 50; i++) saved.users[i] = await signIn(origin, 'scale-' + i + '@example.test');
 await save();
 for (const sample of deepSamples) { const page = await call('deep-history', '/api/conversations/' + sample.conversation + '/messages?limit=1&after=' + encodeURIComponent(sample.after), owner); assert.equal(page[0].id, sample.id); assert.equal(page[0].body, sample.body); }

 const seen = new Map(), fanout = [], deliveries = [];
 const listen = user => h => {
  if (!h.conversation) return;
  deliveries.push({user:user.user.id, conversation:h.conversation, frontier:h.frontier, at:performance.now()});
  seen.set(h.conversation, Math.max(seen.get(h.conversation) ?? 0, h.frontier));
  for (const pending of fanout) if (!pending.received && pending.conversation === h.conversation && h.frontier >= pending.sequence) pending.received = performance.now();
 };
 for (const user of saved.users) subscriptions.push(await subscribe(origin, user.cookie, listen(user)));
 const replay = await observer({call, owner, channels:saved.channels}), begin = performance.now(), run = Date.now();
 const sends = [], oldChanges = []; let sendersDone = false, sendersFinishedAt = begin, reconnects = 0;
 const observing = (async () => {
  for (const [sample, deleting] of [[mutationSamples[0], false], [mutationSamples[1], true]]) {
   if (sample.deleted) continue;
   const user = saved.users.find(u => u.user.id === sample.author);
   const changed = await call(deleting ? 'old-corpus-delete' : 'old-corpus-edit', '/api/messages/' + sample.id, user, {version:sample.version, ...(deleting ? {delete:true} : {body:'Old corpus revised during live senders ' + run})}, 'PATCH');
   oldChanges.push({id:sample.id, version:changed.version, deleted:changed.deleted});
  }
  do { await replay.drain(); if (!sendersDone) await new Promise(ok => setTimeout(ok, 100)); } while (!sendersDone);
  await replay.drain();
 })();
 const senders = Promise.all(Array.from({length:20}, async (_, sender) => {
  for (let n = 0; n < 10; n++) {
   const channel = saved.channels[n % 2 ? 1 + sender % 23 : 0], intent = `measure-${run}-${sender}-${n}`, at = performance.now();
   const m = await call(n % 2 ? 'distributed-send' : 'hot-send', '/api/conversations/' + channel.id + '/messages', saved.users[sender], {intent, body:`Measured public door sender ${sender} iteration ${n} OrchidSignal`, mentions:[]});
   sends.push({intent, id:m.id, conversation:m.conversation, sequence:m.sequence, author:m.author});
   if (n === 5) {
    await call('concurrent-replay', '/api/conversations/' + channel.id + '/replay?after=' + Math.max(0, m.sequence - 2), saved.users[sender]);
    if (sender === 0) { reconnects++; await subscriptions[0].close(); subscriptions[0] = await subscribe(origin, owner.cookie, listen(owner)); }
   }
   fanout.push({conversation:m.conversation, sequence:m.sequence, start:at, received:seen.get(m.conversation) >= m.sequence ? performance.now() : null});
   if (n === 3) {
    await call('edit', '/api/messages/' + m.id, saved.users[sender], {version:m.version, body:'Edited while senders are active'}, 'PATCH');
    await call('delete', '/api/messages/' + m.id, saved.users[sender], {version:m.version + 1, delete:true}, 'PATCH');
   }
  }
 })).finally(() => { sendersFinishedAt = performance.now(); sendersDone = true; });
 await Promise.all([observing, senders]);
 const sendMs = sendersFinishedAt - begin;
 for (const q of ['discussion', 'RareOrchid', 'ImpossibleZebraDoesNotExist', 'ployment']) await call('search-' + q, '/api/search?q=' + q, owner);
 assert.equal((await fetch(origin + '/api/search?q=de', {headers:{Cookie:owner.cookie}})).status, 400);
 for (const channel of saved.channels.slice(0, 3)) await call('history', '/api/conversations/' + channel.id + '/messages/window?limit=100', owner);
 reconnects++; await subscriptions[0].close(); subscriptions[0] = await subscribe(origin, owner.cookie, () => {});
 await replay.drain(); await new Promise(ok => setTimeout(ok, 1000));
 await Promise.all(subscriptions.map(s => s.close())); subscriptions = [];
 await runtime.stop();

 db = new DatabaseSync(await dbPath(), {readOnly:true});
 const count = db.prepare('SELECT count(*) AS n FROM nook_messages').get().n, corpusCount = db.prepare("SELECT count(*) AS n FROM nook_messages WHERE id GLOB 'scale-corpus-*'").get().n;
 const activeUsers = db.prepare("SELECT count(*) AS n FROM oa_operators WHERE status='active'").get().n;
 const duplicates = sends.length - new Set(sends.map(s => s.id)).size, missing = sends.filter(s => !db.prepare('SELECT id FROM nook_messages WHERE id=? AND intent=?').get(s.id, s.intent)).length;
 const gaps = db.prepare('SELECT c.id FROM nook_conversations c WHERE c.seq<>(SELECT count(*) FROM nook_events e WHERE e.conversation=c.id)').all();
 assert.equal(corpusCount, total); assert.equal(activeUsers, 50); assert.equal(duplicates, 0); assert.equal(missing, 0); assert.equal(gaps.length, 0);
 const probes = [0, Math.floor(total / 2), total - 1].map(n => db.prepare('SELECT id,body,sequence FROM nook_messages WHERE id=?').get('scale-corpus-' + String(n).padStart(9, '0')));
 assert.ok(probes.every(Boolean));
 const replayProof = replay.verify(db);
 for (const change of oldChanges) { const stored = db.prepare('SELECT version,deleted FROM nook_messages WHERE id=?').get(change.id); assert.equal(stored.version, change.version); assert.equal(stored.deleted, change.deleted); }
 const plans = {
  history:db.prepare('EXPLAIN QUERY PLAN SELECT id FROM nook_messages WHERE conversation=? AND sequence>? ORDER BY sequence LIMIT 100').all(saved.channels[0].id, 50000),
  search:db.prepare('EXPLAIN QUERY PLAN SELECT rowid FROM nook_search WHERE nook_search MATCH ? AND rowid>? ORDER BY rowid LIMIT 101').all('body_lower:"ployment" AND source:"native" AND (' + saved.channels.map(c => 'scope:"|' + c.id + '|"').join(' OR ') + ')', 0),
  replay:db.prepare('EXPLAIN QUERY PLAN SELECT seq,kind,object FROM nook_events WHERE conversation=? AND seq>? ORDER BY seq LIMIT 100').all(saved.channels[0].id, 50000),
 };
 db.close(); db = null;
 const fanoutSamples = []; let missingSubscriberHints = 0;
 for (const sent of fanout) {
  const channel = saved.channels.find(c => c.id === sent.conversation), audience = saved.users.slice(0, channel.kind === 'private' ? 26 : 50);
  for (const user of audience) { const delivered = deliveries.find(d => d.user === user.user.id && d.conversation === sent.conversation && d.frontier >= sent.sequence && d.at >= sent.start); if (delivered) fanoutSamples.push(delivered.at - sent.start); else missingSubscriberHints++; }
 }
 const report = {complete:true, smoke:total !== 1000000,
  dataset:{requested:total, actualMessages:count, actualCorpusMessages:corpusCount, activeUsers, subscribers:50, concurrentSenders:20, testOnlyBulkSeed:true, measurementAttempts:saved.measurementAttempts, completedAttemptSends:sends.length, priorAttemptMessages:count - total - sends.length, samples:probes},
  timings:Object.fromEntries(Object.entries(samples).map(([k, v]) => [k, summary(v)])), sendThroughputPerSecond:sends.length / (sendMs / 1000),
  fanout:summary(fanoutSamples), missingFanout:missingSubscriberHints, errors, duplicates, missing, gaps, authoritativeReplay:replayProof, oldCorpusChanges:oldChanges, reconnects, bytes, plans,
  databaseBytes:(await stat(await dbPath())).size, resources:{runnerRss:process.memoryUsage().rss, load:execFileSync('sysctl', ['-n', 'vm.loadavg'], {encoding:'utf8'}).trim()},
  capacityAcceptance:'Measurement only; no capacity or latency threshold is claimed'};
 await writeFile(resolve(evidence, 'measurement.json'), JSON.stringify(report, null, 2) + '\n');
 saved.phase = 'complete'; await save();
 console.log(JSON.stringify(report));
}

try {
 if (saved.phase === 'setup') await setup();
 if (saved.phase === 'seed' && !await seed()) process.exit(2);
 if (saved.phase === 'measure') await measure();
} catch (error) {
 await writeFile(resolve(evidence, 'incomplete.json'), JSON.stringify({complete:false, phase:saved.phase, error:String(error.stack ?? error).slice(0, 4000), errors, timings:Object.fromEntries(Object.entries(samples).map(([k, v]) => [k, summary(v)])), workerLog:runtime.log().slice(-6000)}, null, 2) + '\n');
 throw error;
} finally {
 db?.close();
 await Promise.all(subscriptions.map(s => s.close()));
 await runtime.stop();
}
