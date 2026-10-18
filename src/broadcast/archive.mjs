// Broadcast metadata is recovered without delivery state or active presence.
export async function validateBroadcastArchive(read,{manifest,actors,conversations,messages}){
 const added=async name=>manifest?.tables&&!manifest.tables.some(table=>table.name===name)?[]:read(name);
 const [policies,people,actions,choices,ignores,broadcasts,recipients]=await Promise.all(['nook_broadcast_policy','nook_broadcast_people','nook_broadcast_actions','nook_broadcast_choices','nook_broadcast_ignores','nook_broadcasts','nook_broadcast_recipients'].map(added));
 const check=value=>{if(!value)throw Error('invalid_broadcast_archive')};
 const fields=(row,list)=>Object.keys(row).sort().join()===list.split(',').sort().join();
 const integer=(value,min=0)=>Number.isSafeInteger(value)&&value>=min;
 const person=user=>actors.has(user)&&!actors.get(user).erased;
 const scope=id=>id===''||conversations.has(id)&&conversations.get(id).kind!=='dm';
 const policyMap=new Map(),versions=new Map(),seen=new Set();
 for(const p of policies){check(fields(p,'scope,version,level,everyone_channel')&&scope(p.scope)&&!policyMap.has(p.scope)&&integer(p.version,1)&&['everyone','admins','selected',...(p.scope?['inherit']:[])].includes(p.level)&&(p.everyone_channel===null||p.scope===''&&conversations.get(p.everyone_channel)?.kind==='channel'));policyMap.set(p.scope,p)}
 for(const a of actions){const key=JSON.stringify([a.scope,a.version]);check(fields(a,'id,scope,version,actor,level,people,everyone_channel,created')&&typeof a.id==='string'&&!seen.has(a.id)&&!seen.has(key)&&policyMap.has(a.scope)&&integer(a.version,1)&&a.version<=policyMap.get(a.scope).version&&['everyone','admins','selected',...(a.scope?['inherit']:[])].includes(a.level)&&integer(a.people)&&(a.actor===null||person(a.actor))&&Number.isFinite(Date.parse(a.created))&&(a.everyone_channel===null||a.scope===''&&conversations.get(a.everyone_channel)?.kind==='channel'));seen.add(a.id);seen.add(key);versions.set(a.scope,(versions.get(a.scope)??0)+1)}
 for(const p of policies)check(versions.get(p.scope)===p.version);
 seen.clear();for(const row of people){const key=JSON.stringify([row.scope,row.user]);check(fields(row,'scope,user')&&policyMap.get(row.scope)?.level==='selected'&&person(row.user)&&!seen.has(key));seen.add(key)}
 seen.clear();for(const row of choices){check(fields(row,'user,email,push,zone,away')&&person(row.user)&&!seen.has(row.user)&&[null,0,1].includes(row.email)&&[null,0,1].includes(row.push)&&[0,1].includes(row.away));try{new Intl.DateTimeFormat('en',{timeZone:row.zone})}catch{check(false)}seen.add(row.user)}
 seen.clear();for(const row of ignores){const key=JSON.stringify([row.user,row.conversation]);check(fields(row,'user,conversation')&&person(row.user)&&conversations.has(row.conversation)&&!seen.has(key));seen.add(key)}
 const snapshots=new Map();for(const row of broadcasts){const message=messages.get(row.message);check(fields(row,'message,kind,recipients,quiet,other_zones')&&message&&!message.deleted&&!message.erased&&conversations.get(message.conversation)?.kind!=='dm'&&['channel','here','everyone'].includes(row.kind)&&integer(row.recipients)&&integer(row.quiet)&&integer(row.other_zones)&&row.quiet<=row.recipients&&row.other_zones<=row.recipients&&!snapshots.has(row.message));snapshots.set(row.message,row)}
 const counts=new Map();seen.clear();for(const row of recipients){const key=JSON.stringify([row.message,row.user]);check(fields(row,'message,user')&&snapshots.has(row.message)&&person(row.user)&&messages.get(row.message).author!==row.user&&!seen.has(key));seen.add(key);counts.set(row.message,(counts.get(row.message)??0)+1)}
 for(const row of broadcasts)check((counts.get(row.message)??0)<=row.recipients);
}
