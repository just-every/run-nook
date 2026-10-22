export async function validateRecaps(read,manifest,actors,conversations,messages,imported){
 if(manifest?.tables&&!manifest.tables.some(t=>t.name==='nook_recap_feedback'))return;
 for(const row of await read('nook_recap_feedback')){const source=messages.get(row.message)??imported.get(row.message);if(typeof row.id!=='string'||!actors.has(row.user)||!conversations.has(row.conversation)||!source||source.conversation!==row.conversation||source.deleted||source.erased||!['correction','dismissal'].includes(row.kind)||typeof row.correction!=='string'||row.correction.length>2000||row.kind==='correction'&&!row.correction.trim()||row.kind==='dismissal'&&row.correction!==''||!/^[a-f0-9]{64}$/.test(row.recap)||!Number.isSafeInteger(row.created))throw Error('invalid_recap_feedback')}
}
