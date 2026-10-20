import {noteRoute} from './notes/route'
import {mattermostEmojiRoute} from './imports/mattermost-emoji'
import {readableExportRoute} from './exit/routes'
import {broadcastRecipients} from './broadcast/recipients'
import {BroadcastConfirmation,BroadcastDenied,previewBroadcast} from './broadcast/audience'
import {broadcastPolicy,updateBroadcastPolicy,readIgnore,updateIgnore} from './broadcast/settings'
import {broadcastPresence} from './broadcast/presence'
import {unreads,markUnreads} from './platform/storage/unreads'
import {withDemo} from './base/modules/demo/index.mjs'
import {seedDemo} from './demo'
import {devices,register,remove,presence,revokeSession} from './push/devices'
import {authorizedPushSnapshot} from './push/snapshot'
import start from '@tanstack/react-start/server-entry'
import { Hono } from 'hono'
import { dispatch } from './base/dispatch'
import {AuthError} from './base/modules/operator-auth/index.mjs'
import { Fault, fail } from './family/team-chat/domain'
import { Repository, type Bindings } from './platform/repository.server'

import {ownerClaim} from './platform/owner-claim.server'
import {editorRoute,editorDocument} from './platform/editor.server'
import {importDoor} from './imports/door'
import {portabilityRoute} from './platform/portability.server'
import {signInRoute} from './platform/signin.server'
import {teamRoute} from './team/routes.server'
import {tokenRoute} from './integrations/tokens.server'
import {auditRoute} from './audit/log'
import {hasIntegrationToken,integrationPost,integrationRequest} from './integrations/post.server'
import {outcomeVersions} from './platform/storage/outcome-history'
import {readUpload} from './platform/storage/files'
export {ChatHub} from './platform/storage/live'
import {authRoute,operatorAuth,acceptsRequest,authBindings} from './platform/operator-auth.server'
import {firstRunResponse} from './base/setup'
import {lobbyResponse} from './base/lobby'
import {baseOwnerClaim,setupStateResponse} from './base/setup-state'
import {identity} from './identity'
import {notifySettings,updateNotifySettings} from './notify/preferences'
import {unsubscribeRoute} from './notify/unsubscribe'
import {theme} from './theme'
import {staticAssetResponse} from './base/static-assets'
import {deploymentHealth} from './base/deployment-health'
import {workspaceSnapshot,readAcknowledgement} from './platform/storage/workspace'
import {withRepository} from './platform/request.server'

const api = new Hono<{ Bindings: Bindings }>()
api.use('*', async (c,next) => { c.header('Cache-Control','no-store'); c.header('X-Content-Type-Options','nosniff'); await next() })
api.get('/health', async c => { operatorAuth(c.env); await c.env.DB.prepare('SELECT singleton FROM oa_bootstrap LIMIT 1').all();return c.json({status:'ok',...deploymentHealth(c.env)}) })
api.all('/api/*', async c => {
 const req = c.req.raw, url = new URL(req.url), repository = new Repository(c.env)
 let input: Record<string,any> = {}
 // NOOK-079: a request with an integration token is answered only by the token door.
 if(hasIntegrationToken(req)&&!integrationPost(req.method,url))return (await integrationRequest(c.env,req,{}))!
 if(req.method !== 'GET') {
  if(req.headers.get('origin') && req.headers.get('origin') !== url.origin) fail(403,'Origin denied')
  if(req.method==='POST' && /^\/api\/conversations\/[^/]+\/attachments$/.test(url.pathname) && req.headers.get('content-type')!=='application/json'){await repository.session(req.headers);const upload=await readUpload(req);return c.json(await repository.upload(req.headers,url.pathname.split('/')[3],upload))}
  if(req.headers.get('content-type') !== 'application/json') fail(415,'JSON required')
  const reader = req.body?.getReader(); let size = 0; const chunks: Uint8Array[] = []
  if(reader) { while(true) { const {done,value} = await reader.read(); if(done) break; size += value.length; if(size > (req.method==='POST' && /^\/api\/conversations\/[^/]+\/attachments$/.test(url.pathname) ? 36*1024*1024 : /^(?:\/api\/conversations\/[^/]+\/(?:messages|scheduled)|\/api\/(?:messages|scheduled)\/[^/]+)$/.test(url.pathname) ? 256*1024 : 65536)) { await reader.cancel(); fail(413,'Body too large') }; chunks.push(value) } }
  const bytes = new Uint8Array(size); let offset = 0; for(const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.length }
  try { input = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)) } catch { fail(400,'Invalid JSON') }
  if(!input || typeof input !== 'object' || Array.isArray(input)) fail(400,'JSON object required')
 }
 const p = url.pathname.split('/').filter(Boolean), action = p[1], id = p[2] ?? '', sub = p[3]
 if(hasIntegrationToken(req))return (await integrationRequest(c.env,req,input as Record<string,unknown>))!
 // Authentication precedes route matching, including unknown protected paths.
 const session=await repository.authenticated(req.headers),exit=await readableExportRoute(session,req,input);if(exit)return exit
 const team=await teamRoute(session,req,input);if(team)return team
 const tokens=await tokenRoute(session,req.method,p,input as Record<string,unknown>);if(tokens)return c.json(tokens)
 const audit=await auditRoute(session,req);if(audit)return audit
 if(action==='messages'&&id&&sub==='broadcast-recipients'&&p.length===4&&req.method==='GET')return c.json(await broadcastRecipients(session,id,url.searchParams.get('after')??''))
 if(action==='broadcast'&&id==='presence'&&p.length===3&&req.method==='GET')return c.json({away:!!(await session.one('SELECT away FROM nook_broadcast_choices WHERE user=?',[session.uid]))?.away})
 if(action==='broadcast'&&id==='presence'&&p.length===3&&req.method==='POST')return c.json(await broadcastPresence(session,input as Record<string,unknown>))
 if(action==='broadcast'&&id==='policy'&&p.length===3){if(req.method==='GET')return c.json(await broadcastPolicy(session,''));if(req.method==='PATCH')return c.json(await updateBroadcastPolicy(session,'',input))}
 if(action==='channels'&&id&&sub==='broadcast'&&p.length===4){if(req.method==='GET')return c.json(await broadcastPolicy(session,id));if(req.method==='PATCH')return c.json(await updateBroadcastPolicy(session,id,input))}
 if(action==='conversations'&&id&&sub==='broadcast-ignore'&&p.length===4){if(req.method==='GET')return c.json(await readIgnore(session,id));if(req.method==='PATCH')return c.json(await updateIgnore(session,id,input))}
 if(action==='conversations'&&id&&sub==='broadcast-preview'&&p.length===4&&req.method==='POST'){if(typeof (input as Record<string,any>).body!=='string'||(input as Record<string,any>).body.length>40000)fail(400,'Provide a message body');return c.json(await previewBroadcast(session,id,(input as Record<string,any>).body))}
 if(action==='unreads'&&p.length===2){if(req.method==='GET')return c.json(await unreads(session,Object.fromEntries(url.searchParams)));if(req.method==='POST')return c.json(await markUnreads(session,input))}
 if(action==='notify'&&id==='conversations'&&p.length===3&&req.method==='GET')return c.json(await repository.read(req.headers,'conversationNotifyExceptions'))
 if(action==='conversations'&&id&&sub==='notify'&&p.length===4){if(req.method==='GET')return c.json(await repository.read(req.headers,'conversationNotify',id));if(req.method==='PATCH')return c.json(await repository.write(req.headers,'conversationNotify',id,input))}
 if(action==='workspace'&&p.length===2&&req.method==='GET')return c.json(await workspaceSnapshot(session,url.searchParams))
 if(action==='conversations'&&id&&sub==='messages'&&p.length===4&&req.method==='POST'&&url.searchParams.get('workspace')==='1'){
  const message=await repository.write(req.headers,'messages',id,input),query=new URLSearchParams(url.searchParams);query.set('conversation',id)
  return c.json({message,workspace:await workspaceSnapshot(session,query)})
 }
 if(action==='conversations'&&id&&sub==='read'&&p.length===4&&req.method==='POST'){await repository.write(req.headers,'read',id,input);return c.json({ok:true,...await readAcknowledgement(session,id)})}
 if(action==='conversations'&&id&&sub==='notes'&&p.length>=4&&p.length<=6)return c.json(await noteRoute(session,req.method,id,p[4],p[5],url.searchParams,input))
 if(action==='devices'){
  if(req.method!=='GET'&&req.headers.get('origin')!==url.origin)fail(403,'Origin denied')
  if(p.length===2&&req.method==='GET')return c.json(await devices(session))
  if(p.length===2&&req.method==='POST')return c.json(await register(session,input))
  if(p.length===2&&req.method==='DELETE')return c.json(await remove(session,input))
  if(p.length===3&&id==='presence'&&req.method==='POST')return c.json(await presence(session,input))
  if(p.length===3&&id==='sync'&&req.method==='GET'){return c.json(await authorizedPushSnapshot(session))}
 }
 if(action==='notify'&&p.length===2&&req.method==='GET')return c.json(await notifySettings(session))
 if(action==='notify'&&p.length===2&&req.method==='PATCH')return c.json(await updateNotifySettings(session,input))
 if(action==='imports'&&id==='search'&&p.length===3&&req.method==='GET')return c.json(await repository.imports(req.headers,'search','',Object.fromEntries(url.searchParams)))
 if(action==='conversations'&&sub==='imported-history'&&p.length===4&&req.method==='GET')return c.json(await repository.imports(req.headers,'history',id,{after:url.searchParams.get('after')||'',limit:Number(url.searchParams.get('limit')||100)}))
 if(action==='import-files'&&sub==='download'&&p.length===4&&req.method==='GET'){const file=await repository.imports(req.headers,'file',id);return new Response(file.body,{headers:{'Content-Type':file.metadata.mime,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(file.metadata.name)}`,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'}})}
 if(action==='attachments'&&id&&p.length===4&&sub==='download'&&req.method==='GET'){const file=await repository.download(req.headers,id);return new Response(file.body,{headers:{'Content-Type':file.metadata.mime,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(file.metadata.name!)}`,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'}})}
 if(action==='conversations'&&sub==='messages'&&p[4]==='window'&&p.length===5&&req.method==='GET')return c.json(await repository.read(req.headers,'historyWindow',id,{limit:Number(url.searchParams.get('limit')||50),before:url.searchParams.get('before'),thread:url.searchParams.get('thread'),around:url.searchParams.get('around'),firstUnread:url.searchParams.get('firstUnread')==='1'}))
 if(action==='outcomes'&&id&&p.length===4&&sub==='versions'&&req.method==='GET')return c.json(await outcomeVersions(session,id,Number(url.searchParams.get('before')||0)))
 if(action==='messages'&&id&&p.length===3&&req.method==='GET')return c.json(await repository.read(req.headers,'message',id))
 let out: any
 if(action==='settings'&&p.length===2&&req.method==='PATCH')return c.json(await repository.write(req.headers,'settings','',input))
 if(action==='attention'&&id&&p.length===3&&req.method==='POST')return c.json(await repository.write(req.headers,'attentionAction',id,input))
 if(action==='threads'&&p.length===2&&req.method==='GET')return c.json(await repository.read(req.headers,'threads','',{after:url.searchParams.get('after')??'',limit:Number(url.searchParams.get('limit')||50)}))
 if(action==='messages'&&id&&p.length===4&&sub==='read'&&req.method==='POST')return c.json(await repository.write(req.headers,'threadRead',id,input))
 if(action==='messages'&&id&&p.length===4&&sub==='follow'&&req.method==='POST')return c.json(await repository.write(req.headers,'follow',id,input))
 if(action==='conversations'&&id&&p.length===4&&sub==='preferences'&&req.method==='PATCH')return c.json(await repository.write(req.headers,'preferences',id,input))
 if(action==='attachments'&&id&&p.length===3&&(req.method==='DELETE'||(req.method==='PATCH'&&(input as Record<string,any>).delete===true)))return c.json(await repository.deleteAttachment(req.headers,id))
 if(action === 'logout' && p.length === 2 && req.method === 'POST') { await revokeSession(session);const result=await operatorAuth(c.env).signOut(req);c.header('Set-Cookie',result.cookie);out={ok:true} }
 else if(['me','users','search','settings','attention'].includes(action) && p.length === 2 && req.method === 'GET') out = await repository.read(req.headers,action,'',Object.fromEntries(url.searchParams))
 else if(action === 'conversations' && p.length === 2) {
  if(req.method === 'GET') out = await repository.read(req.headers,action)
  if(req.method === 'POST') out = await repository.write(req.headers,action,'',input)
 } else if(action === 'conversations' && p.length === 4) {
  if(req.method === 'GET' && ['messages','replay','members','roster','outcomes','preferences'].includes(sub)) out = await repository.read(req.headers,sub,id,{after:sub === 'replay' ? Number(url.searchParams.get('after') || 0) : url.searchParams.get('after') || '',limit:Number(url.searchParams.get('limit') || 100)})
  if(req.method === 'POST' && sub==='attachments')out=await repository.upload(req.headers,id,input)
  if(req.method === 'POST' && ['messages','members','outcomes','read'].includes(sub)) out = await repository.write(req.headers,sub,id,input)
 } else if(req.method === 'PATCH' && p.length === 3 && ['messages','outcomes'].includes(action)) out = await repository.write(req.headers,action === 'messages' ? 'edit' : 'reviseOutcome',id,input)
 if(out === undefined) fail(404,'Not found')
 return c.json(out)
})
api.all('/api', async c => { await new Repository(c.env).session(c.req.raw.headers); return c.json({error:'Not found'},404) })
api.onError((error,c) => { const status = error instanceof Fault || error instanceof AuthError ? error.status : 500; if(status === 500) console.error(error); return c.json({error:status === 500 ? 'Internal error' : error.message,...(error instanceof BroadcastDenied?{code:error.code}:{}),...(error instanceof BroadcastConfirmation?{broadcast:error.broadcast}:{})},status as any) })
export default withDemo({
 async fetch(request,env,execution) {
  // Built files first: a hosted deploy runs this Worker before its assets.
  const asset = await staticAssetResponse(request,env)
  if(asset) return asset
  const publicEnv = authBindings(env)
  const state = await setupStateResponse(request,publicEnv)
  if(state) return state
  const lobby = await lobbyResponse(request,publicEnv,identity,baseOwnerClaim)
  if(lobby) return lobby
  const url = new URL(request.url),repository=new Repository(env)
  if(!acceptsRequest(env,request)) return new Response('Not found',{status:404})
  if(url.pathname==='/signin')return await signInRoute(env,request)??new Response('Not found',{status:404})
  if(url.pathname==='/notify/off') return unsubscribeRoute(env,request)
  if(url.pathname==='/auth/owner-claim') return await ownerClaim(env,request)??new Response('Not found',{status:404})
  if(url.pathname==='/api/editor/config'||url.pathname==='/api/editor/session') return editorRoute(env,request)
  if(url.pathname.startsWith('/api/mattermost-emoji/'))return (await mattermostEmojiRoute(request,env))!
  const imported = await importDoor(request,env)
  if(imported)return imported
  if(url.pathname==='/api/portability'||url.pathname.startsWith('/api/portability/'))return portabilityRoute(env,request)
  if(url.pathname==='/api/live'){if(request.headers.get('origin')!==url.origin)return new Response('Origin denied',{status:403});try{return await new Repository(env).live(request)}catch(error){return Response.json({error:error instanceof Error?error.message:'Live unavailable'},{status:error instanceof Fault?error.status:500})}}
  if(url.pathname==='/auth/bootstrap' && (await env.DB.prepare('SELECT authority FROM nook_storage WHERE id=1').first<{authority:string}>())?.authority!=='normalized')return Response.json({error:'offline_storage_conversion_required'},{status:503,headers:{'Cache-Control':'no-store'}})
  if(url.pathname==='/auth/bootstrap' && !await env.DB.prepare('SELECT singleton FROM oa_bootstrap WHERE singleton=1').first() && await env.DB.prepare('SELECT id FROM nook_actors LIMIT 1').first())return Response.json({error:'identity_recovery_required'},{status:409,headers:{'Cache-Control':'no-store'}})
  if(url.pathname.startsWith('/auth/')) return await authRoute(env,request)??new Response('Not found',{status:404})
  const application=url.pathname === '/app'||url.pathname.startsWith('/app/')
  const authentication=application?repository.authenticated(request.headers).then(()=>null,error=>error):null
  if(url.pathname === '/setup' || application) {
   // An owner who has not confirmed first-run setup is sent to /setup from every app route.
   const setup = await firstRunResponse(request,env,{getSession:()=>repository.nativeSession(request.headers)},{theme})
   if(setup) return setup
  }
  if(application) {
   const error=await authentication
   if(error){if(error instanceof Fault&&error.status===401)return new Response(null,{status:307,headers:{Location:'/signin','Cache-Control':'no-store'}});throw error}
  }
  const response = await dispatch(request,() => api.fetch(request,env,execution),() => withRepository(repository,()=>start.fetch(request)))
  const isDocument = response.headers.get('content-type')?.includes('text/html')
  const headers = new Headers(response.headers); headers.set('Cache-Control',isDocument?'no-store, no-transform':'no-store'); headers.set('X-Content-Type-Options','nosniff')
  const document=new Response(response.body,{status:response.status,statusText:response.statusText,headers})
  return isDocument?await editorDocument(document,env,request,application?repository.nativeSession(request.headers):undefined):document
 },
} satisfies ExportedHandler<Bindings>, {seed:seedDemo})
