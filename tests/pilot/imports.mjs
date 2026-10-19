import assert from 'node:assert/strict';
import {join} from 'node:path';
import {expect} from '@playwright/test';
import {realisticFixture,realisticUsers} from '../slack-import/realistic-fixture.mjs';
import {verifyCorpus} from './census.mjs';
import {pilotPhase,trackImport} from './progress.mjs';
import {completeImportCleanup} from './cleanup.mjs';

// The full 3,547-entry plan applies in durable batches that fill each request's
// statement budget (about 80 entries): under three minutes locally. The budget
// stays generous for a slow shared runner with both widths side by side.
const fullApplyTimeout=50*60_000;
// The unchanged engineering destination has ~700 entries plus actors. Its
// apply and reverse each have ten minutes, including every supplied file.
const populatedApplyTimeout=10*60_000,undoTimeout=10*60_000;

const read=async(context,origin,path)=>{const response=await context.request.get(origin+path);assert.equal(response.status(),200,path);return response.json();};
async function failOnImportAlert(page,completion,timeout){
 // Fail immediately when the real wizard reports an application error, without
 // exposing its potentially private text or waiting out the corpus budget.
 const outcome=await page.waitForFunction(completion=>{
  if(document.querySelector('.imports-page [role="alert"]')?.textContent?.trim())return 'error';
  return document.querySelector('.imports-page [role="status"]')?.textContent?.includes(completion)?'complete':false;
 },completion,{timeout,polling:1_000});
 try{assert.equal(await outcome.jsonValue(),'complete','Pilot import wizard reported an application error; private diagnostic text withheld.');}
 finally{await outcome.dispose();}
}
async function reviewedImport({owner,origin,fixture,stamp,name,selected,width,phase='history',applyTimeout=fullApplyTimeout}){
 pilotPhase(`${phase}-review-start`,{width,channels:selected.length});
 await owner.goto(origin+'/imports');await expect(owner.getByLabel('Slack export ZIP')).toBeEnabled();
 await owner.getByLabel('Slack export ZIP').setInputFiles({name:'realistic-synthetic-slack.zip',mimeType:'application/zip',buffer:fixture.zip});
 await owner.getByLabel('Source workspace namespace').fill('pilot-'+stamp);
 for(const channel of selected){
  const choice=owner.locator('.import-choice').filter({has:owner.getByLabel(channel.name+' public source',{exact:true})});
  await choice.getByLabel(channel.name+' public source',{exact:true}).check();
  await choice.getByLabel('New channel name',{exact:true}).fill(`${channel.name} ${stamp}`);
  if(channel.name==='general')await choice.getByLabel(name,{exact:true}).check();
 }
 for(const select of await owner.getByRole('group',{name:'Review every source actor',exact:true}).locator('select').all())await select.selectOption('external');
 const preview=async button=>{
  const response=owner.waitForResponse(r=>r.url()===origin+'/api/slack-imports/preview'&&r.request().method()==='POST');
  await owner.getByRole('button',{name:button,exact:true}).click();const result=await response;assert.equal(result.status(),200);const value=await result.json();
  await expect(owner.getByRole('heading',{name:'Review the historical import',exact:true})).toBeVisible();
  return value;
 };
 let reviewed=await preview('Preview exact import');
 if(selected.some(c=>c.name==='general')){
  assert.equal(reviewed.blocked,true,'absent file requires an explicit choice before apply');
  await owner.getByLabel('Import without these missing files. Keep each message and show “file not supplied” with its source filename.',{exact:true}).check();
  reviewed=await preview('Preview exact import');
 }
 if(reviewed.needsOmissionReview){await owner.getByLabel('I have reviewed these omissions and accept this exact list.',{exact:true}).check();reviewed=await preview('Confirm omissions and preview again');}
 assert.equal(reviewed.blocked,false);assert.ok(reviewed.fingerprint,'exact reviewed choices are bound before apply');
 pilotPhase(`${phase}-review-complete`,{width,channels:selected.length});
 await trackImport({page:owner,origin,phase:`${phase}-apply`,width,channels:selected.length},async()=>{
  await owner.locator('form').getByRole('button',{name:'Apply reviewed plan',exact:true}).click();
  await failOnImportAlert(owner,'Import completed:',applyTimeout);
  await expect(owner.getByRole('status').filter({hasText:/Import completed:/})).toBeVisible({timeout:applyTimeout});
 });
 return owner.locator('.import-job').filter({has:owner.getByRole('heading',{name:selected.map(c=>`${c.name} ${stamp}`).join(', '),exact:true})});
}

export async function importHistory({owner,member,ownerContext,memberContext,origin,stamp,name,width,destination}){
 const fixture=realisticFixture();
 await reviewedImport({owner,origin,fixture,stamp,name,selected:fixture.channels,width});
 assert.equal(await owner.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'reviewed import fits the viewport');
 await owner.screenshot({path:join(destination,`pilot-import-${width}.png`),fullPage:true});
 const channels=await read(ownerContext,origin,'/api/conversations'),shared=channels.find(c=>c.name===`general ${stamp}`),restricted=channels.find(c=>c.name===`engineering ${stamp}`);
 assert.ok(shared&&restricted);for(const channel of channels.filter(c=>c.name.endsWith(stamp)))assert.equal(channel.unread,0,'import starts with no unread before any history is opened');
 const memberChannels=await read(memberContext,origin,'/api/conversations');assert.equal(memberChannels.find(c=>c.id===shared.id).unread,0);assert.equal(memberChannels.some(c=>c.id===restricted.id),false);
 assert.equal((await memberContext.request.get(`${origin}/api/conversations/${restricted.id}/messages`)).status(),403,'unselected audience cannot read another imported channel');
 const sharedMarker='HISTORY_SEARCH_CANARY_NOOK_R1';
 for(const [page,context] of [[owner,ownerContext],[member,memberContext]]){
  await page.goto(`${origin}/app?view=search&q=${sharedMarker}`);await expect(page.locator('.search-result').filter({hasText:sharedMarker}).first()).toBeVisible();
  const found=await read(context,origin,'/api/search?q='+sharedMarker),record=found.items.find(m=>m.conversation===shared.id);assert.ok(record);
  await page.goto(`${origin}/app?conversation=${shared.id}&focus=${record.id}`);await expect(page.locator('.message[data-immutable="true"]').filter({hasText:sharedMarker})).toBeVisible();
 }
 const excluded=await read(memberContext,origin,'/api/search?q='+encodeURIComponent('Update 1:'));assert.equal(excluded.items.some(m=>m.conversation===restricted.id),false,'search applies chosen audience');
 const corpus=await verifyCorpus({context:ownerContext,origin,channels,fixture,stamp,width}),history=corpus.byChannel.get(shared.id);
 await owner.goto(origin+'/app?view=search&q='+encodeURIComponent('Literal & <script> text'));
 await expect(owner.locator('.search-result .search-snippet').first()).toContainText('Literal & <script> text.');
 assert.equal(await owner.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'plain Slack search fits the viewport');
 await owner.locator('.search-result').first().scrollIntoViewIfNeeded();
 await owner.screenshot({path:join(destination,`pilot-plain-search-${width}.png`)});
 for(const marker of [fixture.markers.threadRoot,fixture.markers.threadReply,fixture.markers.broadcast,fixture.markers.bot,fixture.markers.app,fixture.markers.edited,fixture.markers.missingFile]){
  const record=history.find(m=>m.provenance?.timestamp===marker.ts);assert.ok(record,`source ${marker.ts} remains in history`);assert.equal(record.body,marker.text);assert.equal(record.immutable,true);
 }
 const attached=history.find(m=>m.provenance?.timestamp===fixture.markers.suppliedFile.ts),missing=history.find(m=>m.provenance?.timestamp===fixture.markers.missingFile.ts);
 assert.equal(attached.attachments.length,1);assert.equal(missing.attachments.length,0,'explicitly absent bytes are not invented');
 const supplied=fixture.suppliedFiles.find(f=>f.path.endsWith('/'+attached.attachments[0].name));assert.ok(supplied);
 for(const context of [ownerContext,memberContext]){const response=await context.request.get(`${origin}/api/attachments/${attached.attachments[0].id}/download`);assert.equal(response.status(),200);assert.deepEqual(await response.body(),supplied.bytes);}
 await member.goto(`${origin}/app?conversation=${shared.id}&focus=${missing.id}`);
 await expect(member.locator('.message').filter({hasText:fixture.markers.missingFile.text}).getByText(/file not supplied/i)).toBeVisible();
 const reaction=history.find(m=>m.provenance.sourceRecord.reactions?.length),edited=history.find(m=>m.provenance.timestamp===fixture.markers.edited.ts),mention=history.find(m=>m.body.includes(sharedMarker));
 for(const [record,check] of [[reaction,async row=>{const reactions=row.getByLabel('Imported Slack reactions · read only',{exact:true});await expect(reactions).toBeVisible();assert.equal(await reactions.getByRole('button').count(),0);for(const value of reaction.provenance.sourceRecord.reactions)await expect(reactions.getByText(`${value.name} ${value.count}`,{exact:true})).toBeVisible();}],[edited,async row=>{await expect(row.getByText('edited in Slack',{exact:true})).toBeVisible();}],[mention,async row=>{const source=realisticUsers().find(person=>person.id==='U00000001');await expect(row.locator('.message-body')).toContainText('@'+source.real_name);assert.equal((await row.locator('.message-body').textContent()).includes('<@'+source.id+'>'),false);}]] ){
  await member.goto(`${origin}/app?conversation=${shared.id}&focus=${record.id}`);await check(member.locator(`.message[data-message="${record.id}"]`));
 }
 const rootRecord=history.find(m=>m.provenance?.timestamp===fixture.markers.threadRoot.ts);
 await member.goto(`${origin}/app?conversation=${shared.id}&focus=${rootRecord.id}`);
 const root=member.locator('.message[data-immutable="true"]').filter({hasText:'THREAD_ROOT_CANARY_NOOK_R1'});await root.getByRole('button',{name:'Open thread',exact:true}).click();
 await expect(member.locator('.thread-log .message').filter({hasText:fixture.markers.threadReply.text})).toBeVisible();
 // Imported history stays read only; members continue an imported thread natively (NOOK-072, NOOK-077).
 const importedRows=member.locator('.thread-log .message[data-immutable="true"]');assert.ok(await importedRows.count()>=2,'imported root and reply are in the thread');
 for(const row of await importedRows.all()){await expect(row.getByText('Imported · read only',{exact:true})).toBeVisible();assert.equal(await row.locator('button').filter({hasText:/^(Edit|Delete|Remove file)$/}).count(),0,'imported thread messages cannot be changed');}
 await expect(member.getByRole('textbox',{name:'Reply in thread',exact:true})).toBeVisible();
 await member.screenshot({path:join(destination,`pilot-history-thread-${width}.png`),fullPage:true});
 pilotPhase('history-ui-complete',{width,...corpus.totals});
 return {shared,restricted,sharedMarker,markerId:mention.id,fixture,attachment:attached.attachments[0],corpus:corpus.totals};
}

export async function exerciseUndo({owner,ownerContext,origin,stamp,name,imported,width,destination}){
 // Separate imports establish both branches without editing database state or
 // deleting later messages to manufacture undo eligibility.
 const undoStamp='undo-'+stamp,populated=imported.fixture.channels.find(c=>c.name==='engineering');
 const undoJob=await reviewedImport({owner,origin,fixture:imported.fixture,stamp:undoStamp,name,selected:[populated],width,phase:'undo-fixture',applyTimeout:populatedApplyTimeout});
 const channels=await read(ownerContext,origin,'/api/conversations'),undoChannel=channels.find(c=>c.name===`${populated.name} ${undoStamp}`);
 const census=await verifyCorpus({context:ownerContext,origin,channels:[undoChannel],fixture:imported.fixture,stamp:undoStamp,selected:[populated],width,phase:'undo-fixture'});
 const files=census.byChannel.get(undoChannel.id).flatMap(m=>m.attachments),file=files[0];assert.ok(file);assert.ok(census.totals.messages>0);assert.ok(census.totals.threads>0);
 assert.equal((await ownerContext.request.get(`${origin}/api/attachments/${file.id}/download`)).status(),200);
 await expect(undoJob.getByRole('button',{name:'Undo this import',exact:true})).toBeEnabled();
 await trackImport({page:owner,origin,phase:'populated-undo',width,channels:1},async()=>{
  await undoJob.getByRole('button',{name:'Undo this import',exact:true}).click();
  await failOnImportAlert(owner,'Import undone:',undoTimeout);
  await expect(owner.getByRole('status').filter({hasText:/Import undone:/})).toBeVisible({timeout:undoTimeout});
 });
 assert.equal((await read(ownerContext,origin,'/api/conversations')).some(c=>c.id===undoChannel.id),false,'undo removes its unchanged populated destination');
 pilotPhase('undo-files-start',{width,files:files.length});
 for(let offset=0;offset<files.length;offset+=2)await Promise.all(files.slice(offset,offset+2).map(async file=>assert.equal((await ownerContext.request.get(`${origin}/api/attachments/${file.id}/download`)).status(),404,'undo withdraws every supplied private file')));
 pilotPhase('undo-files-complete',{width,files:files.length});
 await completeImportCleanup({context:ownerContext,origin,files:files.length,width});
 pilotPhase('guarded-undo-start',{width});
 await owner.goto(`${origin}/app?conversation=${imported.shared.id}`);const live=`Live work after import ${stamp}`;await owner.getByLabel('Message '+imported.shared.name,{exact:true}).fill(live);await owner.getByRole('button',{name:'Send',exact:true}).click();await owner.getByText(live,{exact:true}).waitFor();
 await owner.goto(origin+'/imports');const job=owner.locator('.import-job').filter({has:owner.getByRole('heading',{name:new RegExp('^general '+stamp+',')})});
 await expect(job.getByRole('button',{name:'Undo this import',exact:true})).toBeDisabled();await expect(job.getByRole('note').filter({hasText:'Undo is unavailable'})).toBeVisible();
 const jobs=await read(ownerContext,origin,'/api/slack-imports'),saved=jobs.jobs.find(j=>j.summary.channels.some(c=>c.name===imported.shared.name));assert.ok(saved);
 const refused=await ownerContext.request.post(`${origin}/api/slack-imports/${saved.review}/undo`,{headers:{Origin:origin},data:{}});assert.equal(refused.status(),409,'public undo endpoint refuses later live work too');
 assert.ok((await read(ownerContext,origin,`/api/conversations/${imported.shared.id}/messages/window?limit=50`)).items.some(m=>m.body===live),'refused undo preserves live work');
 await owner.screenshot({path:join(destination,`pilot-undo-guard-${width}.png`),fullPage:true});
 pilotPhase('guarded-undo-complete',{width});
}
