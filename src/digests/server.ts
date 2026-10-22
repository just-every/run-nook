import type {Context} from '../platform/storage/context'
import {fullMember} from '../team/access'
import {configuration} from '../ai-search/settings'
import {fail} from '../family/team-chat/domain'
import {validateScheduleTime,occurrenceAt} from '../scheduled/time.mjs'
import {showRecap} from '../recaps/server'
import {sign,type Receipt} from '../recaps/receipt'
export async function digestRoute(c:Context,method:string,p:string[],input:Record<string,unknown>){
 if(p[1]!=='digests')return null
 if(!await c.one(`SELECT 1 WHERE ${fullMember('?')}`,[c.uid]))fail(403,'Digests are for signed-in members')
 if(p.length===2&&method==='GET')return {schedule:await c.one('SELECT user,enabled,cadence,local_at,zone,delivery,next_due,version FROM nook_digest_schedules WHERE user=?',[c.uid]),deliveries:await c.rows('SELECT id,local_at,due,state,reason,created FROM nook_digest_deliveries WHERE user=? ORDER BY created DESC,id LIMIT 20',[c.uid]),available:(await configuration(c)).enabled===1}
 if(p.length===3&&p[2]==='settings'&&method==='POST'){
  if(Object.keys(input).some(k=>!['enabled','cadence','localAt','zone','delivery','version'].includes(k))||typeof input.enabled!=='boolean')fail(400,'Choose your own digest settings')
  const old=await c.one('SELECT * FROM nook_digest_schedules WHERE user=?',[c.uid]),version=old?.version??0
  if(input.version!==version)fail(409,'Digest settings changed; reload')
  if(input.enabled&&!(await configuration(c)).enabled)fail(409,'The owner must enable AI first')
  const cadence=input.cadence??old?.cadence,delivery=input.delivery??old?.delivery
  if(!['daily','weekly'].includes(String(cadence))||!['app','email'].includes(String(delivery)))fail(400,'Choose daily or weekly and in-app or email')
  const time=validateScheduleTime({localAt:input.localAt??old?.local_at,zone:input.zone??old?.zone,recurrence:cadence,endDate:null}),due=occurrenceAt(time.localAt,time.zone)
  if(input.enabled&&due<=Date.now())fail(400,'Choose a future first delivery time')
  if(input.enabled&&delivery==='email'&&!await c.one('SELECT 1 FROM nook_notify_preferences WHERE user=? AND mentions=1',[c.uid]))fail(409,'Turn on your own email notifications first')
  await c.batch([c.sql('INSERT INTO nook_digest_schedules SELECT ?,?,?,?,?,?,?,?, ?,generation,? FROM nook_access WHERE user=? ON CONFLICT(user) DO UPDATE SET enabled=excluded.enabled,cadence=excluded.cadence,local_at=excluded.local_at,zone=excluded.zone,delivery=excluded.delivery,next_due=excluded.next_due,version=excluded.version,operator_version=excluded.operator_version,access_generation=excluded.access_generation,updated=excluded.updated',c.uid,input.enabled?1:0,cadence,time.localAt,time.zone,delivery,due,version+1,c.session.operator.version,Date.now(),c.uid),c.sql('INSERT INTO nook_audit VALUES(?,?,?,?,?,?,?,?,?,?)',crypto.randomUUID(),c.uid,'digest',Date.now(),input.enabled?'digest.enable':'digest.disable','workspace',version+1,'Member changed their own unread digest schedule','confirmed',1)],undefined,'COALESCE((SELECT version FROM nook_digest_schedules WHERE user=?),0)=?',[c.uid,version])
  await c.env.CHAT_HUB.get(c.env.CHAT_HUB.idFromName('workspace')).fetch('https://hub/reminders',{method:'POST'});await c.hint();return {version:version+1}
 }
 if(p.length===3&&method==='GET'){
  const row=await c.one<{receipt:string|null}>('SELECT receipt FROM nook_digest_deliveries WHERE id=? AND user=? AND state=\'delivered\'',[p[2],c.uid]);if(!row?.receipt)fail(404,'Digest unavailable')
  const receipt=JSON.parse(row!.receipt!) as Receipt;return showRecap(c,receipt,await sign(c,receipt))
 }
 fail(404,'Digest unavailable')
}
