import {publishedImport} from '../imports/projection'
import {canPost} from '../team/posting-policy'
import {Context,authority} from '../platform/storage/context'
import type {StorageBindings} from '../platform/storage/context'
import type {Session} from '../base/modules/operator-auth/index.mjs'
import {channelWritable} from '../team/channel-policy'
import {fail} from '../family/team-chat/domain'
export type Approval={id:string;name:string;conversation:string;creator:string|null;state:string;hash:string}
export const available=`EXISTS(SELECT 1 FROM nook_notification_apps app JOIN nook_notification_secrets secret ON secret.app=app.id JOIN nook_conversations room ON room.id=app.conversation WHERE app.id=? AND app.state='active' AND secret.hash=? AND room.kind IN ('channel','private') AND NOT EXISTS(SELECT 1 FROM nook_import_channels ch JOIN nook_imports j ON j.id=ch.job WHERE ch.conversation=room.id AND (j.state<>'complete' OR NOT (${publishedImport}))))`
export function audit(c:Pick<Context,'sql'>,app:string,channel:string,actor:string|null,kind:string,outcome='confirmed',source=''){
 return c.sql('INSERT INTO nook_audit VALUES(?,?,?,?,?,?,?,?,?,?)',crypto.randomUUID(),actor,'notification-app:'+app,Date.now(),'notification-app.'+kind,channel,1,kind+(source?': '+source:''),outcome,1)
}
// Deliberately no person session and no arbitrary conversation access. All SQL
// snapshots use the exact approval and installation-keyed token hash.
export class AppContext extends Context{
 override get memberBroadcasts(){return false}
 source=''
 override event(conversation:string,kind:string,object:string){this.source=object;return super.event(conversation,kind,object)}
 override async writable(conversation:string){this.scope(conversation);await super.writable(conversation);if(await this.one("SELECT 1 FROM nook_notification_sharing WHERE conversation=? AND state<>'local'",[conversation]))fail(409,'Destination is not local')}

 protected get auditApp(){return this.uid}
 parent:string|null=null
 constructor(env:StorageBindings,readonly approval:Approval,actor=approval.id){super(env,{id:approval.id,operatorId:actor,operator:{version:1}} as unknown as Session)}
 override get credentials(){return [this.approval.id,this.approval.hash]}
 override get fence(){return available}
 private scope(conversation?:string){if(conversation&&conversation!==this.approval.conversation)fail(404,'Destination unavailable')}
 override async check(conversation?:string){this.scope(conversation);if(!await this.sql(`SELECT 1 WHERE ${authority} AND ${this.fence}`,...this.credentials).first())fail(404,'Destination unavailable')}
 override async rows<T=any>(sql:string,values:any[]=[],conversation?:string):Promise<T[]>{
  this.scope(conversation)
  const [rows,guard]=await this.db.batch<T>([this.sql(`SELECT * FROM (${sql}) WHERE ${authority} AND ${this.fence}`,...values,...this.credentials),this.sql(`SELECT 1 WHERE ${authority} AND ${this.fence}`,...this.credentials)])
  if(!guard.results.length)fail(404,'Destination unavailable');return rows.results
 }
 override async batch(statements:D1PreparedStatement[],conversation?:string,condition='1',values:any[]=[]){
  this.scope(conversation);const key=crypto.randomUUID()
  try{await this.db.batch([this.sql(`INSERT INTO nook_guard VALUES(?,CASE WHEN ${authority} AND ${this.fence} AND ${channelWritable('?')} AND NOT EXISTS(SELECT 1 FROM nook_notification_sharing share WHERE share.conversation=? AND share.state<>'local') AND (${condition}) THEN 1 ELSE 0 END)`,key,...this.credentials,this.approval.conversation,this.approval.conversation,...values),...statements,audit(this,this.auditApp,this.approval.conversation,null,'write','confirmed',this.source),this.sql('DELETE FROM nook_guard WHERE id=?',key)])}
  catch(error){await this.check(conversation);await this.writable(this.approval.conversation);if(String(error).includes('constraint'))fail(409,'Concurrent change; retry');throw error}
 }
 rate=false
 override async writeBatch(statements:D1PreparedStatement[],conversation:string,condition='1',values:any[]=[]){
  await this.writable(conversation)
  const posting=canPost('?','?','?');if(!await this.one(`SELECT 1 WHERE ${posting}`,[conversation,this.parent,this.uid]))fail(403,'Posting is restricted in this channel')
  condition=`(${posting}) AND (${condition})`;values=[conversation,this.parent,this.uid,...values]
  if(!this.rate)return this.batch(statements,conversation,condition,values)
  const now=Date.now(),balance=`min(20000,balance+max(0,?-updated))`
  const row=await this.one<{balance:number}>(`SELECT ${balance} AS balance FROM nook_notification_rates WHERE conversation=?`,[now,conversation])
  if(row&&row.balance<1000)throw new RateLimit(Math.ceil((1000-row.balance)/1000))
  try{await this.batch([this.sql('INSERT OR IGNORE INTO nook_notification_rates VALUES(?,20000,?)',conversation,now),this.sql(`UPDATE nook_notification_rates SET balance=${balance}-1000,updated=? WHERE conversation=?`,now,now,conversation),...statements],conversation,`(${condition}) AND NOT EXISTS(SELECT 1 FROM nook_notification_rates WHERE conversation=? AND ${balance}<1000)`,[...values,conversation,now])}catch(error){const current=await this.one<{balance:number}>(`SELECT ${balance} AS balance FROM nook_notification_rates WHERE conversation=?`,[Date.now(),conversation]);if(current&&current.balance<1000)throw new RateLimit(Math.ceil((1000-current.balance)/1000));throw error}
 }
}
export class RateLimit extends Error{constructor(readonly seconds:number){super('Channel posting rate exceeded')}}
