import type {State} from '../family/team-chat/domain'

/** Persist the graph produced by Nook's domain reducer in its normalized store. */
export async function saveDemo(db:D1Database,state:State){
 const tables:Record<string,Record<string,unknown>[]>={
  nook_conversations:[],nook_members:[],nook_messages:[],nook_author_counts:[],
  nook_revisions:state.revisions,nook_events:state.events.map(e=>({...e,actor:e.kind==='message'?state.messages.find(m=>m.id===e.object)?.author??null:null})),
  nook_outcomes:state.outcomes,nook_outcome_versions:state.outcome_versions,nook_attention:state.attention,
 }
 for(const {members,...channel} of state.conversations){
  const messages=state.messages.filter(m=>m.conversation===channel.id),authors=new Map<string,number>()
  tables.nook_conversations.push({...channel,version:1,message_count:messages.length})
  tables.nook_members.push(...members.map(user=>({conversation:channel.id,user})))
  for(const [index,message] of messages.entries()){
   const own=(authors.get(message.author)??0)+1;authors.set(message.author,own)
   tables.nook_messages.push({...message,body_lower:message.body.toLowerCase(),ordinal:index+1,author_ordinal:own})
  }
  tables.nook_author_counts.push(...[...authors].map(([user,total])=>({conversation:channel.id,user,total})))
 }
 const statements=Object.entries(tables).flatMap(([table,rows])=>rows.map(row=>{
  const names=Object.keys(row)
  return db.prepare(`INSERT INTO ${table}(${names.join(',')}) VALUES(${names.map(()=>'?').join(',')}) ON CONFLICT DO NOTHING`).bind(...Object.values(row))
 }))
 // Search has no unique key: insert only the missing fixed message ids.
 statements.push(...state.messages.map(m=>db.prepare("INSERT INTO nook_search(message,conversation,source,scope,body_lower) SELECT ?,?,'native',?,? WHERE NOT EXISTS(SELECT 1 FROM nook_search WHERE message=?)").bind(m.id,m.conversation,'|'+m.conversation+'|',m.body.toLowerCase(),m.id)))
 await db.batch(statements)
}
