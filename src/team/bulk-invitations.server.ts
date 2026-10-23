import {fail} from '../family/team-chat/domain'
import type {Context} from '../platform/storage/context'
import {authRoute} from '../platform/operator-auth.server'
// @ts-ignore Base's canonical mailbox normalization, unchanged.
import {normalizeEmail} from '../base/modules/operator-auth/policy.mjs'
import {prepareInvitation,cancelPreparation} from './invitations.server'

export const BULK_ROWS=1000,BULK_BYTES=262_144,SEND_CHUNK=10
const address=/^[^\s@<>"',;]{1,64}@[^\s@<>"',;]{1,255}\.[^\s@<>"',;]{1,63}$/
type Row={line:number;email:string;name:string;role:string;channels:string[];expiry:string}
export type Flag='invalid-address'|'duplicate-in-batch'|'existing-account'|'already-pending'|'role-not-allowed'|'name-missing'|'unknown-channel'|'guest-needs-channel'|'no-default-channel'|'guest-expiry-not-built'
type Checked=Row&{normalized:string;status:'ok'|Flag;scopes:string[]}
const reasons:Record<Flag,string>={'invalid-address':'This is not a valid email address.','duplicate-in-batch':'This address appears earlier in the batch.','existing-account':'This address already has an account.','already-pending':'An invitation to this address is already pending.','role-not-allowed':'Bulk invitations are for members and guests; owners and admins are invited one at a time.','name-missing':'Add a name for this person.','unknown-channel':'A named channel is not one you belong to.','guest-needs-channel':'A guest needs at least one channel.','no-default-channel':'Name a channel, or set default channels first.','guest-expiry-not-built':'Guest expiry is not available yet; leave this column empty.'}

function cells(line:string){
 const out:string[]=[];let cell='',quoted=false
 for(let i=0;i<line.length;i++){const ch=line[i];if(quoted){if(ch==='"'&&line[i+1]==='"'){cell+='"';i++}else if(ch==='"')quoted=false;else cell+=ch}else if(ch==='"'&&!cell)quoted=true;else if(ch===','){out.push(cell.trim());cell=''}else cell+=ch}
 out.push(cell.trim());return out
}
/** Pasted lines or an uploaded CSV: email, name, role (member or guest), channels separated by ";", optional guest expiry. */
export function parseRows(input:Record<string,any>):Row[]{
 if(Object.keys(input).some(k=>!['csv','confirm'].includes(k))||typeof input.csv!=='string')fail(400,'Paste or upload rows as CSV text')
 if(new TextEncoder().encode(input.csv).length>BULK_BYTES)fail(413,'This batch is too large; keep it under 256 KiB')
 const lines=input.csv.split(/\r?\n/).map((text:string,i:number)=>({text,line:i+1})).filter((l:{text:string})=>l.text.trim())
 if(lines.length&&/^\s*"?email"?\s*,/i.test(lines[0].text))lines.shift()
 if(lines.length>BULK_ROWS)fail(400,`A batch holds at most ${BULK_ROWS.toLocaleString('en-US')} rows`)
 if(!lines.length)fail(400,'Add at least one row')
 return lines.map(({text,line}:{text:string;line:number})=>{const [email='',name='',role='member',channels='',expiry='']=cells(text);return {line,email,name:name.slice(0,120),role:(role||'member').toLowerCase(),channels:channels.split(';').map(s=>s.trim()).filter(Boolean),expiry}})
}
async function check(c:Context,rows:Row[]):Promise<Checked[]>{
 const inviter=c.session.operator.role
 if(inviter!=='owner'&&inviter!=='admin')fail(403,'Bulk invitations are restricted to an authorized owner or admin')
 const normalized=rows.map(r=>{try{return address.test(r.email)?normalizeEmail(r.email) as string:''}catch{return ''}})
 const emails=JSON.stringify(normalized.filter(Boolean))
 const accounts=new Map((await c.rows('SELECT lower(email) AS email,status FROM oa_operators WHERE lower(email) IN (SELECT value FROM json_each(?))',[emails])).map((r:any)=>[r.email,r.status]))
 const pending=new Set((await c.rows("SELECT email FROM nook_invite_plans WHERE email IN (SELECT value FROM json_each(?)) AND state='prepared'",[emails])).map((r:any)=>r.email))
 const channels=await c.rows("SELECT c.id,c.name FROM nook_conversations c JOIN nook_members m ON m.conversation=c.id WHERE m.user=? AND c.kind<>'dm' AND NOT EXISTS(SELECT 1 FROM nook_channel_settings WHERE conversation=c.id AND archived=1) AND (SELECT count(*) FROM nook_members cap WHERE cap.conversation=c.id)<1000",[c.uid])
 const byName=new Map(channels.map((ch:any)=>[ch.name.toLowerCase(),ch.id]))
 const defaults=(await c.rows("SELECT d.conversation AS id FROM nook_default_channels d JOIN nook_members m ON m.conversation=d.conversation AND m.user=?",[c.uid])).map((r:any)=>r.id as string)
 const seen=new Set<string>()
 return rows.map((row,i)=>{
  const email=normalized[i],ids=[...new Set(row.channels.map(n=>byName.get(n.toLowerCase())))]
  const status=((): 'ok'|Flag=>{
   if(!email)return 'invalid-address'
   if(!['member','guest'].includes(row.role))return 'role-not-allowed'
   if(seen.has(email))return 'duplicate-in-batch'
   seen.add(email)
   if(accounts.has(email))return accounts.get(email)==='invited'?'already-pending':'existing-account'
   if(pending.has(email))return 'already-pending'
   if(!row.name.trim())return 'name-missing'
   if(row.expiry)return 'guest-expiry-not-built'
   if(ids.some(id=>!id))return 'unknown-channel'
   if(row.role==='guest'&&!ids.length)return 'guest-needs-channel'
   if(row.role==='member'&&!ids.length&&!defaults.length)return 'no-default-channel'
   return 'ok'
  })()
  return {...row,normalized:email,status,scopes:(ids.length?ids:defaults) as string[]}
 })
}
const view=(rows:Checked[])=>({rows:rows.map(r=>({line:r.line,email:r.email,name:r.name,role:r.role,channels:r.channels,status:r.status,reason:r.status==='ok'?null:reasons[r.status]})),
 counts:{total:rows.length,sendable:rows.filter(r=>r.status==='ok').length,...Object.fromEntries(Object.keys(reasons).map(flag=>[flag,rows.filter(r=>r.status===flag).length]))},limit:BULK_ROWS})
/** Writes nothing: flags existing accounts, pending invitations, duplicates, invalid addresses and unusable rows. */
export async function previewBulk(c:Context,input:Record<string,any>){return view(await check(c,parseRows(input)))}
const internalHeaders=(request:Request)=>({'Content-Type':'application/json',Origin:request.headers.get('origin')??new URL(request.url).origin,Host:request.headers.get('host')??new URL(request.url).host,cookie:request.headers.get('cookie')??''})
/** Sends one invitation per remaining sendable row through the ordinary invitation door, a bounded chunk per call. */
export async function sendBulk(c:Context,request:Request,input:Record<string,any>){
 if(input.confirm!==true)fail(400,'Confirm that you reviewed the preview')
 const rows=await check(c,parseRows(input)),sendable=rows.filter(r=>r.status==='ok'),chunk=sendable.slice(0,SEND_CHUNK),failed:{email:string;reason:string}[]=[]
 let sent=0
 for(const row of chunk){
  try{
   await prepareInvitation(c,{email:row.normalized,role:'member',mode:row.role,scopes:row.scopes})
   const origin=new URL(request.url).origin,response=await authRoute(c.env as any,new Request(origin+'/auth/invite',{method:'POST',headers:internalHeaders(request),body:JSON.stringify({email:row.normalized,displayName:row.name,role:'member',returnTo:'/app'})}))
   if(response?.status!==202){await cancelPreparation(c,{email:row.normalized}).catch(()=>undefined);failed.push({email:row.normalized,reason:((await response?.json().catch(()=>({}))) as any)?.error??'not_sent'});continue}
   sent++
  }catch(error){failed.push({email:row.normalized,reason:error instanceof Error?error.message:'not_sent'})}
 }
 return {sent,failed,remaining:sendable.length-chunk.length}
}
/** Resending re-issues the pending member or guest invitation's single-use link through the same door. */
export async function resendInvitation(c:Context,request:Request,input:Record<string,any>){
 if(Object.keys(input).some(k=>k!=='email'))fail(400,'Choose an invitation to resend')
 const email=normalizeEmail(input.email),plan=await c.one("SELECT p.role,o.display_name AS name,o.status FROM nook_invite_plans p JOIN oa_operators o ON lower(o.email)=p.email WHERE p.email=? AND p.state='prepared' AND o.status='invited'",[email])
 if(!plan)fail(404,'No pending invitation for this address')
 const origin=new URL(request.url).origin,response=await authRoute(c.env as any,new Request(origin+'/auth/invite',{method:'POST',headers:internalHeaders(request),body:JSON.stringify({email,displayName:plan.name,role:plan.role,returnTo:'/app'})}))
 if(response?.status!==202)fail(response?.status===403?403:409,'The invitation could not be resent')
 return {resent:true,email}
}
