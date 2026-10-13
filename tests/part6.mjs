import {parseArgs} from 'node:util';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {mkdtemp,symlink,rm,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {run} from './part6/native.mjs';
import {claimProof} from './part6/claim.mjs';
import {artifactProof} from './part6/artifact.mjs';
import {editorProof} from './part6/editor.mjs';
import {sourceProof} from './part6/source.mjs';

const {values}=parseArgs({options:{'platform-root':{type:'string'},evidence:{type:'string'}}});
if(!values['platform-root'])throw Error('Pass --platform-root with the read-only reviewed platform source for its actual visual source compiler.');
const source=process.cwd(),root=await mkdtemp(resolve(tmpdir(),'nook-part6-source-'));
const revision=execFileSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).trim();
try {
 execFileSync('git',['clone','--quiet','--shared','--no-checkout',source,root]);
 execFileSync('git',['checkout','--quiet','--detach',revision],{cwd:root});
 await sourceProof(root,resolve(values['platform-root']),revision);
 await symlink(await realpath(resolve(source,'node_modules')),resolve(root,'node_modules'),'dir');
 console.log(`Part 6 exact source ${revision}; temporary source edits and all runtime resources are owned by this command.`);
 const built=await run(root,['scripts/delivery/build-local.mjs']);
 const receipt=built.split('\n').map(line=>{try{return JSON.parse(line)}catch{return null}}).find(value=>value?.scope==='local-source-and-bytes-only');
 assert.equal(receipt?.sourceRevision,revision);assert.equal(receipt.managedQualified,false);
 await artifactProof(root,resolve(values['platform-root']));
 await claimProof(root);
 await editorProof(root,resolve(values['platform-root']),values.evidence&&resolve(values.evidence));
 console.log('PASS Part 6 local artifact/claim/editor. Managed workflow qualification, hosted delivery and service admission remain separate.');
}finally{await rm(root,{recursive:true,force:true})}
