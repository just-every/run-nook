import {parseArgs} from 'node:util';
import {produceArtifact} from './base/artifact.mjs';
import {checkEdition} from './base/package.mjs';
import {loadSetupManifest} from './base/setup-manifest.mjs';
import {packagingPolicy} from './config.mjs';

// Explicit local byte qualification only. This never emits or qualifies a workflow.
const {values}=parseArgs({options:{output:{type:'string',default:'delivery-artifact/nook-worker-artifact.json'}}});
const config=await packagingPolicy(),root=process.cwd();
await checkEdition(root,config.edition);
await loadSetupManifest(root,config.setup);
console.log(await produceArtifact({...config.artifact,root,output:values.output}));
