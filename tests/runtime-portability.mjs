import assert from 'node:assert/strict';
import {mkdtemp,rename,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {transfer} from '../scripts/local/transfer.mjs';
import {makePart,ArchiveVerifier,ContentVerifier,readArchive} from '@runeditrun/rer/modules/portability/format';
import {recoverNormalizedFixture,normalizedFixtureOwner} from './recovery-support.mjs';
import {signIn} from './auth-support.mjs';
import {source} from './import-fixture.mjs';
import {captureImport} from '../scripts/import-preview.mjs';

// Actual local bindings and the product policy, invoked only by the native runtime suite.
export async function runPortabilityWorkflow({root,state,states,proof,databasePath,command,start,stop,verify}){
 const directory=await mkdtemp(resolve(tmpdir(),'nook-portable-'));states.push(directory);
 await start(Number(new URL(proof.base).port));
 const fixture=source(directory,proof.actors[0].id,proof.actors[1].id),capture=captureImport(fixture.dir,fixture.mapping,fixture.supplied);
 const api=async(path,cookie,body,status=200)=>{const response=await fetch(proof.base+path,{method:body?'POST':'GET',headers:{Origin:proof.base,Cookie:cookie,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});assert.equal(response.status,status);return response.headers.get('content-type')?.includes('application/json')?response.json():response.text()};
 const importerActor=await signIn(proof.base,proof.actors[0].email),readerActor=await signIn(proof.base,proof.actors[1].email),plan=await api('/api/imports/preview',importerActor.cookie,{capture}),receipt=await api('/api/imports/apply',importerActor.cookie,{capture,intent:'portable-source',planDigest:plan.planDigest}),cid=receipt.channels[0].id;
 const importedRecords=(await api('/api/conversations/'+cid+'/imported-history',readerActor.cookie)).records;assert.equal(importedRecords.length,2);assert.deepEqual(importedRecords[0].provenance.sourceRecord,capture.records[0].sourceRecord);assert.equal(await api('/api/import-files/'+importedRecords[0].attachments[0].id+'/download',readerActor.cookie),'proof');await stop();
 const archive=resolve(directory,'workspace.rer'),exported=await transfer('export',archive,{root});
 const records=(await readFile(archive,'utf8')).trim().split('\n').map(line=>JSON.parse(line));
 assert.ok(exported.tables.some(table=>table.name==='nook_messages'&&table.count>=4));
 assert.ok(exported.tables.every(table=>!table.name.startsWith('oa_')&&table.name!=='rer_mail_development_outbox'));
 const productRows=records.flatMap(record=>record.items??[]).filter(item=>item.kind==='row'),original=productRows.filter(item=>item.table.startsWith('nook_'));
 const actors=productRows.filter(item=>item.table==='nook_actors').map(item=>item.row);assert.ok(actors.every(user=>user.email&&user.role&&!('hash'in user)&&!('salt'in user)));
 assert.equal(JSON.parse(productRows.find(item=>item.table==='nook_messages'&&item.row.id===proof.message).row.payload).attachments[0],proof.attachment);
 await rename(state,resolve(directory,'original-state'));
 await command(['d1','migrations','apply','DB','--local','--persist-to',state,'--config','dist/server/wrangler.json']);
 const target=await databasePath(state),before=new DatabaseSync(target,{readOnly:true});try{assert.equal(before.prepare('SELECT count(*) AS n FROM nook_messages').get().n,0)}finally{before.close()}
 // Keep all transport checksums valid while corrupting one product reference.
 const forged=structuredClone(records),badRow=forged.flatMap(record=>record.items??[]).find(item=>item.kind==='row'&&item.table==='nook_messages');badRow.row.author='missing-retained-actor';
 const manifest=forged[0],verifier=new ContentVerifier(manifest),binding=new ArchiveVerifier(manifest);
 for(let index=0;index<forged.length;index++)if(forged[index].kind==='part'){forged[index]=await makePart(forged[index].index,forged[index].items);binding.add(forged[index]);for(const item of forged[index].items)verifier.add(item)}
 forged.at(-1).contentHash=verifier.digest();forged.at(-1).archiveHash=binding.digest();const badArchive=resolve(directory,'semantically-invalid.rer');await writeFile(badArchive,forged.map(record=>JSON.stringify(record)).join('\n')+'\n',{mode:0o600});
 for await(const record of readArchive(new Blob([await readFile(badArchive)]).stream()))assert.ok(record.kind);
 await assert.rejects(()=>transfer('import',badArchive,{root}),/invalid_message|invalid_author_counter/);
 const refused=new DatabaseSync(target,{readOnly:true});try{assert.equal(refused.prepare('SELECT count(*) AS n FROM nook_messages').get().n,0);assert.equal(refused.prepare('SELECT count(*) AS n FROM oa_operators').get().n,0)}finally{refused.close()}
 // An archive in the version 1 layout earlier Nook builds wrote (no archive binding) is refused by a
 // normal import, and Base's acknowledged backup-only recovery restores it into this empty installation.
 const v1=resolve(directory,'earlier-build.rer');await writeFile(v1,records.map(record=>JSON.stringify(record===records[0]?{...record,version:1}:record.kind==='closing'?{kind:'closing',partCount:record.partCount,contentHash:record.contentHash}:record)).join('\n')+'\n',{mode:0o600});
 await assert.rejects(()=>transfer('import',v1,{root}),error=>error.code==='legacy_archive_unverifiable');
 const recovered=await transfer('import',v1,{root,legacyOutput:resolve(directory,'recovered-v2.rer')});assert.equal(recovered.restoredContentHash,exported.contentHash);assert.equal(recovered.contentHash,exported.contentHash);assert.equal(recovered.legacyRecovery,true);
 await assert.rejects(()=>transfer('import',v1,{root,legacyOutput:resolve(directory,'second.rer')}),error=>/legacy_target_not_empty/.test(error.code));
 await rename(state,resolve(directory,'legacy-state'));await command(['d1','migrations','apply','DB','--local','--persist-to',state,'--config','dist/server/wrangler.json']);
 const imported=await transfer('import',archive,{root});assert.equal(imported.contentHash,exported.contentHash);
 const restored=new DatabaseSync(target,{readOnly:true});try{for(const item of original){const key=records[0].tables.find(table=>table.name===item.table).columns.filter(column=>column.pk).sort((a,b)=>a.pk-b.pk).map(column=>column.name);const row=restored.prepare('SELECT * FROM '+item.table+' WHERE '+key.map(name=>name+' IS ?').join(' AND ')).get(...key.map(name=>item.row[name]));assert.deepEqual({...row},item.row)}assert.equal(restored.prepare('SELECT count(*) AS n FROM oa_operators').get().n,0)}finally{restored.close()}
 await start(Number(new URL(proof.base).port));
 try{const claim=await fetch(proof.base+'/auth/bootstrap',{method:'POST',headers:{Origin:proof.base,'Content-Type':'application/json'},body:JSON.stringify({token:'synthetic-unrelated-owner-claim',displayName:'Unrelated owner'})});assert.equal(claim.status,409);assert.equal((await claim.json()).error,'identity_recovery_required');const denied=await fetch(proof.base+'/api/me',{headers:{cookie:proof.actors[0].cookie}});assert.equal(denied.status,401)}finally{await stop()}
 await recoverNormalizedFixture(target,normalizedFixtureOwner(target));await start(Number(new URL(proof.base).port));
 try{await verify();const reader=await signIn(proof.base,proof.actors[1].email),author=await signIn(proof.base,proof.actors[0].email);assert.deepEqual((await api('/api/conversations/'+cid+'/imported-history',reader.cookie)).records,importedRecords);assert.equal(await api('/api/import-files/'+importedRecords[0].attachments[0].id+'/download',reader.cookie),'proof');assert.equal((await api('/api/imports/search?q=faithful',reader.cookie)).items[0].id,importedRecords[0].id);await api('/api/conversations/'+cid+'/members',author.cookie,{user:proof.actors[1].id,remove:true});await api('/api/conversations/'+cid+'/imported-history',reader.cookie,null,403);await api('/api/import-files/'+importedRecords[0].attachments[0].id+'/download',reader.cookie,null,404);assert.equal((await api('/api/imports/search?q=faithful',reader.cookie)).items.length,0)}finally{await stop()}
 return {normalBaseArchive:true,earlierBuildArchiveRecovered:true,privateGraphPreserved:true,credentialsExcluded:true,semanticRejectionAtomic:true,stableIdentityRecovery:true,importedPositiveReadAndPrivateBytesBeforeRevocation:true,importedProvenancePreserved:true};
}
