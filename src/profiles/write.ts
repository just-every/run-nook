import type {Context} from '../platform/storage/context'
import {fail} from '../family/team-chat/domain'
import {bounded,object} from './policy'
import {profileZone,statusInput} from './expiry'
import {readProfile} from './read'
import {listFields} from './fields'

/** Partial own-profile writes; omitted status, values and timezone survive.
 * A supplied version is an optimistic fence for an editor's complete form. */
export async function writeProfile(c:Context,input:unknown){
 const data=object(input,['name','zone','statusTimeZone','status','fields','version','away','presenceEnabled','typingEnabled']),now=Date.now(),current=await readProfile(c)
 if(data.version!==undefined&&(!Number.isSafeInteger(data.version)||data.version!==current.profile.version))fail(409,'Profile changed; reload before saving')
 const zone=data.zone===undefined?current.profile.zone:profileZone(data.zone),zoneChosen=data.zone!==undefined||current.profile.zoneChosen
 const statusZone=data.statusTimeZone===undefined?zone:profileZone(data.statusTimeZone),status=data.status===undefined?current.profile.status:statusInput(data.status,statusZone,now)
 if(data.away!==undefined&&typeof data.away!=='boolean')fail(400,'Choose active or away')
 for(const key of ['presenceEnabled','typingEnabled'])if(data[key]!==undefined&&typeof data[key]!=='boolean')return fail(400,'Choose enabled or disabled for presence and typing')
 const statements=[c.sql('INSERT INTO nook_profiles(user,zone,zone_chosen,status_emoji,status_text,status_expires,version,updated) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(user) DO UPDATE SET zone=excluded.zone,zone_chosen=excluded.zone_chosen,status_emoji=excluded.status_emoji,status_text=excluded.status_text,status_expires=excluded.status_expires,version=excluded.version,updated=excluded.updated',c.uid,zone,Number(zoneChosen),status?.emoji??'',status?.text??'',status?.expiresAt??null,current.profile.version+1,now)]
 if(data.name!==undefined)statements.push(c.sql('UPDATE oa_operators SET display_name=? WHERE id=?',bounded(data.name,100,'display name',false),c.uid))
 if(data.away!==undefined)statements.push(c.sql('INSERT INTO nook_broadcast_choices(user,zone,away) VALUES(?,?,?) ON CONFLICT(user) DO UPDATE SET away=excluded.away',c.uid,zone,Number(data.away)))
 if(data.presenceEnabled!==undefined)statements.push(c.sql('UPDATE nook_profiles SET presence_enabled=? WHERE user=?',Number(data.presenceEnabled),c.uid),...(data.presenceEnabled?[]:[c.sql('DELETE FROM nook_broadcast_presence WHERE user=?',c.uid)]))
 if(data.typingEnabled!==undefined)statements.push(c.sql('UPDATE nook_profiles SET typing_enabled=? WHERE user=?',Number(data.typingEnabled),c.uid),...(data.typingEnabled?[]:[c.sql('DELETE FROM nook_typing WHERE user=?',c.uid)]))
 const guards=['COALESCE((SELECT version FROM nook_profiles WHERE user=?),0)=?'],values:any[]=[c.uid,current.profile.version]
 if(data.fields!==undefined){
  const fields=object(data.fields,Object.keys(data.fields&&typeof data.fields==='object'&&!Array.isArray(data.fields)?data.fields:{})),definitions=(await listFields(c)).fields
  if(Object.keys(fields).length>50)fail(400,'Too many profile values')
  for(const [id,raw] of Object.entries(fields)){
   const definition=definitions.find(field=>field.id===id)??fail(400,'Profile field unavailable; reload')
   const value=bounded(raw,500,definition.label)
   if(definition.type==='date'&&value){const d=new Date(value+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==value)fail(400,'Choose a valid date for '+definition.label)}
   statements.push(value?c.sql('INSERT INTO nook_profile_values(user,field,value) VALUES(?,?,?) ON CONFLICT(user,field) DO UPDATE SET value=excluded.value',c.uid,id,value):c.sql('DELETE FROM nook_profile_values WHERE user=? AND field=?',c.uid,id))
   guards.push('EXISTS(SELECT 1 FROM nook_profile_fields WHERE id=? AND version=?)');values.push(id,definition.version)
  }
 }
 await c.batch(statements,undefined,guards.join(' AND '),values)
 await c.hint()
 return readProfile(c)
}
