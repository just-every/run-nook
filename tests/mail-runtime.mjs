import {createRequire} from 'node:module';
import {readFile,readdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {mailBindings,mailEdge,registerMailEdge} from './mail-edge.mjs';
const require=createRequire(import.meta.url);
const {Miniflare,Log,LogLevel,convertV4MiniflareOptions}=createRequire(require.resolve('wrangler'))('miniflare');

// Emitted application and ordinary provider configuration. Only outbound mail is
// substituted at the network boundary; local identity and every binding are real.
export async function mailRuntime({root=process.cwd(),state,origin,bindings={},configPath,fixture,edge=mailEdge()}){
 const path=configPath??resolve(root,'dist/server/wrangler.json');
 const config=fixture?.config??JSON.parse(await readFile(path,'utf8')),directory=dirname(path);
 const main=resolve(directory,config.main),assets=resolve(root,'dist/server/assets');
 const modules=[fixture?.entry??{type:'ESModule',path:main},...(await readdir(assets)).filter(name=>name.endsWith('.js')).map(name=>({type:'ESModule',path:resolve(assets,name)}))];
 // Fault fixtures can import the emitted entry as a second module.
 const app=resolve(root,'dist/server/index.js');if(main!==app)modules.push({type:'ESModule',path:app});
 const options={name:config.name,host:'127.0.0.1',port:Number(new URL(origin).port),routes:['*/*'],modules,modulesRoot:resolve(root,'dist/server'),
  compatibilityDate:config.compatibility_date,compatibilityFlags:config.compatibility_flags,
  d1Databases:Object.fromEntries(config.d1_databases.map(db=>[db.binding,db.database_id])),
  r2Buckets:Object.fromEntries(config.r2_buckets.map(bucket=>[bucket.binding,bucket.bucket_name])),
  durableObjects:Object.fromEntries(config.durable_objects.bindings.map(binding=>[binding.name,{className:binding.class_name,useSQLite:true}])),
  ...(state?{resourcePersistencePath:resolve(state,'v3')}:{}),
  bindings:{...config.vars,...bindings,...mailBindings,AUTH_LOCAL:'true',AUTH_ORIGIN:origin,RER_DEV_ORIGIN:origin},
  assets:{directory:resolve(root,'dist/client'),binding:'ASSETS',run_worker_first:true},
  outboundService:request=>edge.fetch(request),log:new Log(LogLevel.ERROR)};
 const mf=new Miniflare(convertV4MiniflareOptions(options));
 try{await mf.ready;const unregister=registerMailEdge(origin,edge);return {mf,edge,db:await mf.getD1Database('DB'),close:async()=>{unregister();await mf.dispose()}}}
 catch(error){await mf.dispose();throw error}
}
