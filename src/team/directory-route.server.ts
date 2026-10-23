import {Context} from '../platform/storage/context'
import {directoryPage} from '../platform/storage/directories'
import {teamDirectory} from './invitations.server'
export async function directoryRoute(c:Context,request:Request){
 if(request.method!=='GET')return null
 const url=new URL(request.url),parts=url.pathname.split('/').filter(Boolean)
 const kind=url.pathname==='/api/users'?'users':url.pathname==='/api/team'?'team':parts.length===4&&parts[1]==='conversations'&&parts[3]==='members'?'members':null
 if(!kind)return null
 const page=await directoryPage(c,kind,kind==='members'?parts[2]:'',Object.fromEntries(url.searchParams))
 if(url.searchParams.has('page'))return Response.json(page)
 const legacyTeam=kind==='team'&&!url.searchParams.has('after'),items=legacyTeam?await teamDirectory(c):page.items
 return Response.json(items,{headers:{'X-Nook-Has-More':String(page.hasMore),'X-Nook-Next-Cursor':legacyTeam?'':page.cursor??'',Link:`<${url.pathname}?page=1>; rel="collection"`,...(page.warning?{'X-Nook-Directory-Warning':`${page.warning.bound}: ${page.warning.count} of ${page.warning.limit}`}:{})}})
}
