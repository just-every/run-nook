import type {Context} from '../platform/storage/context'
import {fail} from '../family/team-chat/domain'
import {bounded,fieldVisible,profileIdentity,viewerSql} from './policy'
import type {PeoplePage,Profile,ProfileResult} from './types'

function projection(viewer:string,now:number){
 return `COALESCE(p.presence_enabled,1) AS presence_enabled,COALESCE(p.typing_enabled,1) AS typing_enabled,o.id,o.display_name AS name,CASE WHEN p.zone_chosen=1 THEN p.zone ELSE '' END AS zone,COALESCE(p.zone_chosen,0) AS zone_chosen,COALESCE(p.version,0) AS version,
 CASE WHEN p.status_expires IS NULL OR p.status_expires>${now} THEN p.status_emoji ELSE '' END AS emoji,
 CASE WHEN p.status_expires IS NULL OR p.status_expires>${now} THEN p.status_text ELSE '' END AS status_text,
 CASE WHEN p.status_expires>${now} THEN p.status_expires END AS expires,
 (SELECT json_group_array(json_object('id',id,'label',label,'type',type,'visibility',visibility,'position',position,'version',version,'value',value)) FROM
  (SELECT f.*,COALESCE(v.value,'') AS value FROM nook_profile_fields f LEFT JOIN nook_profile_values v ON v.field=f.id AND v.user=o.id WHERE ${fieldVisible(viewer,'o.id')} ORDER BY f.position,f.id)) AS fields`
}
function profile(row:Record<string,any>):Profile{
 return {presenceEnabled:!!row.presence_enabled,typingEnabled:!!row.typing_enabled,id:row.id,name:row.name,zone:row.zone,zoneChosen:!!row.zone_chosen,version:row.version,status:row.emoji||row.status_text?{emoji:row.emoji??'',text:row.status_text??'',expiresAt:row.expires??null}:null,fields:JSON.parse(row.fields)}
}
function expiry(items:Profile[]){return items.reduce<number|null>((next,item)=>item.status?.expiresAt!=null?Math.min(next??Infinity,item.status.expiresAt):next,null)}
export async function readProfile(c:Context,user=c.uid):Promise<ProfileResult>{
 const id=bounded(user,256,'person',false),now=Date.now(),viewer=viewerSql(c.uid)
 const row=await c.one(`SELECT ${projection(viewer,now)} FROM oa_operators o LEFT JOIN nook_profiles p ON p.user=o.id WHERE o.id=? AND o.status='active' AND ${profileIdentity(viewer,'o.id')}`,[id])
 if(!row)fail(404,'Person unavailable')
 const item=profile(row)
 // Operational fallback only; zoneChosen is the separate profile choice.
 if(!item.zone)item.zone='UTC'
 return {profile:item,nextExpiry:expiry([item]),observedAt:now}
}

/** The visibility predicate participates in the search and the projection in
 * the same fenced snapshot. A hidden value cannot affect matches or cursors. */
export async function listPeople(c:Context,input:URLSearchParams|Record<string,unknown>=new URLSearchParams()):Promise<PeoplePage>{
 const get=(key:string)=>input instanceof URLSearchParams?input.get(key)??undefined:input[key]
 const q=bounded(get('q')??'',200,'search'),field=bounded(get('field')??'',64,'field'),value=bounded(get('value')??'',500,'field filter'),after=bounded(get('after')??'',256,'directory cursor')
 const raw=get('limit')??100,limit=typeof raw==='number'?raw:typeof raw==='string'&&/^\d+$/.test(raw)?Number(raw):NaN
 if(!Number.isSafeInteger(limit)||limit<1||limit>200)fail(400,'Choose a directory page size from 1 to 200')
 if(value&&!field)fail(400,'Choose a field for the filter')
 const viewer=viewerSql(c.uid),now=Date.now(),visible=fieldVisible(viewer,'o.id')
 const rows=await c.rows(`SELECT ${projection(viewer,now)} FROM oa_operators o LEFT JOIN nook_profiles p ON p.user=o.id
 WHERE o.status='active' AND ${profileIdentity(viewer,'o.id')} AND o.id>?
 AND (?='' OR instr(lower(o.display_name),lower(?))>0 OR EXISTS(SELECT 1 FROM nook_profile_values v JOIN nook_profile_fields f ON f.id=v.field WHERE v.user=o.id AND ${visible} AND instr(lower(v.value),lower(?))>0))
 AND (?='' OR EXISTS(SELECT 1 FROM nook_profile_fields f JOIN nook_profile_values v ON v.field=f.id AND v.user=o.id WHERE f.id=? AND ${visible} AND v.value<>'' AND (?='' OR instr(lower(v.value),lower(?))>0)))
 ORDER BY o.id LIMIT ?`,[after,q,q,q,field,field,value,value,limit+1])
 const items=rows.slice(0,limit).map(profile),hasMore=rows.length>limit
 return {items,cursor:hasMore?items.at(-1)!.id:null,hasMore,nextExpiry:expiry(items),observedAt:now}
}
