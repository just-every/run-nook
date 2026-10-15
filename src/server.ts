import {withDemo} from './base/modules/demo/index.mjs'
import {seedDemo} from './demo'
import {devices,register,remove,presence,revokeSession} from './push/devices'
import {pushSnapshot} from './push/run'
import start from '@tanstack/react-start/server-entry'
import { Hono } from 'hono'
import { dispatch } from './base/dispatch'
import {AuthError} from './base/modules/operator-auth/index.mjs'
import { Fault, fail } from './family/team-chat/domain'
import { Repository, type Bindings } from './platform/repository.server'

import {ownerClaim} from './platform/owner-claim.server'
import {editorRoute,editorDocument} from './platform/editor.server'
import {slackImportRoute} from './imports/routes'
import {portabilityRoute} from './platform/portability.server'
import {teamRoute} from './team/routes.server'
import {context} from './platform/storage/context'
import {outcomeVersions} from './platform/storage/outcome-history'
import {readUpload} from './platform/storage/files'
export {ChatHub} from './platform/storage/live'
import {authRoute,outboxRoute,operatorAuth,acceptsRequest,authBindings} from './platform/operator-auth.server'
import {firstRunResponse} from './base/setup'
import {lobbyResponse} from './base/lobby'
import {setupStateResponse} from './base/setup-state'
import {identity} from './identity'
import {notifySettings,updateNotifySettings} from './notify/preferences'
import {unsubscribeRoute} from './notify/unsubscribe'
import {theme} from './theme'
import {staticAssetResponse} from './base/static-assets'
import {deploymentHealth} from './base/deployment-health'

const api = new Hono<{ Bindings: Bindings }>()
api.use('*', async (c,next) => { c.header('Cache-Control','no-store'); c.header('X-Content-Type-Options','nosniff'); await next() })
api.get('/health', async c => { operatorAuth(c.env); await c.env.DB.prepare('SELECT singleton FROM oa_bootstrap LIMIT 1').all();await c.env.DB.prepare('SELECT id FROM rer_mail_development_outbox LIMIT 1').all();return c.json({status:'ok',...deploymentHealth(c.env)}) })
api.all('/api/*', async c => {
 const req = c.req.raw, url = new URL(req.url), repository = new Repository(c.env)
 let input: Record<string,any> = {}
 if(req.method !== 'GET') {
  if(req.headers.get('origin') && req.headers.get('origin') !== url.origin) fail(403,'Origin denied')
  if(req.method==='POST' && /^\/api\/conversations\/[^/]+\/attachments$/.test(url.pathname) && req.headers.get('content-type')!=='application/json'){await repository.session(req.headers);const upload=await readUpload(req);return c.json(await repository.upload(req.headers,url.pathname.split('/')[3],upload))}
  if(req.headers.get('content-type') !== 'application/json') fail(415,'JSON required')
  const reader = req.body?.getReader(); let size = 0; const chunks: Uint8Array[] = []
  if(reader) { while(true) { const {done,value} = await reader.read(); if(done) break; size += value.length; if(size > (req.method==='POST' && /^\/api\/conversations\/[^/]+\/attachments$/.test(url.pathname) ? 36*1024*1024 : /^\/api\/imports\/(preview|apply)$/.test(url.pathname) ? 41*1024*1024 : 65536)) { await reader.cancel(); fail(413,'Body too large') }; chunks.push(value) } }
  const bytes = new Uint8Array(size); let offset = 0; for(const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.length }
  try { input = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)) } catch { fail(400,'Invalid JSON') }
  if(!input || typeof input !== 'object' || Array.isArray(input)) fail(400,'JSON object required')
 }
 const p = url.pathname.split('/').filter(Boolean), action = p[1], id = p[2] ?? '', sub = p[3]
 // Authentication precedes route matching, including unknown protected paths.
 const session=await context(c.env,req.headers),team=await teamRoute(session,req,input);if(team)return team
 if(action==='devices'){
  if(req.method!=='GET'&&req.headers.get('origin')!==url.origin)fail(403,'Origin denied')
  if(p.length===2&&req.method==='GET')return c.json(await devices(session))
  if(p.length===2&&req.method==='POST')return c.json(await register(session,input))
  if(p.length===2&&req.method==='DELETE')return c.json(await remove(session,input))
  if(p.length===3&&id==='presence'&&req.method==='POST')return c.json(await presence(session,input))
  if(p.length===3&&id==='sync'&&req.method==='GET'){const snapshot=await pushSnapshot(session.env,session.uid);await session.check();return c.json(snapshot)}
 }
 if(action==='notify'&&p.length===2&&req.method==='GET')return c.json(await notifySettings(session))
 if(action==='notify'&&p.length===2&&req.method==='PATCH')return c.json(await updateNotifySettings(session,input))
 if(action==='imports'&&p.length===3&&['preview','apply'].includes(id)&&req.method==='POST')return c.json(await repository.imports(req.headers,id,'',input))
 if(action==='imports'&&id==='search'&&p.length===3&&req.method==='GET')return c.json(await repository.imports(req.headers,'search','',{q:url.searchParams.get('q'),after:url.searchParams.get('after')??''}))
 if(action==='conversations'&&sub==='imported-history'&&p.length===4&&req.method==='GET')return c.json(await repository.imports(req.headers,'history',id,{after:url.searchParams.get('after')||'',limit:Number(url.searchParams.get('limit')||100)}))
 if(action==='import-files'&&sub==='download'&&p.length===4&&req.method==='GET'){const file=await repository.imports(req.headers,'file',id);return new Response(file.body,{headers:{'Content-Type':file.metadata.mime,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(file.metadata.name)}`,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'}})}
 if(action==='attachments'&&id&&p.length===4&&sub==='download'&&req.method==='GET'){const file=await repository.download(req.headers,id);return new Response(file.body,{headers:{'Content-Type':file.metadata.mime,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(file.metadata.name!)}`,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'}})}
 if(action==='conversations'&&sub==='messages'&&p[4]==='window'&&p.length===5&&req.method==='GET')return c.json(await repository.read(req.headers,'historyWindow',id,{limit:Number(url.searchParams.get('limit')||50),before:url.searchParams.get('before'),thread:url.searchParams.get('thread'),around:url.searchParams.get('around'),firstUnread:url.searchParams.get('firstUnread')==='1'}))
 if(action==='outcomes'&&id&&p.length===4&&sub==='versions'&&req.method==='GET')return c.json(await outcomeVersions(session,id,Number(url.searchParams.get('before')||0)))
 if(action==='messages'&&id&&p.length===3&&req.method==='GET')return c.json(await repository.read(req.headers,'message',id))
 let out: any
 if(action==='settings'&&p.length===2&&req.method==='PATCH')return c.json(await repository.write(req.headers,'settings','',input))
 if(action==='attention'&&id&&p.length===3&&req.method==='POST')return c.json(await repository.write(req.headers,'attentionAction',id,input))
 if(action==='messages'&&id&&p.length===4&&sub==='follow'&&req.method==='POST')return c.json(await repository.write(req.headers,'follow',id,input))
 if(action==='conversations'&&id&&p.length===4&&sub==='preferences'&&req.method==='PATCH')return c.json(await repository.write(req.headers,'preferences',id,input))
 if(action==='attachments'&&id&&p.length===3&&(req.method==='DELETE'||(req.method==='PATCH'&&(input as Record<string,any>).delete===true)))return c.json(await repository.deleteAttachment(req.headers,id))
 if(action === 'logout' && p.length === 2 && req.method === 'POST') { await revokeSession(session);const result=await operatorAuth(c.env).signOut(req);c.header('Set-Cookie',result.cookie);out={ok:true} }
 else if(['me','users','search','settings','attention'].includes(action) && p.length === 2 && req.method === 'GET') out = await repository.read(req.headers,action,'',{q:url.searchParams.get('q'),after:url.searchParams.get('after')??''})
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
api.onError((error,c) => { const status = error instanceof Fault || error instanceof AuthError ? error.status : 500; if(status === 500) console.error(error); return c.json({error:status === 500 ? 'Internal error' : error.message},status as any) })
export default withDemo({
 async fetch(request,env,execution) {
  // Built files first: a hosted deploy runs this Worker before its assets.
  const asset = await staticAssetResponse(request,env)
  if(asset) return asset
  const publicEnv = authBindings(env)
  const state = await setupStateResponse(request,publicEnv)
  if(state) return state
  const lobby = await lobbyResponse(request,publicEnv,identity)
  if(lobby) return lobby
  const url = new URL(request.url)
  if(!acceptsRequest(env,request)) return new Response('Not found',{status:404})
  if(url.pathname==='/notify/off') return unsubscribeRoute(env,request)
  if(url.pathname==='/auth/owner-claim') return await ownerClaim(env,request)??new Response('Not found',{status:404})
  if(url.pathname==='/api/editor/config'||url.pathname==='/api/editor/session') return editorRoute(env,request)
  if(url.pathname==='/api/slack-imports'||url.pathname.startsWith('/api/slack-imports/'))return (await slackImportRoute(request,env))!
  if(url.pathname==='/api/portability'||url.pathname.startsWith('/api/portability/'))return portabilityRoute(env,request)
  if(url.pathname==='/api/live'){if(request.headers.get('origin')!==url.origin)return new Response('Origin denied',{status:403});try{return await new Repository(env).live(request)}catch(error){return Response.json({error:error instanceof Error?error.message:'Live unavailable'},{status:error instanceof Fault?error.status:500})}}
  if(url.pathname==='/auth/bootstrap' && (await env.DB.prepare('SELECT authority FROM nook_storage WHERE id=1').first<{authority:string}>())?.authority!=='normalized')return Response.json({error:'offline_storage_conversion_required'},{status:503,headers:{'Cache-Control':'no-store'}})
  if(url.pathname==='/auth/bootstrap' && !await env.DB.prepare('SELECT singleton FROM oa_bootstrap WHERE singleton=1').first() && await env.DB.prepare('SELECT id FROM nook_actors LIMIT 1').first())return Response.json({error:'identity_recovery_required'},{status:409,headers:{'Cache-Control':'no-store'}})
  if(url.pathname.startsWith('/auth/')) return await authRoute(env,request)??new Response('Not found',{status:404})
  if(url.pathname==='/__dev/key'||url.pathname==='/__dev/outbox'||url.pathname.startsWith('/__dev/outbox/')) return await outboxRoute(env,request)??new Response('Not found',{status:404})
  if(url.pathname === '/setup' || url.pathname === '/app' || url.pathname.startsWith('/app/')) {
   // An owner who has not confirmed first-run setup is sent to /setup from every app route.
   const setup = await firstRunResponse(request,env,operatorAuth(env),{theme})
   if(setup) return setup
  }
  if(url.pathname === '/app' || url.pathname.startsWith('/app/')) {
   try { await new Repository(env).session(request.headers) } catch(error) { if(error instanceof Fault && error.status === 401) return new Response(null,{status:307,headers:{Location:'/signin','Cache-Control':'no-store'}}); throw error }
  }
  const response = await dispatch(request,() => api.fetch(request,env,execution),() => start.fetch(request))
  const isDocument = response.headers.get('content-type')?.includes('text/html')
  const headers = new Headers(response.headers); headers.set('Cache-Control',isDocument?'no-store, no-transform':'no-store'); headers.set('X-Content-Type-Options','nosniff')
  const document=new Response(response.body,{status:response.status,statusText:response.statusText,headers})
  return isDocument?await editorDocument(document,env,request):document
 },
} satisfies ExportedHandler<Bindings>, {seed:seedDemo})
