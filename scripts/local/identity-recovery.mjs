// Offline, explicit identity conversion. The source file is never changed.
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,lstatSync,chmodSync,unlinkSync} from 'node:fs';
import {resolve} from 'node:path';
import {normalizeEmail} from '../../src/base/modules/operator-auth/index.mjs';
import {validateState} from '../../src/family/team-chat/archive-policy.mjs';
export function identityMapping(state,mapping){
 if(!mapping||Object.keys(mapping).sort().join()!=='owner,users'||!Array.isArray(mapping.users)||typeof mapping.owner!=='string')throw Error('Supply {owner: OLD_USER_ID, users: [{id,email,role}]}');
 if(mapping.users.length!==state.users.length||!state.users.length)throw Error('Mapping must name every retained user ID');
 const ids=new Set(),emails=new Set();
 const mapped=mapping.users.map(row=>{
  if(!row||Object.keys(row).sort().join()!=='email,id,role'||typeof row.id!=='string'||!['owner','admin','member'].includes(row.role))throw Error('Invalid identity mapping');
  const user=state.users.find(user=>user.id===row.id);if(!user||ids.has(row.id))throw Error('Unknown or duplicate user ID');
  const email=normalizeEmail(row.email);if(emails.has(email))throw Error('Duplicate normalized mailbox');
  if(user.email&&user.email!==email)throw Error('Existing identity mailbox conflicts');
  if(user.role&&user.role!==row.role)throw Error('Existing identity role conflicts');
  ids.add(row.id);emails.add(email);return {id:user.id,name:user.name,active:user.active,email,role:row.role};
 });
 const owner=mapped.find(user=>user.id===mapping.owner);
 if(!owner||owner.role!=='owner'||!owner.active)throw Error('Select an explicitly active recovery owner without changing retained roles');
 return mapped;
}
export function recoverIdentities(source,target,mapping){
 source=resolve(source);target=resolve(target);
 if(source===target)throw Error('Recovery requires a new database path');
 const sourceStat=lstatSync(source);if(!sourceStat.isFile()||sourceStat.isSymbolicLink())throw Error('Source must be a regular offline database');
 try{lstatSync(target);throw Error('Recovery target must not exist')}catch(error){if(error.code!=='ENOENT')throw error}
 const db=new DatabaseSync(source,{readOnly:true});let out,created=false;
 try{
  if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('Source integrity failure');
  const row=db.prepare('SELECT revision,document,schema_version FROM workspace WHERE id=1').get();if(!row||row.schema_version!==4)throw Error('Convert legacy archives to native D1 before identity recovery');
  const state=JSON.parse(row.document),withoutSessions={...state,sessions:[]};validateState(withoutSessions);
  const users=identityMapping(state,mapping);
  if(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='oa_operators'").get()&&db.prepare('SELECT COUNT(*) AS n FROM oa_operators').get().n)throw Error('Auth store already populated; select the original pre-bootstrap recovery source');
  // Every identity and reference has been admitted before a destination is created.
  const next={...state,users,sessions:[]};validateState(next);
  db.prepare('VACUUM INTO ?').run(target);created=true;chmodSync(target,0o600);
  out=new DatabaseSync(target);out.exec('PRAGMA foreign_keys=ON;BEGIN IMMEDIATE');
  for(const [file,table] of [['0005_operator_auth.sql','oa_operators'],['0006_mail.sql','rer_mail_development_outbox'],['0007_portability.sql','rer_portability_state']]){
   if(!out.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table))out.exec(readFileSync(new URL('../../migrations/'+file,import.meta.url),'utf8'));
   out.prepare('INSERT OR IGNORE INTO d1_migrations(name) VALUES(?)').run(file);
  }
  const now=Date.now();for(const user of users)out.prepare('INSERT INTO oa_operators(id,email,display_name,role,status,version,created_at) VALUES(?,?,?,?,?,1,?)').run(user.id,user.email,user.name,user.role,user.active?'active':'inactive',now);
  out.prepare('INSERT INTO oa_bootstrap(singleton,claim_id,claimed_at) VALUES(1,?,?)').run(mapping.owner,now);
  out.prepare('UPDATE workspace SET document=?,revision=revision+1 WHERE id=1').run(JSON.stringify(next));
  if(out.prepare('PRAGMA foreign_key_check').all().length)throw Error('Recovery reference failure');
  out.exec('COMMIT');out.close();out=undefined;return {ok:true,users:users.length,inactive:users.filter(u=>!u.active).length};
 }catch(error){out?.close();if(created)unlinkSync(target);throw error}finally{db.close()}
}
if(process.argv[1]===new URL(import.meta.url).pathname){
 try{const [source,target,file,...extra]=process.argv.slice(2);if(!source||!target||!file||extra.length)throw Error('Usage: node scripts/local/identity-recovery.mjs SOURCE.sqlite NEW.sqlite MAPPING.json');const stat=lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink())throw Error('Mapping must be a regular JSON file');console.log(JSON.stringify(recoverIdentities(source,target,JSON.parse(readFileSync(file,'utf8')))))}catch(error){console.error(error.message);process.exitCode=4}
}
