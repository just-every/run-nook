export async function validateForwards(read,manifest,actors,conversations,messages,imported,files){
 if(manifest?.tables&&!manifest.tables.some(t=>t.name==='nook_forwards'))return;
 const forwards=new Map((await read('nook_forwards')).map(r=>[r.message,r]));
 for(const row of await read('nook_forward_policy'))if(row.id!==1||!['allow','link-only','blocked'].includes(row.mode)||!Number.isSafeInteger(row.version)||row.version<1)throw Error('invalid_forward_policy');
 for(const row of forwards.values()){
  const copy=messages.get(row.message),source=messages.get(row.source)??imported.get(row.source);
  if(!copy||copy.deleted||copy.erased||!source||source.deleted||source.erased||row.conversation!==copy.conversation||source.conversation!==row.source_conversation||!['link','show'].includes(row.mode)||typeof row.note!=='string'||row.note.length>2000||typeof row.intent!=='string'||!/^[a-f0-9]{64}$/.test(row.request_hash)||!Number.isSafeInteger(row.created))throw Error('invalid_forward');
  const seen=new Set([row.message]);let next=row.source;while(forwards.has(next)){if(seen.has(next))throw Error('forward_cycle');seen.add(next);next=forwards.get(next).source;}
 }
 for(const row of await read('nook_forward_files')){const copy=files.get(row.attachment),source=files.get(row.source_attachment),forward=forwards.get(row.message);if(!copy||!source||!forward||forward.mode!=='show'||copy.message!==row.message||copy.conversation!==row.conversation||source.message!==forward.source||copy.sha256!==source.sha256||copy.mime!==source.mime||copy.name!==source.name||copy.size!==source.size)throw Error('invalid_forward_file');}
}
