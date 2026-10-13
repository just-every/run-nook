// Invitation admission is credential-coupled ephemeral state. Durable product
// access, historical actors, fixed DM rosters and reactions survive recovery.
export const teamExcludedTables=['nook_invite_plans'];
const pair=(a,b)=>JSON.stringify([a,b]);
const check=(value,code)=>{if(!value)throw Error(code)};
async function rows(input,name){
 if(!input.db||!input.tables)return input.read(name);
 const stage=input.tables[name];check(typeof stage==='string'&&/^[A-Za-z_][A-Za-z0-9_]*$/.test(stage),'invalid_staged_table');
 const result=[];let cursor=0;
 for(;;){const page=(await input.db.prepare('SELECT rowid AS __copy_rowid,* FROM "'+stage+'" WHERE rowid>? ORDER BY rowid LIMIT 128').bind(cursor).all()).results;if(!page.length)return result;cursor=page.at(-1).__copy_rowid;for(const {__copy_rowid,...row} of page)result.push(row)}
}
export async function validateTeamArchive(input){
 const [actors,access,grants,conversations,members,messages,reactions,events,roster,revoked]=await Promise.all(['nook_actors','nook_access','nook_guest_grants','nook_conversations','nook_members','nook_messages','nook_reactions','nook_events','nook_dm_roster','nook_creator_revocations'].map(name=>rows(input,name)));
 const actor=new Map(actors.map(a=>[a.id,a])),admission=new Map(access.map(a=>[a.user,a])),conv=new Map(conversations.map(c=>[c.id,c])),message=new Map(messages.map(m=>[m.id,m]));
 const memberSet=new Set(members.map(m=>pair(m.user,m.conversation))),grantSet=new Set(grants.map(g=>pair(g.user,g.conversation))),rosterSet=new Set(roster.map(r=>pair(r.user,r.conversation))),rosterCounts=new Map(),reactionEvents=new Set(events.filter(e=>e.kind==='reaction').map(e=>pair(e.actor,e.object)));
 check(admission.size===access.length&&grantSet.size===grants.length&&rosterSet.size===roster.length,'duplicate_product_admission');
 for(const a of access)check(actor.has(a.user)&&['member','guest'].includes(a.mode)&&[0,1].includes(a.active)&&Number.isSafeInteger(a.generation)&&a.generation>=1&&(!a.active||actor.get(a.user).active===1)&&(a.mode!=='guest'||actor.get(a.user).role==='member'),'invalid_product_admission');
 for(const a of actors)check(!a.active||admission.get(a.id)?.active===1,'active_actor_without_admission');
 for(const g of grants)check(admission.get(g.user)?.mode==='guest'&&admission.get(g.user)?.active===1&&conv.has(g.conversation)&&conv.get(g.conversation).kind!=='dm'&&memberSet.has(pair(g.user,g.conversation)),'invalid_guest_scope');
 for(const m of members){const a=admission.get(m.user);check(a?.active===1&&(a.mode!=='guest'||grantSet.has(pair(m.user,m.conversation))),'invalid_active_membership');if(conv.get(m.conversation)?.kind==='dm')check(rosterSet.has(pair(m.user,m.conversation)),'invalid_dm_membership')}
 for(const r of roster){check(actor.has(r.user)&&conv.get(r.conversation)?.kind==='dm','invalid_dm_roster');rosterCounts.set(r.conversation,(rosterCounts.get(r.conversation)??0)+1)}
 const revocations=new Map(revoked.map(r=>[r.conversation,r])),eventIndex=new Map(events.map(e=>[pair(e.conversation,e.seq),e]));check(revocations.size===revoked.length,'duplicate_creator_revocation');
 for(const r of revoked){const e=eventIndex.get(pair(r.conversation,r.event_seq)),a=admission.get(r.user);check(conv.get(r.conversation)?.owner===r.user&&actor.has(r.user)&&a&&Number.isSafeInteger(r.generation)&&r.generation>0&&r.generation<=a.generation&&e?.kind==='access-revoked'&&e.object===r.user&&e.actor===r.user&&!memberSet.has(pair(r.user,r.conversation)),'invalid_creator_revocation')}
 for(const c of conversations){if(c.kind==='dm')check(rosterCounts.get(c.id)>=2&&rosterCounts.get(c.id)<=50&&rosterSet.has(pair(c.owner,c.id)),'invalid_dm_roster');if(admission.get(c.owner)?.active)check(memberSet.has(pair(c.owner,c.id))||revocations.get(c.id)?.user===c.owner,'active_creator_without_membership')}
 for(const e of events)if(e.kind==='access-revoked')check(actor.has(e.actor)&&e.object===e.actor&&conv.get(e.conversation)?.owner===e.actor,'invalid_creator_revocation_event');
 for(const e of events)if(e.kind==='reaction')check(message.get(e.object)?.conversation===e.conversation&&actor.has(e.actor),'invalid_reaction_event_scope');
 const uniqueReactions=new Set();
 for(const r of reactions){const key=JSON.stringify([r.message,r.user,r.emoji]);check(!uniqueReactions.has(key)&&actor.has(r.user)&&message.has(r.message)&&['👍','❤️','🎉','👀','✅','🙌'].includes(r.emoji)&&Number.isFinite(Date.parse(r.created))&&reactionEvents.has(pair(r.user,r.message)),'invalid_reaction');uniqueReactions.add(key)}
 return {participant:(conversation,user)=>rosterSet.has(pair(user,conversation)),creator:(conversation,user)=>revocations.get(conversation)?.user===user};
}
