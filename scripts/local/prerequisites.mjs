import {readdir,lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
export async function localPrerequisites({root,vars,email}){
 if(vars.AUTH_LOCAL!=='true'||vars.MAIL_PROVIDER!=='development'||!vars.SESSION_SECRET)return false;
 const migrations=(await readdir(join(root,'migrations'))).filter(name=>name.endsWith('.sql'));
 let directory=root;
 try{for(const name of ['.wrangler','state','v3','d1','miniflare-D1DatabaseObject']){directory=join(directory,name);const stat=await lstat(directory);if(!stat.isDirectory()||stat.isSymbolicLink())return false}}catch{return false}
 for(const file of await readdir(directory,{withFileTypes:true})){
  if(!file.isFile()||!file.name.endsWith('.sqlite'))continue;let db;
  try{db=new DatabaseSync(join(directory,file.name),{readOnly:true});const applied=new Set(db.prepare('SELECT name FROM d1_migrations').all().map(row=>row.name));if(db.prepare('SELECT COUNT(*) AS n FROM oa_bootstrap').get().n===1&&db.prepare("SELECT COUNT(*) AS n FROM oa_operators WHERE email=? AND status='active' AND role='owner'").get(email).n===1&&migrations.every(name=>applied.has(name)))return true}catch{}finally{db?.close()}
 }
 return false;
}

// A recovered authentication ledger is authority even before .dev.vars exists.
// Inspect the stopped canonical binding; never pick one of several databases.
export async function existingIdentity(root){
 let directory=root;
 try{for(const name of ['.wrangler','state','v3','d1','miniflare-D1DatabaseObject']){directory=join(directory,name);const stat=await lstat(directory);if(!stat.isDirectory()||stat.isSymbolicLink())throw Error('unsafe_identity_store')}}catch(error){if(error.code==='ENOENT')return null;throw error}
 const candidates=[];
 for(const file of await readdir(directory,{withFileTypes:true})){
  if(!file.name.endsWith('.sqlite'))continue;if(!file.isFile())throw Error('unsafe_identity_store');
  const db=new DatabaseSync(join(directory,file.name),{readOnly:true});
  try{
   const tables=new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row=>row.name));
   if(!tables.has('workspace')&&!tables.has('oa_operators'))continue;
   const workspace=tables.has('workspace')?db.prepare('SELECT document FROM workspace WHERE id=1').get():null;
   const users=workspace?JSON.parse(workspace.document).users:[];
   const operators=tables.has('oa_operators')?db.prepare('SELECT email,role,status FROM oa_operators').all():[];
   if(operators.length&&(!tables.has('oa_bootstrap')||db.prepare('SELECT COUNT(*) AS n FROM oa_bootstrap').get().n!==1))throw Error('identity_claim_missing');
   const owners=operators.filter(operator=>operator.role==='owner');
   candidates.push({legacy:users.length>0&&operators.length===0,owners,operatorCount:operators.length});
  }finally{db.close()}
 }
 if(candidates.length>1)throw Error('ambiguous_identity_stores');
 const current=candidates[0];if(!current)return null;
 if(current.legacy)throw Error('offline_identity_recovery_required');
 const active=current.owners.filter(owner=>owner.status==='active');
 if(current.operatorCount&&!active.length)throw Error('explicit_active_owner_required');
 return active.map(owner=>owner.email);
}
