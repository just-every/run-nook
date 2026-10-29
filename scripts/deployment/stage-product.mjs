import {cp,mkdir,mkdtemp,rename,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {privateDirectory,writePrivateFile} from '@runeditrun/rer/private-files';

export const ownerProduct='.rer/deploy/product';

// The shared owner controller uses migrations/core. Prepare the same native
// build and flat additive history for local planning and real deployment.
export async function stageProduct(root=process.cwd()){
 const directory=await privateDirectory(root,['.rer','deploy']);
 await writePrivateFile(join(directory,'.gitignore'),'*\n');
 const stage=await mkdtemp(join(directory,'prepare-'));
 try{
  const product=join(stage,'product');
  await mkdir(join(product,'migrations'),{recursive:true});
  await cp(join(root,'dist'),join(product,'dist'),{recursive:true});
  await cp(join(root,'migrations'),join(product,'migrations','core'),{recursive:true});
  await rm(join(root,ownerProduct),{recursive:true,force:true});
  await rename(product,join(root,ownerProduct));
 }finally{await rm(stage,{recursive:true,force:true});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await stageProduct();
