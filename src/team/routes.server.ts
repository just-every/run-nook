import {convertGroup} from './group-conversion.server'
import {setSavedReminder} from './saved-reminders.server'
import {postingPermissions,updatePosting} from './posting.server'
import {importedAuthors} from './erasure/imported-directory'
import {erase,advance,preview as erasurePreview,receipt,pending} from './erasure/service'
import {Context} from '../platform/storage/context'
import {defaultChannels,updateDefaultChannels} from './default-channels.server'
import {browseChannels,joinChannel} from './channels.server'
import {channelDetails,updateChannel,transferChannel,archiveChannel,leaveChannel} from './channel-lifecycle.server'
import {reactions,react,reactionActors} from './reactions.server'
import {prepareInvitation,teamDirectory,regrant,removeAccess,cancelPreparation} from './invitations.server'
import {preview} from './preview.server'
import {listSaved,save,deleteSaved,pins,pin,deletePin,messageCollections} from './saved.server'
export async function teamRoute(c:Context,request:Request,input:Record<string,any>):Promise<Response|null>{
 const url=new URL(request.url),parts=url.pathname.split('/').filter(Boolean),method=request.method
 if(url.pathname==='/api/team/default-channels'){
  if(method==='GET')return Response.json(await defaultChannels(c))
  if(method==='PATCH')return Response.json(await updateDefaultChannels(c,input))
 }
 if(parts[1]==='conversations'&&parts.length===4&&parts[3]==='convert'&&method==='POST')return Response.json(await convertGroup(c,parts[2],input))
 if(parts[1]==='saved'){
  if(parts.length===2&&method==='GET')return Response.json(await listSaved(c,Object.fromEntries(url.searchParams)))
  if(parts.length===2&&method==='POST')return Response.json(await save(c,input))
  if(parts.length===3&&method==='PATCH')return Response.json(await setSavedReminder(c,parts[2],input))
  if(parts.length===3&&method==='DELETE')return Response.json(await deleteSaved(c,parts[2]))
 }
 if(parts[1]==='conversations'&&parts.length===4&&parts[3]==='pins'){
  if(method==='GET')return Response.json(await pins(c,parts[2],Object.fromEntries(url.searchParams)))
  if(method==='POST')return Response.json(await pin(c,parts[2],input))
 }
 if(parts[1]==='conversations'&&parts.length===5&&parts[3]==='pins'&&method==='DELETE')return Response.json(await deletePin(c,parts[2],parts[4]))
 if(parts[1]==='messages'&&parts.length===4&&parts[3]==='collections'&&method==='GET')return Response.json(await messageCollections(c,parts[2]))
 if(url.pathname.startsWith('/api/erasures')&&method!=='GET'&&request.headers.get('origin')!==url.origin)return Response.json({error:'Origin denied'},{status:403})
 if(url.pathname==='/api/erasures/imported-authors'&&method==='GET')return Response.json(await importedAuthors(c))
 if(url.pathname==='/api/erasures'&&method==='GET')return Response.json(await pending(c))
 if(url.pathname==='/api/erasures/preview'&&method==='POST')return Response.json(await erasurePreview(c,input.kind,input.target))
 if(url.pathname==='/api/erasures'&&method==='POST')return Response.json(await erase(c,input.kind,input.target,input))
 if(parts[1]==='erasures'&&parts.length===3&&method==='GET')return Response.json(await receipt(c,parts[2]))
 if(parts[1]==='erasures'&&parts.length===4&&parts[3]==='resume'&&method==='POST')return Response.json(await advance(c,parts[2]))
 if(url.pathname==='/api/team'&&method==='GET')return Response.json(await teamDirectory(c))
 if(url.pathname==='/api/team/invitations'&&method==='POST')return Response.json(await prepareInvitation(c,input))
 if(url.pathname==='/api/team/invitations/cancel-preparation'&&method==='POST')return Response.json(await cancelPreparation(c,input))
 if(url.pathname==='/api/team/access'&&method==='POST')return Response.json(await regrant(c,input))
 if(url.pathname==='/api/team/remove'&&method==='POST')return Response.json(await removeAccess(c,input))
 if(url.pathname==='/api/channels'&&method==='GET')return Response.json(await browseChannels(c,url.searchParams.get('after')??''))
 if(parts[1]==='channels'&&parts.length===3&&method==='PATCH')return Response.json(await updateChannel(c,parts[2],input))
 if(parts[1]==='channels'&&parts.length===4){
  if(parts[3]==='posting'&&method==='GET')return Response.json(await postingPermissions(c,parts[2]))
  if(parts[3]==='posting'&&method==='PATCH')return Response.json(await updatePosting(c,parts[2],input))
  if(parts[3]==='details'&&method==='GET')return Response.json(await channelDetails(c,parts[2]))
  if(parts[3]==='transfer'&&method==='POST')return Response.json(await transferChannel(c,parts[2],input))
  if(parts[3]==='archive'&&method==='POST')return Response.json(await archiveChannel(c,parts[2],input))
  if(parts[3]==='leave'&&method==='POST')return Response.json(await leaveChannel(c,parts[2],input))
 }
 if(parts.length===4&&parts[1]==='channels'&&parts[3]==='join'&&method==='POST')return Response.json(await joinChannel(c,parts[2]))
 if(parts.length===4&&parts[1]==='messages'&&parts[3]==='reaction-actors'&&method==='GET')return Response.json(await reactionActors(c,parts[2],url.searchParams.get('emoji')??'',url.searchParams.get('after')??''))
 if(parts.length===4&&parts[1]==='messages'&&parts[3]==='reactions'){
  if(method==='GET')return Response.json(await reactions(c,parts[2]))
  if(method==='POST')return Response.json(await react(c,parts[2],input))
 }
 if(parts.length===4&&parts[1]==='attachments'&&parts[3]==='preview'&&method==='GET')return preview(c,parts[2])
 return null
}
