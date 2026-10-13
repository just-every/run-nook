import {DatabaseSync} from 'node:sqlite';
import {existsSync,renameSync} from 'node:fs';
import {recoverIdentities} from '../scripts/local/identity-recovery.mjs';
// Native D1 migrations can leave a WAL after shutdown. Keep it with its source
// so SQLite cannot replay pre-recovery pages over the recovered identities.
function moveDatabase(source,target){
 renameSync(source,target);
 for(const suffix of ['-wal','-shm'])if(existsSync(source+suffix))renameSync(source+suffix,target+suffix);
}
// Synthetic fixtures choose their owner explicitly; product recovery never infers one.
export function recoverFixture(path,ownerId){
 const db=new DatabaseSync(path,{readOnly:true});let users;try{users=JSON.parse(db.prepare('SELECT document FROM workspace').get().document).users}finally{db.close()}
 const mapping={owner:ownerId,users:users.map(user=>({id:user.id,email:user.email??user.name.toLowerCase()+'@example.test',role:user.role??(user.id===ownerId?'owner':'member')}))};
 recoverIdentities(path,path+'.recovered',mapping);moveDatabase(path,path+'.original');moveDatabase(path+'.recovered',path);
}

export function mappedFixtureOwner(path){const db=new DatabaseSync(path,{readOnly:true});try{const state=JSON.parse(db.prepare('SELECT document FROM workspace').get().document),claim=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='oa_bootstrap'").get()?db.prepare('SELECT claim_id FROM oa_bootstrap WHERE singleton=1').get():null;if(claim&&state.users.some(user=>user.id===claim.claim_id&&user.role==='owner'&&user.active))return claim.claim_id;const owners=state.users.filter(user=>user.role==='owner'&&user.active);assertOneOwner(owners);return owners[0].id}finally{db.close()}}
function assertOneOwner(owners){if(owners.length!==1)throw Error('Synthetic fixture must explicitly retain exactly one owner')}

export async function recoverNormalizedFixture(path,ownerId){
 const {recoverNormalized}=await import('../scripts/storage/recover-identities.mjs');
 const db=new DatabaseSync(path,{readOnly:true});let users;try{users=db.prepare('SELECT * FROM nook_actors ORDER BY id').all()}finally{db.close()}
 const mapping={owner:ownerId,users:users.map(user=>({id:user.id,email:user.email,role:user.role}))};
 await recoverNormalized(path,path+'.recovered',mapping);moveDatabase(path,path+'.original');moveDatabase(path+'.recovered',path);
}
export function normalizedFixtureOwner(path){const db=new DatabaseSync(path,{readOnly:true});try{const owners=db.prepare("SELECT id FROM nook_actors WHERE role='owner' AND active=1").all();assertOneOwner(owners);return owners[0].id}finally{db.close()}}
