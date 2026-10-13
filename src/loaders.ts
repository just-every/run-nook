import { createServerFn } from '@tanstack/react-start'
import { redirect } from '@tanstack/react-router'

// Parameterless transport: server modules are imported only inside the handler.
export const loadWorkspace = createServerFn({method:'GET'}).handler(async () => {
 const [{env},{getRequestHeaders},{Repository},{Fault}] = await Promise.all([
  import('cloudflare:workers'),import('@tanstack/react-start/server'),
  import('./platform/repository.server'),import('./family/team-chat/domain'),
 ])
 const {developmentMail} = await import('./platform/operator-auth.server')
 try { return {...await new Repository(env as unknown as import('./platform/repository.server').Bindings).workspace(getRequestHeaders()),developmentOutbox:developmentMail(env)} }
 catch(error) { if(error instanceof Fault && error.status === 401) throw redirect({to:'/signin'}); throw error }
})


// Public presentation capability only; never returns auth bindings or identity.
export const loadSignInConfiguration = createServerFn({method:'GET'}).handler(async () => {
 const [{env},{developmentMail}] = await Promise.all([import('cloudflare:workers'),import('./platform/operator-auth.server')])
 return {developmentOutbox:developmentMail(env)}
})
