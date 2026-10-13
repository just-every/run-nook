import {open} from 'node:fs/promises';
import {constants} from 'node:fs';
export function journalEnvelope(manifest){return {kind:'nook-erasure-journal',version:1,sourceIdentity:manifest.sourceIdentity,epoch:manifest.epoch,journal:manifest.journal}}
const invalid=()=>Object.assign(Error('Supply a private valid Nook erasure journal.'),{code:'invalid_erasure_journal'});
export async function readJournal(path){
 let file;
 try{
  file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
  const stat=await file.stat();
  if(!stat.isFile()||(stat.mode&0o077)!==0||stat.size>32*1024*1024)throw invalid();
  const bytes=await file.readFile('utf8');
  if(bytes.trim().split('\n').length!==1)throw invalid();
  const body=JSON.parse(bytes);
  if(!body||body.kind!=='nook-erasure-journal'||body.version!==1||typeof body.sourceIdentity!=='string'||!Number.isSafeInteger(body.epoch)||body.epoch<0||!Array.isArray(body.journal)||body.journal.some(h=>typeof h!=='string'||!/^[a-f0-9]{64}$/.test(h)))throw invalid();
  return body;
 }catch{throw invalid()}finally{await file?.close()}
}
