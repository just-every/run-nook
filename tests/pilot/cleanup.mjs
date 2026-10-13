import assert from 'node:assert/strict';
import {pilotPhase} from './progress.mjs';

export async function completeImportCleanup({context,origin,files,width}){
 // Undo withdraws file access before its durable byte-deletion queue is empty.
 // Finish that public operation before stopping the alarm that also drains it.
 pilotPhase('undo-cleanup-start',{width});
 for(let call=0;call<=files;call++){
  const response=await context.request.post(origin+'/api/slack-imports/cleanup',{headers:{Origin:origin},data:{}});
  assert.equal(response.status(),200,'public import cleanup succeeds');
  const {removed}=await response.json();
  assert.ok(Number.isSafeInteger(removed)&&removed>=0,'cleanup reports completed object deletions');
  if(removed===0){pilotPhase('undo-cleanup-complete',{width,calls:call+1});return;}
 }
 assert.fail('undo object cleanup did not finish');
}
