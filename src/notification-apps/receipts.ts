import {erasedIntent} from '../team/erasure/intent.mjs'
import {fail} from '../family/team-chat/domain'
import type {AppContext,Approval} from './context'

// Identity is the approved name/channel pair, including replaced approvals.
// Tokens authenticate an approval; they never supply or choose that identity.
export const appAuthors=`SELECT id FROM nook_notification_apps WHERE name=? AND conversation=?`
export const identityValues=(app:Approval)=>[app.name,app.conversation]
export function clientKey(value:string){
 if(!/^[A-Za-z0-9._:-]{1,64}$/.test(value))fail(400,'A client key is required')
 return 'notification:'+value
}
export const receipt=(message:{id:string;created:string})=>({id:message.id,version:1,acceptedAt:message.created})
export async function acceptedMessage(c:AppContext,key:string){
 return c.one<{id:string;created:string;author:string;parent:string|null}>(`SELECT id,created,author,parent FROM nook_messages WHERE conversation=? AND author IN (${appAuthors}) AND intent=? ORDER BY created,id LIMIT 1`,[c.approval.conversation,...identityValues(c.approval),key])
}
export async function lookup(c:AppContext,key:string){
 const found=await acceptedMessage(c,key)
 if(found)return {accepted:true,receipt:receipt(found)}
 const authors=await c.rows<{id:string}>(appAuthors,identityValues(c.approval))
 const digests=await Promise.all(authors.map(author=>erasedIntent(author.id,key,c.approval.conversation)))
 const erased=await c.one('SELECT 1 FROM nook_erased_messages WHERE intent_digest IN (SELECT value FROM json_each(?))',[JSON.stringify(digests)])
 return erased?{accepted:false,state:'tombstone'}:{accepted:false}
}
