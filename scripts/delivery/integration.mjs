import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {parseArgs} from 'node:util';
import {deploymentSpec} from './base/spec.mjs';
import {packagingPolicy} from './config.mjs';
import {projectDescriptor} from './project.mjs';
import {generateManagedWorkflow} from './base/generators/managed.mjs';
import {localSetupManifest} from '../installer/setup-manifest.mjs';

const {values} = parseArgs({options:{check:{type:'boolean',default:false}}});
const root = process.cwd();
const policy = await packagingPolicy();
const manifest = JSON.parse(await readFile(resolve(root,'rer-setup.json'),'utf8'));

const outputs = {
 'management/integration/deployment-spec.json': await deploymentSpec(root,policy.artifact.specInputs),
 'scripts/installer/local-setup.json': localSetupManifest(manifest),
 'rer-project.json': await projectDescriptor(root),
 '.github/workflows/rer-managed.yml': generateManagedWorkflow(policy.managed),
};
for (const [path,value] of Object.entries(outputs)) {
 const bytes = typeof value === 'string' ? value : JSON.stringify(value,null,2)+'\n';
 const file = resolve(root,path);
 if (values.check) {
  if (await readFile(file,'utf8') !== bytes) throw Error(`${path} differs from the build/setup source. Run pnpm integration:generate after rer build.`);
 } else {
  await mkdir(dirname(file),{recursive:true});
  await writeFile(file,bytes);
 }
}
console.log(`Managed integration ${values.check?'matches':'generated from'} Base's build spec and setup source.`);
