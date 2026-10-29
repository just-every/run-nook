import {safeReturnTo} from '../base/modules/operator-auth/index.mjs'
import {acceptsRequest} from './operator-auth.server'
import {Repository,type Bindings} from './repository.server'
const entrances=['/','/signin','/login','/sign-in']
// An open session is never shown a sign-in prompt: the root and the sign-in pages send it to the workspace,
// or to the page it was signing in for.
export async function openSessionRedirect(request:Request,env:Bindings,repository=new Repository(env)){
 const url=new URL(request.url)
 if(request.method!=='GET'&&request.method!=='HEAD')return null
 if(!entrances.includes(url.pathname)||!request.headers.has('cookie')||!acceptsRequest(env,request))return null
 if(!await repository.authenticated(request.headers).then(()=>true,()=>false))return null
 return new Response(null,{status:307,headers:{Location:url.pathname==='/'?'/app':safeReturnTo(url.searchParams.get('returnTo')),'Cache-Control':'no-store'}})
}
