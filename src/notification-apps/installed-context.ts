import {Context} from '../platform/storage/context'
import type {StorageBindings} from '../platform/storage/context'
import {AppContext,available,audit,type Approval} from './context'
import {memberFence} from '../platform/storage/context'
import {fail} from '../family/team-chat/domain'
import type {Session} from '../base/modules/operator-auth/index.mjs'

// No saved human session or role. Each snapshot uses the approval, live token,
// explicitly approved capability and the installing person's current authority.
const installer=`EXISTS(SELECT 1 FROM nook_notification_apps installation JOIN oa_operators person ON person.id=installation.creator JOIN nook_access access ON access.user=person.id WHERE installation.id=? AND person.status='active' AND access.active=1)`
export class InstalledContext extends Context{
 constructor(env:StorageBindings,readonly approval:Approval,readonly capability:'read_messages'|'act_as_installer'){
  super(env,{operatorId:approval.creator} as Session)
 }
 override get credentials(){return [this.approval.id,this.approval.hash,this.approval.id,this.approval.id]}
 override get fence(){return `${available} AND ${installer} AND EXISTS(SELECT 1 FROM nook_notification_capabilities WHERE app=? AND ${this.capability}=1)`}
 override async check(conversation?:string){
  if(conversation&&conversation!==this.approval.conversation)fail(404,'Channel unavailable')
  if(!await this.sql(`SELECT 1 WHERE ${this.fence}${conversation?' AND '+memberFence:''}`,...this.credentials,...(conversation?[conversation,this.uid]:[])).first())fail(404,'Channel unavailable')
 }
}
export class InteractiveContext extends InstalledContext{
 source=''
 constructor(env:StorageBindings,app:Approval,readonly receipts:D1PreparedStatement[]){super(env,app,'act_as_installer')}
 override event(conversation:string,kind:string,object:string){this.source=object;return super.event(conversation,kind,object)}
 override async batch(statements:D1PreparedStatement[],conversation?:string,condition='1',values:any[]=[]){
  if(conversation!==this.approval.conversation)fail(404,'Channel unavailable')
  return super.batch([...statements,...this.receipts,audit(this,this.approval.id,this.approval.conversation,this.uid,'interactivity','confirmed',this.source)],conversation,condition,values)
 }
}
export class EventContext extends AppContext{
 constructor(env:StorageBindings,app:Approval,actor:string,readonly receipts:D1PreparedStatement[]){super(env,app,actor)}
 override get credentials(){return [...super.credentials,this.approval.id,this.approval.conversation,this.approval.creator??'',this.approval.id]}
 override get fence(){return `${super.fence} AND ${installer} AND ${memberFence} AND EXISTS(SELECT 1 FROM nook_notification_capabilities WHERE app=? AND signing IS NOT NULL)`}
 override async batch(statements:D1PreparedStatement[],conversation?:string,condition='1',values:any[]=[]){return super.batch([...statements,...this.receipts],conversation,condition,values)}
}
