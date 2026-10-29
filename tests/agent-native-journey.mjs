/** Conformance-only native read witnesses; every mutation remains in the real service. */
export async function afterStep({phase,step,result,request,origin,cookie,database}){
 if(['decision','revise-decision'].includes(step.id)){
  const record=result.record,db=await database('DB')
  const activity=await db.prepare('SELECT agent_name,sponsor_name,approvers FROM nook_agent_activity WHERE resource=? AND version=? ORDER BY at DESC LIMIT 1').bind(record.id,record.version).first()
  const response=await request(new URL(`/api/outcomes/${record.id}/versions`,origin).href,{headers:{Cookie:cookie}})
  const history=await response.json()
  if(!activity||!history.items.some(version=>version.version===record.version&&version.actorName===`${activity.agent_name} for ${activity.sponsor_name}`))throw Error('Decision history attribution differs')
  if(phase==='held'&&!JSON.parse(activity.approvers).some(person=>person.name===activity.sponsor_name))throw Error('Decision named approval differs')
  return
 }
 if(!['note','revise','revert'].includes(step.id))return
 const record=result.record
 const response=await request(new URL(`/api/conversations/${record.conversation}/notes/${record.id}`,origin).href,{headers:{Cookie:cookie}})
 if(!response.ok)throw Error('Native note witness unavailable')
 const native=await response.json(),db=await database('DB')
 const activity=await db.prepare('SELECT agent_name,sponsor_name,approvers FROM nook_agent_activity WHERE resource=? AND version=? ORDER BY at DESC LIMIT 1').bind(record.id,record.version).first()
 if(native.pinned&&native.pinnedByLabel!==`${activity?.agent_name} for ${activity?.sponsor_name}`)throw Error('Native pin attribution differs')
 if(!activity||native.body!==record.body||native.version!==record.version||native.preparedBy!==`${activity.agent_name} for ${activity.sponsor_name}`)throw Error('Native preparer attribution differs')
 const history=await request(new URL(`/api/conversations/${record.conversation}/notes/${record.id}/history`,origin).href,{headers:{Cookie:cookie}})
 const versions=await history.json()
 if(!versions.items.some(version=>version.version===record.version&&version.actorName===native.preparedBy))throw Error('Native history attribution differs')
 if(phase==='held'&&JSON.parse(activity.approvers).length)throw Error('Review must not invent a prior human approval')
}
export default async function({database}){
 const db=await database('DB')
 const binding=await db.prepare('SELECT b.claim_id,s.owner_id FROM oa_bootstrap b JOIN bs_settings s ON s.singleton=b.singleton WHERE b.singleton=1').first()
 if(!binding?.owner_id)throw Error('Signed owner binding missing')
 const moved=await db.prepare('SELECT 1 FROM nook_agent_activity WHERE sponsor<>? LIMIT 1').bind(binding.claim_id).first()
 if(moved)throw Error('Native sponsor binding moved')
 const approved=await db.prepare("SELECT sponsor,approvers FROM nook_agent_activity WHERE json_array_length(approvers)>0 ORDER BY at DESC LIMIT 1").first()
 if(!approved)throw Error('Native approval witness missing')
 for(const person of JSON.parse(approved.approvers)){
  const native=await db.prepare('SELECT display_name FROM oa_operators WHERE id=?').bind(person.id).first()
  if(native?.display_name!==person.name)throw Error('Native named approver differs')
 }
 return {ok:true}
}
