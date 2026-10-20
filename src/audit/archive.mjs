// NOOK-051 portability: the audit log travels with the archive and is restored
// unchanged; erased people appear only as NULL attribution.
const check=(ok)=>{if(!ok)throw Error('invalid_audit_log')};
const scopes=['workspace','channel','private','dm','person'],outcomes=['confirmed','failed','uncertain'];
export async function validateAuditArchive(read,manifest,actors){
 if(manifest?.tables&&!manifest.tables.some(t=>t.name==='nook_audit'))return;
 const rows=await read('nook_audit'),ids=new Set(rows.map(r=>r.id));
 check(ids.size===rows.length);
 for(const row of rows){
  check(typeof row.id==='string'&&row.id.length>0&&Number.isSafeInteger(row.at)&&typeof row.kind==='string'&&/^[a-z-]+(\.[a-z-]+)?$/.test(row.kind)&&scopes.includes(row.scope_kind)&&outcomes.includes(row.outcome)&&typeof row.reason==='string'&&row.reason.length<=200);
  check((row.actor===null||actors.has(row.actor))&&(row.service===null||typeof row.service==='string')&&(row.version===null||Number.isSafeInteger(row.version)));
  // Scopes may name an invitee who never became a product actor or a conversation an import undo removed.
  check(row.scope===null||typeof row.scope==='string'&&row.scope_kind!=='workspace');
  check(row.subject===null||typeof row.subject==='string');
  check(row.settles===null||ids.has(row.settles));
  let detail;try{detail=JSON.parse(row.detail)}catch{check(false)}
  check(detail&&typeof detail==='object'&&!Array.isArray(detail)&&Object.values(detail).every(v=>v===null||['string','number','boolean'].includes(typeof v)));
 }
}
