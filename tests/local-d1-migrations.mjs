import {execFile} from 'node:child_process';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {promisify} from 'node:util';
import {readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import {getPlatformProxy} from 'wrangler';

const execute=promisify(execFile),require=createRequire(import.meta.url);
const cli=resolve(dirname(require.resolve('wrangler/package.json')),'bin/wrangler.js');

// Wrangler owns SQL parsing and transactional batch execution. In particular,
// D1Database.exec() is not a migration-file parser for commented multiline SQL.
export function localD1Migrations(configPath,persistTo){
 let proxy;
 async function dispose(){
  if(proxy){await proxy.dispose();proxy=undefined;}
 }
 return {
  dispose,
  async open(){
   // CLI --persist-to appends v3; the API persist.path is already that root.
   proxy??=await getPlatformProxy({configPath,persist:{path:resolve(persistTo,'v3')},remoteBindings:false});
   return proxy;
  },
  async apply(files){
   // Never let two workerd instances open the same persisted D1 database.
   await dispose();
   if(!files.length)return;
   // One fixture phase has no observer between these forward migrations. Keep
   // the historical phase boundaries while avoiding a new Wrangler/workerd
   // installation for every individual SQL file.
   await mkdir(persistTo,{recursive:true});
   const batch=resolve(persistTo,'fixture-migrations.sql');
   await writeFile(batch,(await Promise.all(files.map(file=>readFile(new URL('../migrations/'+file,import.meta.url),'utf8')))).join('\n'));
   try{
    await execute(process.execPath,[cli,'d1','execute','DB','--local','--config',configPath,'--persist-to',persistTo,'--file',batch],{
     cwd:dirname(configPath),
     env:{...process.env,WRANGLER_SEND_METRICS:'false',CI:'true'},
     maxBuffer:4*1024*1024,
    });
   }finally{await rm(batch,{force:true});}
  },
 };
}
