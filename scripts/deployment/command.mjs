import {randomBytes} from 'node:crypto';
import {cp,mkdir,mkdtemp,readFile,rename,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {ownerPlan,ownerWorkerName} from '@runeditrun/rer/modules/deploy-kit/owner';
import {packageBuild} from '@runeditrun/rer/modules/deploy-kit/prepare';
import {main} from '@runeditrun/rer/modules/deploy-kit/owner-cli';
import {privateDirectory,readPrivateFile,writePrivateFile} from '@runeditrun/rer/private-files';
import {invalid,missing} from '@runeditrun/rer/errors';

export const ownerProduct='.rer/deploy/product';
export const secretsFile='.rer/deploy/production-secrets.json';
const suppliedNames=['OWNER_EMAIL','MAIL_FROM','SENDGRID_API_KEY'],generatedNames=['SESSION_SECRET','SETUP_TOKEN'];
const text=value=>typeof value==='string'&&value.trim()&&!/[\r\n\0]/.test(value);
const mailbox=/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

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

// The owner supplies the production mailbox and mail provider; the session and
// setup secrets are generated once and kept in a private file for later deploys
// and the production owner claim. Local installation settings are never used.
async function productionSecrets(root,env,store){
 const path=join(root,secretsFile);
 try{
  const saved=JSON.parse(await readPrivateFile(path));store.addSecrets?.(Object.values(saved).filter(text));
  return saved;
 }catch(error){if(error.code!=='ENOENT')throw invalid('The private production secrets file is unreadable. Restore it before deploying.');}
 const absent=suppliedNames.filter(name=>!text(env[name]));
 if(absent.length)throw missing(`Required deployment configuration is missing: ${absent.join(', ')}. See OPERATIONS.md.`);
 if(!mailbox.test(env.OWNER_EMAIL)||!mailbox.test(env.MAIL_FROM))throw invalid('OWNER_EMAIL and MAIL_FROM must be plain mailboxes.');
 const values=Object.fromEntries(suppliedNames.map(name=>[name,env[name]]));
 for(const name of generatedNames)values[name]=randomBytes(32).toString('hex');
 store.addSecrets?.(Object.values(values));
 await writePrivateFile(path,JSON.stringify(values,null,2)+'\n',true);
 return values;
}

export function deployment(lifecycle,{fetch=globalThis.fetch}={}){return async({root,options,store,signal,operationToken})=>{
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
 const secrets=await productionSecrets(root,process.env,store);
 // Only the account credentials and declared secrets cross into the controller.
 const env=Object.fromEntries(['PATH','HOME','TMPDIR',...account].filter(name=>text(process.env[name])).map(name=>[name,process.env[name]]));
 const args=['--declaration','owner-deployment.json','--environment',environment,'--product',ownerProduct];
 const result=await main(['deploy',...args],{...env,...secrets},{cwd:root,fetch});
 await main(['health',...args],{...env,...secrets},{cwd:root,fetch});
 store.report(`deploy: ${result.origin} is healthy. Claim the production owner with the setup token in ${secretsFile}.`);
 return {deployed:true,origin:result.origin,secrets:secretsFile};
}}
