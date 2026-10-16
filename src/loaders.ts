import {createServerFn} from '@tanstack/react-start'
import {redirect} from '@tanstack/react-router'

// Parameterless transport: server modules are imported only inside the handler.
export const loadWorkspace=createServerFn({method:'GET'}).handler(async()=>{
 const [{env},{getRequestHeaders,getRequestUrl},{requestRepository},{Fault},{readLocation},{workspaceSnapshot},{windowKey}]=await Promise.all([
  import('cloudflare:workers'),import('@tanstack/react-start/server'),
  import('./platform/request.server'),import('./family/team-chat/domain'),
  import('./chat/location'),import('./platform/storage/workspace'),import('./chat/api'),
 ])
 const {developmentMail}=await import('./platform/operator-auth.server')
 try{
  const query=new URL(getRequestUrl()).searchParams,route=readLocation(query.toString())
  if(route.landing)query.set('landing','1')
  const value=await workspaceSnapshot(await requestRepository().authenticated(getRequestHeaders()),query)
  const snapshot={...value,data:value.data?{...value.data,key:windowKey(route)}:null}
  return {user:snapshot.user,conversations:snapshot.conversations,route,snapshot,localDevelopment:developmentMail(env)}
 }catch(error){if(error instanceof Fault&&error.status===401)throw redirect({href:'/signin'});throw error}
})
