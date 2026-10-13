import assert from 'node:assert/strict';
import {readFile,readdir,lstat,symlink,unlink,writeFile} from 'node:fs/promises';
import {resolve,relative,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {artifactNegativeProof} from './artifact-negative.mjs';
import {setupProjectionProof} from './setup-projection.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function files(root,path='') {
 const result=[];
 for(const entry of await readdir(resolve(root,path),{withFileTypes:true})) {
  const item=path?path+'/'+entry.name:entry.name;
  assert.equal(entry.isSymbolicLink(),false,'no emitted symlink');
  if(entry.isDirectory())result.push(...await files(root,item));else {assert.ok(entry.isFile(),'regular payload');result.push(item)}
 }
 return result.sort();
}
export async function artifactProof(root,platformRoot) {
 const load=path=>import(pathToFileURL(resolve(root,path)).href);
 const {produceArtifact}=await load('scripts/delivery/base/artifact.mjs');
 const {loadSetupManifest}=await load('scripts/delivery/base/setup-manifest.mjs');
 const config=JSON.parse(await readFile(resolve(root,'scripts/delivery/base/packaging.json'),'utf8'));
 const setup=await loadSetupManifest(root,config.setup);
 assert.deepEqual(setup.bytes,await readFile(resolve(root,'rer-setup.json')));
 const descriptor=JSON.parse(await readFile(resolve(root,'rer-project.json'),'utf8'));
 assert.equal(descriptor.setup.sha256,hash(setup.bytes));
 const manifest=await produceArtifact({...config.artifact,root,output:'local-byte-proof/nook-worker-artifact.json'});
 const artifact=JSON.parse(await readFile(manifest,'utf8'));
 assert.equal(artifact.schema,2,'native raw-payload schema');
 await setupProjectionProof(platformRoot,setup,artifact.deploymentSpec);
 const entries=[...artifact.modules,...artifact.assets];
 assert.ok(artifact.modules.some(item=>item.name===artifact.mainModule));
 assert.ok(artifact.assets.length>0&&artifact.modules.length>0,'real compiled app closure');
 for(const entry of entries) {
  const bytes=await readFile(resolve(dirname(manifest),entry.payload));
  assert.equal(bytes.length,entry.size);assert.equal(hash(bytes),entry.sha256);
  assert.equal('contentBase64' in entry,false);
  assert.equal((await lstat(resolve(dirname(manifest),entry.payload))).isFile(),true);
 }
 assert.deepEqual(await files(dirname(manifest)),[relative(dirname(manifest),manifest),...entries.map(entry=>entry.payload)].sort(),'all emitted bytes declared');
 const sqlFiles=(await readdir(resolve(root,'migrations'))).filter(name=>name.endsWith('.sql')).sort();
 assert.deepEqual(artifact.deploymentSpec.migrations.map(item=>item.name),sqlFiles);
 for(const migration of artifact.deploymentSpec.migrations) {
  const bytes=await readFile(resolve(root,'migrations',migration.name));
  assert.equal(migration.sql,bytes.toString('utf8'));assert.equal(migration.sha256,hash(bytes));
 }
 const native=JSON.parse(await readFile(resolve(root,'dist/server/wrangler.json'),'utf8'));
 assert.deepEqual(artifact.deploymentSpec.resources.filter(r=>r.kind==='d1').map(r=>r.binding),(native.d1_databases??[]).map(r=>r.binding));
 assert.deepEqual(artifact.deploymentSpec.resources.filter(r=>r.kind==='r2').map(r=>r.binding),(native.r2_buckets??[]).map(r=>r.binding));
 assert.deepEqual(artifact.deploymentSpec.durableObjects.map(r=>r.binding),(native.durable_objects?.bindings??[]).map(r=>r.name));
 // One-off negative probes against the real built inputs, always restored.
 const link=resolve(root,'dist/client/rejected-link');
 await symlink(resolve(root,'rer-setup.json'),link);
 try {await assert.rejects(produceArtifact({...config.artifact,root,output:'rejected-artifact/nook.json'}),/symlink/i)}finally{await unlink(link)}
 const setupPath=resolve(root,'rer-setup.json'),bytes=await readFile(setupPath);
 try {await writeFile(setupPath,bytes.toString().trim());await assert.rejects(loadSetupManifest(root,config.setup),/canonical/)}finally{await writeFile(setupPath,bytes)}
 await artifactNegativeProof(root,config,produceArtifact);
 console.log(`PASS local schema-2 artifact: ${artifact.modules.length} modules, ${artifact.assets.length} assets, ${sqlFiles.length} exact migrations, complete emitted inventory; managed workflow pinned separately`);
 return artifact;
}
