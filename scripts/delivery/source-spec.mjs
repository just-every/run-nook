import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {join,relative,resolve} from 'node:path';
import {managedWrangler} from './managed-build.mjs';
import {deploymentSpec} from './base/spec.mjs';

// Inspect the same Managed binding projection as the producer, using the real
// source resources and migrations. Doctor must also work before a build exists.
export async function managedSourceSpec(root,policy){
 const directory=resolve(root,'.rer');
 await mkdir(directory,{recursive:true,mode:0o700});
 const temporary=await mkdtemp(join(directory,'source-spec-'));
 try{
  const source=JSON.parse(await readFile(resolve(root,'wrangler.jsonc'),'utf8'));
  const config=managedWrangler(source,policy);
  config.d1_databases=config.d1_databases?.map(item=>({...item,migrations_dir:relative(temporary,resolve(root,item.migrations_dir))}));
  const file=join(temporary,'wrangler.json');
  await writeFile(file,JSON.stringify(config),{mode:0o600});
  return await deploymentSpec(root,{...policy.artifact.specInputs,wranglerFile:relative(root,file)});
 }finally{await rm(temporary,{recursive:true,force:true});}
}
