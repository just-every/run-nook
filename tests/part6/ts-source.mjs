import {registerHooks,stripTypeScriptTypes} from 'node:module';
import {existsSync,readFileSync,realpathSync,statSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

/** Load the actual read-only platform source for local contract/compiler probes. */
export function platformSource(root) {
 root=realpathSync(resolve(root));
 const within=url=>url?.startsWith(pathToFileURL(root+'/').href);
 const hooks=registerHooks({
  resolve(specifier,context,next){
   if(within(context.parentURL)&&specifier.startsWith('.')) {
    const url=new URL(specifier,context.parentURL),path=fileURLToPath(url);
    if(!existsSync(path)||statSync(path).isDirectory())for(const suffix of ['.ts','/index.ts'])if(existsSync(path+suffix)&&statSync(path+suffix).isFile())return {url:pathToFileURL(path+suffix).href,shortCircuit:true};
   }
   return next(specifier,context);
  },
  load(url,context,next){
   if(within(url)&&url.endsWith('.ts'))return {format:'module',source:stripTypeScriptTypes(readFileSync(fileURLToPath(url),'utf8')),shortCircuit:true};
   if(within(url)&&url.endsWith('.json'))return {format:'module',source:'export default '+readFileSync(fileURLToPath(url),'utf8'),shortCircuit:true};
   return next(url,context);
  },
 });
 return {load:path=>import(pathToFileURL(resolve(root,path)).href),close:()=>hooks.deregister()};
}
