import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,open,rm,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

/** Bounded probes mutate only the isolated actual build and always restore it. */
export async function artifactNegativeProof(root,config,produceArtifact) {
 const limits=await import(pathToFileURL(resolve(root,'scripts/delivery/base/payloads.mjs')).href);
 const candidate=resolve(root,'dist/client/rejected-inputs');
 const rejected=extra=>produceArtifact({...config.artifact,root,output:'rejected-artifact/nook.json',...extra});
 await assert.rejects(rejected({assetsDirectory:'../outside'}),/root-relative/);
 await mkdir(candidate);
 try {
  const privateFile=resolve(candidate,'.dev.vars');
  await writeFile(privateFile,'SYNTHETIC_PRIVATE_SETTING=test-only\n');
  await assert.rejects(rejected(),/Private or reserved/);await rm(privateFile);
  const fifo=resolve(candidate,'nonregular');execFileSync('mkfifo',[fifo]);
  try {await assert.rejects(rejected(),/regular file/)}finally{await rm(fifo)}
  const oversize=resolve(candidate,'oversize');
  const file=await open(oversize,'wx');try{await file.truncate(limits.MAX_ARTIFACT_ENTRY_BYTES+1)}finally{await file.close()}
  try {await assert.rejects(rejected(),/entry exceeds size/)}finally{await rm(oversize)}
  // Sparse files hit aggregate bounds before any payload allocation or read.
  const aggregate=[];let remaining=limits.MAX_ARTIFACT_PAYLOAD_BYTES+1;
  while(remaining>0) {
   const path=resolve(candidate,`aggregate-${aggregate.length}`),size=Math.min(remaining,limits.MAX_ARTIFACT_ENTRY_BYTES);
   const handle=await open(path,'wx');try{await handle.truncate(size)}finally{await handle.close()}
   aggregate.push(path);remaining-=size;
  }
  try {await assert.rejects(rejected(),/payload exceeds size/)}finally{for(const path of aggregate)await rm(path)}
  for(let index=0;index<=limits.MAX_ARTIFACT_ENTRIES;index++)await writeFile(resolve(candidate,`entry-${index}`),'');
  await assert.rejects(rejected(),/too many entries/);
 }finally{await rm(candidate,{recursive:true,force:true})}
 console.log('PASS real producer refuses traversal, private settings, special files, per-entry/aggregate byte overflow and excessive input inventory');
}
