import type {Context} from '../platform/storage/context'
import {fail,text} from '../family/team-chat/domain'
import {fullMember} from '../team/access'
import {channelManagement,channelWritable} from '../team/channel-policy'
import {newSecret,sealToken} from '../integrations/secret'
import {audit} from './context'
const approver=`EXISTS(SELECT 1 FROM oa_operators o WHERE o.id=? AND o.status='active' AND o.role IN ('owner','admin') AND ${fullMember('o.id')})`
export async function manageApps(c:Context,method:string,p:string[],input:Record<string,unknown>){
 if(p[1]!=='notification-apps')return null
 if(p.length===2&&method==='GET'){
  if(!await c.one(`SELECT 1 WHERE ${approver}`,[c.uid]))fail(403,'Only owners and admins list app approvals')
  return {approvals:await c.rows('SELECT app.id,app.name,app.conversation,app.creator,app.created,app.state,app.ended,room.name AS channelName FROM nook_notification_apps app JOIN nook_conversations room ON room.id=app.conversation WHERE EXISTS(SELECT 1 FROM nook_members m WHERE m.conversation=app.conversation AND m.user=?) ORDER BY app.created DESC',[c.uid])}
 }
 if(p.length===2&&method==='POST'){
  if(!await c.one(`SELECT 1 WHERE ${approver}`,[c.uid]))fail(403,'Only owners and admins approve apps')
  if(Object.keys(input).some(k=>!['name','channels'].includes(k)))fail(400,'Unsupported approval field')
  const name=text(input.name,80).trim()||fail(400,'Name the app'),channels=input.channels
  if(!Array.isArray(channels)||!channels.length||channels.length>20||channels.some(c=>typeof c!=='string')||new Set(channels).size!==channels.length)fail(400,'Choose named channels')
  const approvals=[];const statements:D1PreparedStatement[]=[]
  for(const channel of channels as string[]){
   if(!await c.one(`SELECT 1 FROM nook_conversations WHERE id=? AND kind IN ('channel','private') AND ${channelWritable('id')}`,[channel],channel))fail(400,'Choose an available channel you belong to')
   const id=crypto.randomUUID(),token=newSecret(id).replace('nookit_','nookapp_'),now=Date.now()
   const previous=await c.rows("SELECT id FROM nook_notification_apps WHERE name=? AND conversation=? AND state='active'",[name,channel]);
   for(const old of previous)statements.push(c.sql("UPDATE nook_notification_apps SET state='revoked',ended=? WHERE id=?",now,old.id),c.sql('DELETE FROM nook_notification_secrets WHERE app=?',old.id),audit(c,old.id,channel,c.uid,'reissue'))
   statements.push(c.sql("INSERT INTO nook_notification_apps VALUES(?,?,?,?,?,'active',NULL)",id,name,channel,c.uid,now),c.sql('INSERT INTO nook_notification_secrets VALUES(?,?)',id,await sealToken(token,c.env.SESSION_SECRET)),audit(c,id,channel,c.uid,'approve'),audit(c,id,channel,c.uid,'issue'))
   approvals.push({id,name,conversation:channel,token})
  }
  // Recheck every membership and lifecycle at the commit, not only while rendering options.
  await c.batch(statements,undefined,`${approver} AND NOT EXISTS(SELECT 1 FROM json_each(?) selected WHERE NOT EXISTS(SELECT 1 FROM nook_members m JOIN nook_conversations room ON room.id=m.conversation WHERE m.user=? AND m.conversation=selected.value AND room.kind IN ('channel','private') AND ${channelWritable('room.id')}))`,[c.uid,JSON.stringify(channels),c.uid])
  return {approvals}
 }
 if(p.length===4&&method==='POST'&&['revoke','remove'].includes(p[3])){
  const app=await c.one<{conversation:string}>('SELECT conversation FROM nook_notification_apps WHERE id=?',[p[2]])??fail(404,'Approval unavailable')
  const management=channelManagement('?', '?')
  // Management role alone is not enough: current membership is fenced too.
  if(!await c.one(`SELECT 1 WHERE ${management}`,[c.uid,app.conversation],app.conversation))fail(403,'Only an owner, admin or channel manager may revoke this approval')
  await c.batch([c.sql('UPDATE nook_notification_apps SET state=?,ended=? WHERE id=?',p[3]==='remove'?'removed':'revoked',Date.now(),p[2]),c.sql('DELETE FROM nook_notification_secrets WHERE app=?',p[2]),audit(c,p[2],app.conversation,c.uid,p[3])],app.conversation,management,[c.uid,app.conversation])
  return {ok:true}
 }
 fail(404,'Not found')
}
