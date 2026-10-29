import {ToolRefusal,type ResourceDefinition} from '../base/modules/agent-door/index.ts'
import type {StorageBindings} from '../platform/storage/context'
import {Context} from '../platform/storage/context'
import type {Session} from '../base/modules/operator-auth/index.mjs'
import {productAccess} from '../team/access'
import {getNote} from '../notes/read'
import {message,outcome} from '../platform/storage/read'
import {Fault} from '../family/team-chat/domain'
import {nativeCall} from './context.server'
class ResourcePrincipal extends Context {
 override get credentials(){return [this.uid,this.session.operator.version]}
 override get fence(){return `EXISTS(SELECT 1 FROM oa_operators o WHERE o.id=? AND o.version=? AND o.status='active' AND ${productAccess('o.id')})`}
}
export function nookResources(env:StorageBindings):ResourceDefinition[]{
 return ['conversations','notes','messages','outcomes'].map(kind=>({
  uriTemplate:`nook://${kind}/{id}`,name:`Nook ${kind}`,scope:kind==='notes'?'notes:read':'conversations:read',classes:['standard'],
  classify:()=>[{class:'standard',facts:{measure:1}}],
  async read(uri,ctx){
   try{
    const operator=await env.DB.prepare('SELECT id,email,display_name AS displayName,role,status,version FROM oa_operators WHERE id=?').bind(ctx.person.id).first<Session['operator']>()
    if(!operator||operator.status!=='active')return null
    const c=new ResourcePrincipal(env,{id:'',operatorId:operator.id,operator} as Session),id=new URL(uri).pathname.slice(1)
    await c.check()
    let json:unknown
    if(kind==='conversations')json=await c.one('SELECT id,name,kind,seq,version FROM nook_conversations WHERE id=?',[id],id)
    else if(kind==='notes'){const note=await c.one('SELECT conversation FROM nook_notes WHERE id=? AND EXISTS(SELECT 1 FROM nook_members m WHERE m.conversation=nook_notes.conversation AND m.user=?)',[id,c.uid]);if(!note)return null;json=await getNote(c,note.conversation,id)}
    else json=await nativeCall(()=>kind==='messages'?message(c,id):outcome(c,id))
    return json?{json,untrusted:true}:null
   }catch(error){if(error instanceof ToolRefusal||error instanceof Fault)return null;throw error}
  },
 }))
}
