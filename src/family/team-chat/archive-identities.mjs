// Persisted IDs are opaque URL tokens, not necessarily UUIDs. Historical root
// IDs and composite attention IDs remain valid; URL separators, dot segments,
// whitespace and control characters cannot identify a reachable resource.
const identity=value=>typeof value==='string'&&value.length>0&&value.isWellFormed()&&
 !/[\s\p{Cc}\p{Cf}/\\%|]/u.test(value)&&
 new URL('https://archive.invalid/'+value).pathname==='/'+value
function fields(row,required,nullable=[]){
 for(const key of required)if(!identity(row?.[key]))throw Error('Invalid persisted identity: '+key)
 for(const key of nullable)if(row?.[key]!==null&&!identity(row?.[key]))throw Error('Invalid persisted identity: '+key)
}
export function validateIdentities(s){
 const tables={
  users:[['id']],conversations:[['id','owner']],
  messages:[['id','conversation','author'],['parent']],
  revisions:[['message']],events:[['conversation','object']],
  outcomes:[['id','conversation','author'],['assignee','source']],
  outcome_versions:[['outcome','actor']],reads:[['conversation','user']],
  attachments:[['id','conversation','author'],['message']],
  preferences:[['user','conversation']],thread_follows:[['user','message']],
  user_settings:[['user']],attention:[['id','user','conversation'],['message','outcome']],
 }
 for(const [table,args]of Object.entries(tables))for(const row of s[table])fields(row,...args)
 for(const c of s.conversations)if(!Array.isArray(c.members)||!c.members.every(identity))throw Error('Invalid persisted identity: members')
 for(const j of s.imports){
  fields(j,['id','owner'])
  for(const table of ['channels','records','files']){
   if(!Array.isArray(j[table]))throw Error('Invalid import identity bindings')
   for(const row of j[table])fields(row,['id'])
  }
 }
}
