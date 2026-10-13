import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync,existsSync,mkdirSync,copyFileSync,unlinkSync,cpSync,symlinkSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {rootV3,rootArchive} from './historical-fixtures.mjs';
import {mapSQLiteArchive} from '../src/family/team-chat/archive-policy.mjs';
import {restore} from '../scripts/archive.mjs';
import {existingIdentity} from '../scripts/local/prerequisites.mjs';
import {recoverIdentities} from '../scripts/local/identity-recovery.mjs';

test('offline identity conversion requires complete explicit authority and preserves private references and original recovery bytes',async()=>{
 const root=mkdtempSync(join(tmpdir(),'nook-identity-'));
 try{
  const {rows,ra,rb}=rootV3();rows.users.push({...rows.users[1],id:'inactive-original',name:'FormerMember',active:0});
  const archive=join(root,'prior.json'),source=join(root,'prior.sqlite');writeFileSync(archive,JSON.stringify(mapSQLiteArchive(rootArchive(3,rows))));restore(archive,source);
  const before=readFileSync(source),mapping={owner:ra.id,users:[{id:ra.id,email:'alice@example.test',role:'owner'},{id:rb.id,email:'bob@example.test',role:'member'},{id:'inactive-original',email:'former@example.test',role:'member'}]};
  for(const change of [m=>m.users.pop(),m=>m.users.push(m.users[0]),m=>m.users[1].id='unknown',m=>m.users[1].id=ra.id,m=>m.users[1].email='ALICE@EXAMPLE.TEST',m=>m.owner=rb.id,m=>m.users[0].role='member']){
   const bad=structuredClone(mapping);change(bad);assert.throws(()=>recoverIdentities(source,join(root,'rejected.sqlite'),bad));assert.equal(existsSync(join(root,'rejected.sqlite')),false);assert.deepEqual(readFileSync(source),before);
  }
  const target=join(root,'recovered.sqlite');assert.deepEqual(recoverIdentities(source,target,mapping),{ok:true,users:3,inactive:1});assert.deepEqual(readFileSync(source),before);
  const db=new DatabaseSync(target,{readOnly:true}),original=new DatabaseSync(source,{readOnly:true});
  try{
   const after=JSON.parse(db.prepare('SELECT document FROM workspace').get().document),prior=JSON.parse(original.prepare('SELECT document FROM workspace').get().document);
   const {users,sessions,...privateData}=after,{users:oldUsers,sessions:oldSessions,...priorData}=prior;assert.deepEqual(privateData,priorData);assert.deepEqual(sessions,[]);assert.deepEqual(users.map(u=>[u.id,u.active]),oldUsers.map(u=>[u.id,u.active]));assert.ok(users.every(u=>!('hash'in u)&&!('salt'in u)));
   assert.deepEqual(db.prepare('SELECT id,status FROM oa_operators ORDER BY id').all().map(r=>({...r})),[{id:'inactive-original',status:'inactive'},{id:ra.id,status:'active'},{id:rb.id,status:'active'}]);
   assert.equal(db.prepare('SELECT claim_id FROM oa_bootstrap').get().claim_id,ra.id);assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
  }finally{db.close();original.close()}
  assert.throws(()=>recoverIdentities(source,target,mapping),/must not exist/);
  const binding=join(root,'.wrangler/state/v3/d1/miniflare-D1DatabaseObject');mkdirSync(binding,{recursive:true});const selected=join(binding,'workspace.sqlite');copyFileSync(source,selected);await assert.rejects(()=>existingIdentity(root),/offline_identity_recovery_required/);unlinkSync(selected);copyFileSync(target,selected);assert.deepEqual(await existingIdentity(root),['alice@example.test'],'recovered owner is authority before settings exist');const multiple=structuredClone(mapping);multiple.owner=rb.id;multiple.users[1].role='owner';multiple.users[2].role='owner';const multiTarget=join(root,'multi.sqlite');recoverIdentities(source,multiTarget,multiple);const multi=new DatabaseSync(multiTarget,{readOnly:true});try{assert.equal(multi.prepare('SELECT claim_id FROM oa_bootstrap').get().claim_id,rb.id);assert.deepEqual(multi.prepare("SELECT id,role FROM oa_operators ORDER BY id").all().map(row=>[row.id,row.role]),[['inactive-original','owner'],[ra.id,'owner'],[rb.id,'owner']])}finally{multi.close()}unlinkSync(selected);copyFileSync(multiTarget,selected);assert.deepEqual((await existingIdentity(root)).sort(),['alice@example.test','bob@example.test']);
  // Exercise the actual public dispatcher against the actual application source;
  // rejection must happen before build, settings writes or owner replacement.
  const checkout=fileURLToPath(new URL('..',import.meta.url)),project=join(root,'application');mkdirSync(project);
  const files=spawnSync('git',['ls-files','-z'],{cwd:checkout,encoding:'utf8'});assert.equal(files.status,0);
  for(const file of files.stdout.split('\0').filter(Boolean)){const destination=join(project,file);mkdirSync(dirname(destination),{recursive:true});cpSync(join(checkout,file),destination)}
  symlinkSync(join(checkout,'node_modules'),join(project,'node_modules'),'dir');
  const state=join(project,'.wrangler/state/v3/d1/miniflare-D1DatabaseObject');mkdirSync(state,{recursive:true});const live=join(state,'workspace.sqlite');copyFileSync(multiTarget,live);const originalBytes=readFileSync(live),originalBrand=readFileSync(join(project,'src/branding.json'));
  // The copy is its own CI caller: under rer verify it must not inherit verify's operation or job policy.
  const refuseSetup=()=>{const environment={...process.env,CI:'true'};delete environment.RER_LOCAL_OPERATION;delete environment.RER_ONBOARDING_PROCESS_OWNER;delete environment.RER_JOB_POLICY;const result=spawnSync(process.execPath,['node_modules/@runeditrun/rer/bin/rer.mjs','setup','--owner-email','stranger@example.test','--non-interactive','--json','--no-queue'],{cwd:project,env:environment,encoding:'utf8',timeout:15000});assert.equal(result.status,4,result.stdout+'\n'+result.stderr);const events=result.stdout.trim().split('\n').map(line=>JSON.parse(line));assert.ok(events.some(event=>event.event==='result'&&event.exitCode===4));assert.deepEqual(readFileSync(live),originalBytes);assert.deepEqual(readFileSync(join(project,'src/branding.json')),originalBrand);assert.equal(existsSync(join(project,'.dev.vars')),false)};
  refuseSetup();copyFileSync(multiTarget,join(state,'ambiguous.sqlite'));refuseSetup();unlinkSync(join(state,'ambiguous.sqlite'));symlinkSync(multiTarget,join(state,'unsafe.sqlite'));refuseSetup();
  copyFileSync(target,join(binding,'ambiguous.sqlite'));await assert.rejects(()=>existingIdentity(root),/ambiguous_identity_stores/);
 }finally{rmSync(root,{recursive:true,force:true})}
});
