import {installDependencies} from '../install-dependencies.mjs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,mkdtemp,rm,access} from 'node:fs/promises';
import {execFileSync,spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {platformSource} from './ts-source.mjs';
import {embeddingAuthority} from './management-authority.mjs';

export async function sourceProof(root,platformRoot,revision) {
 await assert.rejects(access(resolve(root,'node_modules')),{code:'ENOENT'});
 await installDependencies(root);
 const operations=JSON.parse(await readFile(resolve(root,'OPERATIONS.json'),'utf8'));
 const env={PATH:process.env.PATH,...Object.fromEntries(operations.requiredEnvironment.map(name=>[name,'synthetic-local-input']))};
 // First-party projects check through their rer command; operations.mjs hands over to it.
 const checked=JSON.parse(execFileSync(process.execPath,['node_modules/@runeditrun/rer/bin/rer.mjs','check','--json'],{cwd:root,env,encoding:'utf8'}).trim().split('\n').at(-1));
 assert.equal(checked.event,'result');assert.equal(checked.ok,true);
 console.log('PASS fresh Nook locked dependency install and operations check with named synthetic local inputs; no provider verification');
 const platform=await mkdtemp(resolve(tmpdir(),'nook-part6-platform-'));
 const platformRevision=execFileSync('git',['rev-parse','HEAD'],{cwd:platformRoot,encoding:'utf8'}).trim();
 let loader;
 try {
  await new Promise((ok,bad)=>{
   const archive=spawn('git',['archive',platformRevision],{cwd:platformRoot,stdio:['ignore','pipe','pipe']}),tar=spawn('tar',['-x','-C',platform],{stdio:['pipe','ignore','pipe']});archive.stdout.pipe(tar.stdin);archive.stderr.resume();tar.stderr.resume();let count=0,failed=false;
   for(const child of [archive,tar]){child.on('error',bad);child.on('exit',code=>{failed ||= code!==0;if(++count===2)failed?bad(Error('Platform source extraction failed')):ok()})}
  });
  await assert.rejects(access(resolve(platform,'node_modules')),{code:'ENOENT'});
  const integrations=JSON.parse(execFileSync(process.execPath,['scripts/projects/integrations.mjs','check'],{cwd:platform,encoding:'utf8'}));
  assert.ok(Array.isArray(integrations)&&integrations.length);
  loader=platformSource(platform);
  const {parseProjectSourceDescriptor,parseProjectRegistration}=await loader.load('src/projects/descriptor.ts');
  const descriptor=JSON.parse(await readFile(resolve(root,'rer-project.json'),'utf8'));
  const parsed=parseProjectSourceDescriptor(descriptor,revision);
  assert.equal(parsed.projectId,descriptor.projectId);assert.deepEqual(parsed.setup,descriptor.setup);
  assert.deepEqual(parseProjectRegistration(descriptor,revision),parsed,'actual Nook registration boundary accepts the selected source descriptor');
  const {parseSetupManifestBytes}=await loader.load('src/editions/setup-manifest.ts');
  const setupBytes=await readFile(resolve(root,descriptor.setup.path));
  assert.equal(createHash('sha256').update(setupBytes).digest('hex'),descriptor.setup.sha256);
  parseSetupManifestBytes(setupBytes.toString('utf8'));
  const state={allowed:'http://127.0.0.1:16877',deny:false},authority=await embeddingAuthority(loader,state);
  try {
   const request=new Request('http://127.0.0.1:16878/editor?installation=nook-local&parentOrigin=https://unregistered.test');
   const document=()=>new Response('local network edge',{headers:{'Content-Type':'text/html','Content-Security-Policy':"object-src 'none'; base-uri 'none'"}});
   const allowed=await authority.response(request,document());
   assert.equal(allowed.headers.get('Content-Security-Policy'),`object-src 'none'; base-uri 'none'; frame-ancestors ${state.allowed}`);
   state.deny=true;
   const denied=await authority.response(request,document());
   assert.match(denied.headers.get('Content-Security-Policy'),/frame-ancestors 'none'/);
   assert.equal(denied.headers.get('X-Frame-Options'),'DENY');
  }finally{authority.close()}
  console.log('PASS actual platform SQL embedding authority permits only registered current receipt origin and refuses failed authority; query input grants nothing.');
  console.log(`PASS actual platform ${platformRevision} retained inventory (${integrations.length} integrations), separately parsed Nook descriptor/setup identity. Neither is Nook admission.`);
 }finally{loader?.close();await rm(platform,{recursive:true,force:true})}
}
