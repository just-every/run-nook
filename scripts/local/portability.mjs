import {lstat} from 'node:fs/promises';
import {RerError,refuse} from '@runeditrun/rer/errors';
async function transfer(context,direction){
 // The shared command boundary validates an unserved exports/ or external archive path.
 const {root,path,store,signal,operationToken,legacyRecovery,journal}=context;
 if(direction==='export'&&await lstat(path).catch(error=>{if(error.code!=='ENOENT')throw error}))throw refuse('Export requires a new archive path.');
 await store.run('Applying local migrations','pnpm',['exec','wrangler','d1','migrations','apply','DB','--local','--persist-to','.wrangler/state','--config','wrangler.jsonc'],{cwd:root,signal,env:{...process.env,RER_LOCAL_OPERATION:operationToken,WRANGLER_SEND_METRICS:'false'}});
 let output='';const child=store.spawn('Moving private Nook data',process.execPath,['scripts/local/transfer.mjs',direction,path,...(legacyRecovery?['--legacy-output',legacyRecovery.output]:[]),...(journal?['--later-archive',journal]:[])],{cwd:root,signal,env:{...process.env,RER_LOCAL_OPERATION:operationToken,WRANGLER_SEND_METRICS:'false'}});
 child.stdout.on('data',bytes=>{output+=bytes});
 const closed=new Promise(resolve=>{child.once('close',code=>resolve(code));child.once('error',()=>resolve(null))});
 await new Promise(resolve=>{child.once('exit',resolve);child.once('error',resolve)});await store.stop(child);const status=await closed;
 let result;try{result=JSON.parse(output.trim().split('\n').at(-1))}catch{throw new RerError('transfer_failed','Transfer returned no integrity receipt.',1)}
 if(status!==0||!result.ok)throw new RerError('transfer_refused',result.reason==='invalid_erasure_journal'?'The supplied erasure journal is invalid or not private. Supply the latest journal saved by Nook export.':['erasure_epoch','erased_row'].includes(result.reason)?'This archive predates a recorded erasure. Use a current post-erasure archive.':result.reason==='legacy_archive_unverifiable'?'This archive was made before Nook bound archive metadata (version 1) and cannot be authenticated. Upgrade the original installation and export a new archive, or, in a new empty checkout, run rer import --legacy-v1 --input FILE --yes --acknowledge-unverified-metadata --output exports/recovered-v2.rer (OPERATIONS.md, Backups).':result.reason?.startsWith('legacy_')?'Legacy v1 recovery refused ('+result.reason+'): use a new checkout that has not run setup, a new output path, and the acknowledgement flag.':'Transfer refused: use an empty stopped destination and inspect the archive and offline identity mapping ('+(result.reason??'unknown')+').',4);
 delete result.ok;return {target:'local',...result};
}
// legacyRecovery: Base's backup-only v1 recovery (rer import --legacy-v1) runs through this adapter.
export const portability={legacyRecovery:true,export:context=>transfer(context,'export'),import:context=>transfer(context,'import')};
