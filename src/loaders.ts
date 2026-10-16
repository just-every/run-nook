import { createServerFn } from '@tanstack/react-start'
import { redirect } from '@tanstack/react-router'

// Parameterless transport: server modules are imported only inside the handler.
export const loadWorkspace = createServerFn({method:'GET'}).handler(async () => {
 const [{env},{getRequestHeaders,getRequestUrl},{Repository},{Fault},{readLocation}] = await Promise.all([
  import('cloudflare:workers'),import('@tanstack/react-start/server'),
  import('./platform/repository.server'),import('./family/team-chat/domain'),
  import('./chat/location'),
 ])
 const {developmentMail} = await import('./platform/operator-auth.server')
 try { return {...await new Repository(env as unknown as import('./platform/repository.server').Bindings).workspace(getRequestHeaders()),route:readLocation(new URL(getRequestUrl()).search),localDevelopment:developmentMail(env)} }
 catch(error) { if(error instanceof Fault && error.status === 401) throw redirect({href:'/signin'}); throw error }
})
