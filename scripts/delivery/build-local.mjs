import {spawn,execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {parseArgs} from 'node:util';
import {produceArtifact} from './base/artifact.mjs';
import {checkEdition} from './base/package.mjs';
import {loadSetupManifest} from './base/setup-manifest.mjs';
import {packagingPolicy} from './config.mjs';

const {values}=parseArgs({options:{output:{type:'string',default:'delivery-artifact/nook-worker-artifact.json'}}});
const root=process.cwd(),git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
if(git('status','--porcelain','--untracked-files=all'))throw Error('Commit source changes before binding a local artifact to an exact source revision.');
const revision=git('rev-parse','HEAD'),tree=git('rev-parse','HEAD^{tree}');
await new Promise((ok,bad)=>{
 const child=spawn(process.execPath,['node_modules/@runeditrun/rer/bin/rer.mjs','build','--non-interactive'],{cwd:root,stdio:'inherit'});
 child.once('error',bad);child.once('exit',code=>code===0?ok():bad(Error('Nook build failed; no artifact produced.')));
});
if(git('rev-parse','HEAD')!==revision||git('status','--porcelain','--untracked-files=all'))throw Error('Source changed during build.');
const config=await packagingPolicy();await checkEdition(root,config.edition);const setup=await loadSetupManifest(root,config.setup);
const artifact=await produceArtifact({...config.artifact,root,output:values.output});
console.log(JSON.stringify({scope:'local-source-and-bytes-only',sourceRevision:revision,sourceTree:tree,setupSha256:setup.sha256,artifact,artifactSha256:createHash('sha256').update(await readFile(artifact)).digest('hex'),managedQualified:false}));
