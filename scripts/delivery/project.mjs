import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {generateProjectDescriptor} from './base/generators/project.mjs';
import {loadSetupManifest} from './base/setup-manifest.mjs';
import {packagingSource} from './config.mjs';

export async function projectDescriptor(root=process.cwd()) {
 const config=await packagingSource();
 const setup=await loadSetupManifest(root,config.setup);
 return {...generateProjectDescriptor(config.project),setup:{path:setup.path,sha256:setup.sha256}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
 await writeFile('rer-project.json',JSON.stringify(await projectDescriptor(),null,2)+'\n');
 console.log('Generated source descriptor and exact selected setup digest; no admission or deployment.');
}
