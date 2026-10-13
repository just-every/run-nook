import {execFile} from 'node:child_process';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
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
   for(const file of files){
    await execute(process.execPath,[cli,'d1','execute','DB','--local','--config',configPath,'--persist-to',persistTo,'--file',fileURLToPath(new URL('../migrations/'+file,import.meta.url))],{
     cwd:dirname(configPath),
     env:{...process.env,WRANGLER_SEND_METRICS:'false',CI:'true'},
     maxBuffer:4*1024*1024,
    });
   }
  },
 };
}
