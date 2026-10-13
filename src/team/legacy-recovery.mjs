// Called only by the explicit paused legacy converter, after its identity
// mapping validation. Historical DM rosters and creators survive deactivation;
// active grants are a separate product authority in the new representation.
export function addLegacyTeamRows(tables){
 const actors=new Map(tables.nook_actors.map(a=>[a.id,a]));
 const dms=new Set(tables.nook_conversations.filter(c=>c.kind==='dm').map(c=>c.id));
 tables.nook_access=tables.nook_actors.map(a=>({user:a.id,mode:'member',active:a.active,generation:1}));
 tables.nook_guest_grants=[];
 tables.nook_dm_roster=tables.nook_members.filter(m=>dms.has(m.conversation)).map(m=>({...m}));
 tables.nook_reactions=[];
 tables.nook_creator_revocations=[];
 // This is an actual migration revocation of a validated legacy membership,
 // witnessed before dropping inactive actors from the current grant roster.
 for(const c of tables.nook_conversations)if(actors.get(c.owner)?.active===0&&tables.nook_members.some(m=>m.conversation===c.id&&m.user===c.owner)){
  c.seq++;tables.nook_events.push({conversation:c.id,seq:c.seq,kind:'access-revoked',object:c.owner,actor:c.owner});
  tables.nook_creator_revocations.push({conversation:c.id,user:c.owner,generation:1,event_seq:c.seq});
 }
 tables.nook_members=tables.nook_members.filter(m=>actors.get(m.user)?.active===1);
 // Insert access before memberships. The converter must never disable live
 // admission triggers or infer an email/role while establishing these rows.
 return Object.fromEntries(['nook_actors','nook_access',...Object.keys(tables).filter(k=>!['nook_actors','nook_access'].includes(k))].map(k=>[k,tables[k]]));
}
