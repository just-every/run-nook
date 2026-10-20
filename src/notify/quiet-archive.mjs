export async function validateQuietArchive(read,manifest,actors){
 if(manifest?.tables&&!manifest.tables.some(t=>t.name==='nook_quiet_schedules'))return;
 const seen=new Set(),time=s=>typeof s==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(s);
 for(const row of await read('nook_quiet_schedules')){
  let days,zone;try{days=JSON.parse(row.days_json);zone=new Intl.DateTimeFormat('en',{timeZone:row.zone}).resolvedOptions().timeZone}catch{throw Error('invalid_quiet_schedule')}
  if(seen.has(row.user)||!actors.has(row.user)||actors.get(row.user)?.erased||![0,1].includes(row.enabled)||zone!==row.zone||!Number.isSafeInteger(row.version)||row.version<1||!Number.isSafeInteger(row.updated)||!Number.isSafeInteger(row.quiet_until)||row.quiet_until<0||row.next_change!==null&&(!Number.isSafeInteger(row.next_change)||row.next_change<0)||!Array.isArray(days)||days.length!==7||new Set(days.map(d=>d?.day)).size!==7||days.some(d=>!d||!Number.isInteger(d.day)||d.day<0||d.day>6||typeof d.enabled!=='boolean'||!time(d.start)||!time(d.end)||d.enabled&&d.start===d.end||Object.keys(d).some(k=>!['day','enabled','start','end'].includes(k))))throw Error('invalid_quiet_schedule');
  seen.add(row.user);
 }
}
