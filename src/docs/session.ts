import {createServerFn} from '@tanstack/react-start'

// Whether the reader of an installation's docs has an open session, so the header offers the workspace instead of Sign in.
// Parameterless transport: server modules are imported only inside the handler.
export const readOpenSession=createServerFn({method:'GET'}).handler(async()=>{
 const [{getRequestHeaders},{requestRepository}]=await Promise.all([import('@tanstack/react-start/server'),import('../platform/request.server')])
 return requestRepository().authenticated(getRequestHeaders()).then(()=>true,()=>false)
})
