export async function conversionArchive(read,manifest,conversations,actors,events){
 const rows=manifest?.tables&&!manifest.tables.some(t=>t.name==='nook_group_conversions')?[]:await read('nook_group_conversions');
 const scopes=new Map(conversations.map(r=>[r.id,r])),people=new Map(actors.map(r=>[r.id,r])),index=new Map(),seen=new Set();
 for(const row of rows){
  if(Object.keys(row).sort().join()!=='actor,created,destination,id,source'||typeof row.id!=='string'||!row.id||seen.has(row.id)||seen.has(row.source)||seen.has(row.destination)||scopes.get(row.source)?.kind!=='dm'||scopes.get(row.source)?.message_count!==0||scopes.get(row.destination)?.kind!=='private'||row.actor!==null&&(!people.has(row.actor)||people.get(row.actor).erased)||!Number.isFinite(Date.parse(row.created)))throw Error('invalid_group_conversion');
  seen.add(row.id);seen.add(row.source);seen.add(row.destination);
  for(const conversation of [row.source,row.destination]){
   if(!events.some(e=>e.conversation===conversation&&(e.kind==='conversion'&&e.object===row.id&&e.actor===row.actor||e.kind==='erasure'&&e.actor===null&&row.actor===null)))throw Error('missing_group_conversion_event');
   index.set(row.id+':'+conversation,{...row,conversation});
  }
 }
 return index;
}
