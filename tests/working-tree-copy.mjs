import {execFileSync} from 'node:child_process';
import {copyFile,mkdir,rm} from 'node:fs/promises';
import {dirname,join} from 'node:path';

// A journey must install the exact working tree, including intentional deletions.
export async function copyWorkingTree(root,directory){
 const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
 const selected=new Set(files),previous=execFileSync('git',['ls-files','-z'],{cwd:directory,encoding:'utf8'}).split('\0').filter(Boolean);
 for(const file of previous)if(!selected.has(file))await rm(join(directory,file),{force:true});
 for(const file of files){
  const target=join(directory,file);await mkdir(dirname(target),{recursive:true});
  try{await copyFile(join(root,file),target)}catch(error){if(error.code!=='ENOENT')throw error;await rm(target,{force:true})}
 }
}
