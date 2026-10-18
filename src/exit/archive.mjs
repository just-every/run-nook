// Jobs hold only resumable live-read metadata and cannot survive credential
// recovery as useful downloads. Epochs are derived invalidation bookkeeping;
// the migration-seeded clock row remains in an empty restore destination.
export const readableExportExcludedTables=['nook_exit_jobs','nook_exit_scopes','nook_exit_pages','nook_exit_changes','nook_exit_clock']
const check=value=>{if(!value)throw Error('invalid_readable_export_membership_archive')}
const fields=(row,names)=>Object.keys(row).sort().join()===names.toSorted().join()

/** Call alongside other product graph validators, with erasure-aware actor IDs.
 * Older archives lack this additive journal; never invent historical joins. */
export async function validateReadableExportArchive(read,manifest,actors,conversations){
 const load=name=>manifest?.tables&&!manifest.tables.some(table=>table.name===name)?[]:read(name)
 const [history,members]=await Promise.all([load('nook_exit_membership'),read('nook_members')])
 const memberSet=new Set(members.map(member=>JSON.stringify([member.conversation,member.user])))
 const seen=new Set(),last=new Map()
 for(const row of history.toSorted((a,b)=>a.seq-b.seq)){
  check(fields(row,['seq','conversation','user','action','at'])&&Number.isSafeInteger(row.seq)&&row.seq>0&&!seen.has(row.seq)&&conversations.has(row.conversation)&&actors.has(row.user)&&['baseline','join','leave'].includes(row.action)&&typeof row.at==='string'&&Number.isFinite(Date.parse(row.at)))
  seen.add(row.seq)
  const key=JSON.stringify([row.conversation,row.user]),previous=last.get(key)
  // A first leave can follow a pre-feature/older-archive membership whose join
  // was never journalled. Subsequent transitions must alternate truthfully.
  if(previous)check(row.action!=='baseline'&&(row.action==='leave')!==(previous.action==='leave'))
  last.set(key,row)
 }
 for(const [key,row] of last)check(memberSet.has(key)===(row.action!=='leave'))
 // A restored pre-feature archive may have current members without journal
 // entries. Those remain explicit history gaps; current membership is separate.
}
