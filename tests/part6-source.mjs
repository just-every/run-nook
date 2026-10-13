import {parseArgs} from 'node:util';
import {execFileSync} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {sourceProof} from './part6/source.mjs';
const {values}=parseArgs({options:{'platform-root':{type:'string'}}});
if(!values['platform-root'])throw Error('Pass --platform-root with the read-only reviewed platform source.');
const root=await mkdtemp(resolve(tmpdir(),'nook-part6-source-check-'));
try {
 const revision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 execFileSync('tar',['-x','-C',root],{input:execFileSync('git',['archive',revision],{maxBuffer:64*1024*1024})});
 await sourceProof(root,resolve(values['platform-root']),revision);
}finally{await rm(root,{recursive:true,force:true})}
