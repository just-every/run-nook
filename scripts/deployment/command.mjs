import {cp,mkdir,mkdtemp,readFile,rename,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {ownerPlan,ownerWorkerName} from '@runeditrun/rer/modules/deploy-kit/owner';
import {packageBuild} from '@runeditrun/rer/modules/deploy-kit/prepare';
import {main} from '@runeditrun/rer/modules/deploy-kit/owner-cli';
import {privateDirectory,writePrivateFile} from '@runeditrun/rer/private-files';
import {invalid,missing} from '@runeditrun/rer/errors';

export const ownerProduct='.rer/deploy/product';
const suppliedNames=['OWNER_EMAIL','MAIL_FROM','SENDGRID_API_KEY'];
const text=value=>typeof value==='string'&&value.trim()&&!/[\r\n\0]/.test(value);

// Base deploy-kit packages migrations from migrations/core; stage the build
// and Nook's flat additive history there without touching the checkout.
async function stageProduct(root){
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

// rer deploy supplies the declared secrets (the production mailbox and mail provider
// from the environment or --env-file, fresh session and setup secrets) and, after this
// returns, claims the hosted owner with the one-time setup token and retires it. The
// hook returns the kit's state file and the token it deployed, for rer's own claim path.
export function deployment(lifecycle){return async({root,options,store,signal,operationToken})=>{
 let declaration;try{declaration=JSON.parse(await readFile(join(root,'owner-deployment.json'),'utf8'))}catch{throw invalid('Restore a valid owner-deployment.json before deploying.')}
 const environment=options.environment??'production';
 await lifecycle.run(root,{},store,()=>{},signal,{verb:'build',operationToken});
 await stageProduct(root);
 if(options.dryRun){
  // Validate the real build and migrations against a synthetic target; no account lookup.
  const worker=ownerWorkerName(declaration.project,environment);
  const artifact=await packageBuild({root,source:{sha:'0'.repeat(40),tree:'0'.repeat(40)},runIdentity:{id:'0',attempt:'1'},productDirectory:ownerProduct});
  ownerPlan({project:declaration.project,environment,worker,origin:`https://${worker}.example.invalid`},declaration,artifact);
  store.report('deploy: dry run complete; no deployment occurred and no provider request was made.');
  return {dryRun:true,deployed:false,migrations:artifact.migrations.length};
 }
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
