import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {main} from '@runeditrun/rer/modules/deploy-kit/owner-cli';
import {invalid,missing} from '@runeditrun/rer/errors';
import {ownerProduct} from './stage-product.mjs';

export {ownerProduct} from './stage-product.mjs';
const suppliedNames=['OWNER_EMAIL','MAIL_FROM','SENDGRID_API_KEY'];
const text=value=>typeof value==='string'&&value.trim()&&!/[\r\n\0]/.test(value);

// rer deploy supplies the declared secrets (the production mailbox and mail provider
// from the environment or --env-file, fresh session and setup secrets) and, after this
// returns, claims the hosted owner with the one-time setup token and retires it. The
// hook returns the kit's state file and the token it deployed, for rer's own claim path.
export function deployment(lifecycle){return async({root,options,store,signal,operationToken})=>{
 let declaration;try{declaration=JSON.parse(await readFile(join(root,'owner-deployment.json'),'utf8'))}catch{throw invalid('Restore a valid owner-deployment.json before deploying.')}
 const environment=options.environment??'production';
 await lifecycle.run(root,{},store,()=>{},signal,{verb:'build',operationToken});
 const account=['CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_API_TOKEN'];
 store.addSecrets?.(account.map(name=>process.env[name]).filter(text));
 const absent=account.filter(name=>!text(process.env[name]));
 if(absent.length)throw missing(`Required deployment configuration is missing: ${absent.join(', ')}. See OPERATIONS.md.`);
 // Only the account credentials and declared secrets cross into the controller.
 const names=['PATH','HOME','TMPDIR',...account,...declaration.secrets.map(item=>item.environment)];
 const env=Object.fromEntries(names.filter(name=>text(process.env[name])).map(name=>[name,process.env[name]]));
 const args=['--declaration','owner-deployment.json','--environment',environment,'--product',ownerProduct];
 let result;
 try{result=await main(['deploy',...args],env,{cwd:root});}
 catch(error){
  const input=/^missing-secret-([A-Z][A-Z0-9_]*)$/.exec(error?.message)?.[1];
  if(input)throw missing(`Required deployment configuration is missing: ${input}. A first deploy needs ${suppliedNames.join(', ')} in the environment or an --env-file (OWNER_EMAIL defaults to the setup owner). See OPERATIONS.md.`);
  throw error;
 }
 await main(['health',...args],env,{cwd:root});
 // The token rer supplied is the Worker's only when this deploy sent it; an existing
 // Worker keeps the secret it already holds, which this hook never saw.
 const setupToken=result.sentSecrets?.includes('SETUP_TOKEN')?env.SETUP_TOKEN:undefined;
 return {deployed:true,origin:result.origin,state:result.state,...setupToken?{setupToken}:{}};
}}
