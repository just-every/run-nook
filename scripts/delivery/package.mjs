import {parseArgs} from 'node:util';
import {producePackage} from './base/package.mjs';
import {managedPolicy} from './config.mjs';
const {values}=parseArgs({options:{output:{type:'string'}}});
console.log(await producePackage({config:await managedPolicy(),output:values.output}));
