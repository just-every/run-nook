import {productAccess} from '../team/access'
import {parseConfig} from '../base/modules/editor/src/config'
import {operatorAuth, authBindings, type Bindings} from './operator-auth.server'
import type {Session} from '../base/modules/operator-auth/index.mjs'

export type EditorBindings = Bindings & {RER_MANAGEMENT_ORIGIN?:string;RER_INSTALLATION_ID?:string}
const headers = {'Cache-Control':'no-store, private','Vary':'Cookie','X-Content-Type-Options':'nosniff'}
function configuration(env:EditorBindings) {
 return parseConfig({enabled:true,managementOrigin:env.RER_MANAGEMENT_ORIGIN,installationId:env.RER_INSTALLATION_ID})
}
async function authority(env:EditorBindings,request:Request,identity?:Promise<Session|null>) {
 const origin=authBindings(env).AUTH_ORIGIN
 if(new URL(request.url).origin!==origin || (request.headers.has('origin') && request.headers.get('origin')!==origin) || request.headers.get('sec-fetch-site')==='cross-site') return null
 const session=await(identity??operatorAuth(env).getSession(request))
 if(!session || session.operator.role!=='owner' || session.operator.status!=='active' || session.expiresAt<=Date.now())return null
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${session.operatorId}:${session.id}:${session.operator.version}`))
 // After asynchronous reads and key derivation, authorize the exact session in
 // one current database snapshot. Use that snapshot's expiry for the lease too.
 const current=await env.DB.prepare(`SELECT s.expires_at AS expiresAt FROM oa_sessions s JOIN oa_operators o ON o.id=s.operator_id
  WHERE s.id=? AND s.operator_id=? AND s.operator_version=? AND o.version=s.operator_version
  AND o.status='active' AND o.role='owner' AND s.revoked_at IS NULL
  AND s.expires_at>CAST(unixepoch('subsec')*1000 AS INTEGER)
  AND (SELECT authority FROM nook_storage WHERE id=1)='normalized' AND ${productAccess('o.id')}`)
  .bind(session.id,session.operatorId,session.operator.version).first<{expiresAt:number}>()
 if(!current)return null
 return {expiresAt:current.expiresAt,key:Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('')}
}

/** Both public HTTP doors re-read native authorization. The key is identity, never a credential. */
export async function editorRoute(env:EditorBindings,request:Request) {
 try {
  const owner=await authority(env,request)
  if(!owner)return Response.json({error:'Owner authorization required'},{status:403,headers})
  if(request.method!=='GET')return Response.json({error:'GET required'},{status:405,headers:{...headers,Allow:'GET'}})
  if(new URL(request.url).pathname==='/api/editor/session')return Response.json({ownerKey:owner.key},{headers})
  if(request.headers.get('X-Nook-Editor-Owner')!==owner.key)return Response.json({error:'Owner session changed'},{status:403,headers})
  return Response.json({config:configuration(env),expiresAt:Math.min(owner.expiresAt,Date.now()+30_000)},{headers})
 } catch {return Response.json({error:'Editor configuration unavailable'},{status:503,headers})}
}

/** This app had no CSP. Keep embedding closed except on the editable document.
 * A current owner's documents carry a marker, so only an owner's homepage asks
 * the editor doors for authority; visitors and members never call them. */
export async function editorDocument(response:Response,env:EditorBindings,request:Request,identity?:Promise<Session|null>) {
 const pathname=new URL(request.url).pathname
 const next=new Headers(response.headers)
 let frames="'none'"
 if(pathname==='/')try{frames=configuration(env).managementOrigin}catch{}
 // Do not override upstream script/nonces or other directives when a policy exists.
 const policy=next.get('Content-Security-Policy')
 const directives=(policy??"object-src 'none'; base-uri 'self'; frame-ancestors 'none'").split(';').map(v=>v.trim()).filter(Boolean)
 const retained=directives.filter(v=>!/^frame-src(?:\s|$)/i.test(v))
 next.set('Content-Security-Policy',[...retained,`frame-src ${frames}`].join('; '))
 next.set('Cache-Control','no-store, private, no-transform');next.append('Vary','Cookie')
 const document=new Response(response.body,{status:response.status,statusText:response.statusText,headers:next})
 if(!request.headers.has('cookie')||!await authority(env,request,identity).catch(()=>null))return document
 return new HTMLRewriter().on('head',{element(head){head.append('<meta name="nook-editor-owner" content="">',{html:true})}}).transform(document)
}
