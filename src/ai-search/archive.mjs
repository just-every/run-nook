export async function validateAiSearch(read,manifest,actors,conversations,messages,imported){
 if(manifest?.tables&&!manifest.tables.some(t=>t.name==='nook_ai_settings'))return;
 const settings=await read('nook_ai_settings');if(settings.length>1)throw Error('invalid_ai_settings');
 for(const row of settings){let url;try{url=new URL(row.base_url)}catch{throw Error('invalid_ai_settings')}if(row.id!==1||row.enabled!==0||typeof row.model!=='string'||!row.model||!Number.isSafeInteger(row.daily_cap)||row.daily_cap<1||row.daily_cap>1000||!Number.isSafeInteger(row.version)||row.version<1||url.origin!==row.base_url||!['https:','http:'].includes(url.protocol)||url.username||url.password)throw Error('invalid_ai_settings')}
 for(const row of await read('nook_ai_feedback')){const source=messages.get(row.message)??imported.get(row.message);if(typeof row.id!=='string'||!actors.has(row.user)||!conversations.has(row.conversation)||!source||source.conversation!==row.conversation||source.deleted||source.erased||typeof row.correction!=='string'||!row.correction||row.correction.length>2000||!Number.isSafeInteger(row.created))throw Error('invalid_ai_feedback')}
}
