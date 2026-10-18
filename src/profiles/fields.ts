import type {Context} from '../platform/storage/context'
import {fail} from '../family/team-chat/domain'
import {bounded,object,profileAdmin,viewerSql} from './policy'
import type {FieldResult,ProfileField} from './types'

export async function listFields(c:Context):Promise<FieldResult>{
 const rows=await c.rows<ProfileField & {can_manage:number}>(`SELECT f.*,${profileAdmin(viewerSql(c.uid))} AS can_manage FROM nook_profile_fields f ORDER BY position,id`)
 const canManage=rows.length?!!rows[0].can_manage:!!await c.one(`SELECT 1 WHERE ${profileAdmin(viewerSql(c.uid))}`)
 return {fields:rows.map(({can_manage,...field})=>field),canManage}
}
/** Add/update one definition using its current version, or remove it with
 * {id,version,remove:true}. All values for a removed definition are erased. */
export async function writeFields(c:Context,input:unknown):Promise<FieldResult>{
 const data=object(input,['id','label','type','visibility','version','remove']),id=bounded(data.id,64,'field ID',false)
 if(!/^[a-z][a-z0-9-]*$/.test(id)||!Number.isSafeInteger(data.version)||(data.version as number)<0||data.remove!==undefined&&typeof data.remove!=='boolean')fail(400,'Provide a field ID and its current version')
 const current=await listFields(c)
 if(!current.canManage)fail(403,'Only workspace owners or admins can define profile fields')
 const prior=current.fields.find(field=>field.id===id)
 if((prior?.version??0)!==data.version)fail(409,'Profile field changed; reload')
 if(data.remove&&!prior)fail(404,'Profile field unavailable')
 if(!prior&&!data.remove&&current.fields.length>=50)fail(400,'A workspace supports up to 50 profile fields')
 const label=data.remove?'':bounded(data.label,80,'field label',false),type=data.type,visibility=data.visibility
 if(!data.remove&&(!['text','phone','date'].includes(type as string)||!['members','shared-conversation','admins','self'].includes(visibility as string)))fail(400,'Choose a profile field type and visibility')
 if(prior&&!data.remove&&type!==prior.type&&await c.one('SELECT 1 FROM nook_profile_values WHERE field=? LIMIT 1',[id]))fail(409,'Remove existing values before changing the field type')
 const version=Number(data.version),position=prior?.position??Math.max(-1,...current.fields.map(field=>field.position))+1
 const statements=data.remove?[c.sql('DELETE FROM nook_profile_values WHERE field=?',id),c.sql('DELETE FROM nook_profile_fields WHERE id=?',id)]:[
  c.sql('INSERT INTO nook_profile_fields(id,label,type,visibility,position,version) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET label=excluded.label,type=excluded.type,visibility=excluded.visibility,version=excluded.version',id,label,type,visibility,position,version+1),
 ]
 await c.batch([...statements,c.sql('INSERT INTO nook_profile_field_actions VALUES(?,?,?,?)',crypto.randomUUID(),c.uid,Date.now(),data.remove?current.fields.length-1:current.fields.length+(prior?0:1))],undefined,
  `${profileAdmin(viewerSql(c.uid))} AND COALESCE((SELECT version FROM nook_profile_fields WHERE id=?),0)=? AND (?=1 OR EXISTS(SELECT 1 FROM nook_profile_fields WHERE id=?) OR (SELECT count(*) FROM nook_profile_fields)<50) AND (?=1 OR NOT EXISTS(SELECT 1 FROM nook_profile_fields f JOIN nook_profile_values v ON v.field=f.id WHERE f.id=? AND f.type<>?))`,
  [id,version,data.remove?1:0,id,data.remove?1:0,id,type??''])
 await c.hint()
 return listFields(c)
}
