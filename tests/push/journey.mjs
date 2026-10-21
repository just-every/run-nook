import {quietPush} from './quiet.mjs';
import {broadcasts} from './broadcast.mjs';
import assert from 'node:assert/strict';
import {world} from './world.mjs';
import {routing} from './routing.mjs';
import {presence,presenceClock} from './presence.mjs';
import {failures} from './failures.mjs';
import {erasure} from './erasure.mjs';
import {setupFailure} from './setup-failure.mjs';
import {archive,erasedArchive} from './archive.mjs';
import {retention,retentionClock} from './retention.mjs';

// The ordered record chain: each stage builds on the rows the one before left.
export async function contractJourney(t){
 const {app,context,edgeError}=await world(t);
 try{
  const stage=async run=>{const started=Date.now();await run(context);t.diagnostic(`${run.name}: ${((Date.now()-started)/1000).toFixed(1)} s`)};
  await stage(quietPush);
  await stage(routing);
  await stage(broadcasts);
  await stage(presence);
  await stage(failures);
  await stage(setupFailure);
  await stage(erasure);
  await stage(retention);
  await stage(archive);
  await stage(retentionClock);
  await stage(erasedArchive);
  if(edgeError())throw edgeError();
  assert.equal((await app.db.prepare("SELECT count(*) AS n FROM nook_notify_queue WHERE channel='email'").first()).n,0,'push choices never opt into email');
 }finally{await app.close()}
}

// The two stretches that wait out a real Durable Object clock (the 45-second
// heartbeat expiry and the five-minute mobile delay) need nothing from the chain,
// so they run alone on their own installation, in their own CI job.
export async function clockJourney(t){
 const {app,context,edgeError}=await world(t);
 try{
  const started=Date.now();await presenceClock(context);t.diagnostic(`presenceClock: ${((Date.now()-started)/1000).toFixed(1)} s`);
  if(edgeError())throw edgeError();
  assert.equal((await app.db.prepare("SELECT count(*) AS n FROM nook_notify_queue WHERE channel='email'").first()).n,0,'push choices never opt into email');
 }finally{await app.close()}
}
