import { createServerFn } from '@tanstack/react-start';
import { redirect } from '@tanstack/react-router';
export const loadImports = createServerFn({ method: 'GET' }).handler(async () => {
 const [{env},{getRequestHeaders},{ownerAccess,people},{history},{Fault}] = await Promise.all([import('cloudflare:workers'),import('@tanstack/react-start/server'),import('./door-access'),import('./door-history'),import('../family/team-chat/domain')]);
 try {
  const headers=getRequestHeaders(),request=new Request((env as any).AUTH_ORIGIN+'/imports',{headers});
  const {c}=await ownerAccess(env as any,request);
  return {owner:c.uid,users:await people(c.db),...await history(c)};
 }catch(error){if(error instanceof Fault&&error.status===401)throw redirect({href:'/signin'});throw error;}
});
