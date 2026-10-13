import {parseArgs} from 'node:util';
import {produceSeedArtifact} from './delivery/base/package.mjs';
import {managedPolicy} from './delivery/config.mjs';
const {values}=parseArgs({options:{output:{type:'string'}}});
console.log(await produceSeedArtifact({config:await managedPolicy(),output:values.output}));
