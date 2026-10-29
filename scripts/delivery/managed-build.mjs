import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

// Managed assigns the sender as public installation configuration. The owner's
// independent deploy supplies it as a secret. Keep that placeholder out of the
// owner's source Wrangler vars while describing Managed's actual binding shape.
export async function managedBuild(config,root=process.cwd()){
 const source=JSON.parse(await readFile(resolve(root,'dist/server/wrangler.json'),'utf8'));
 const file='dist/server/nook-managed-wrangler.json';
 if(!config.artifact.specInputs.publicVariableNames.includes('MAIL_FROM'))throw Error('Managed sender must be a declared public variable');
 await writeFile(resolve(root,file),JSON.stringify({...source,vars:{...source.vars,MAIL_FROM:''}},null,2)+'\n');
 return {...config,artifact:{...config.artifact,specInputs:{...config.artifact.specInputs,wranglerFile:file}}};
}
