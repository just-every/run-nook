import {digestRoute} from '../digests/server'
import {auditRoute} from '../audit/server'
import {revisions as importedRevisions} from '../imports/revisions'
import {read} from '../platform/storage/read'
import {typing,updateTyping} from '../personal/typing.server'
import {personalWorkspace,updatePersonalWorkspace} from '../personal/workspace.server'
import {markUnread} from '../personal/mark-unread.server'
import {readProfile,writeProfile,listPeople,listFields,writeFields} from '../profiles/server'
import {listFiles} from '../files/server'
import {sentMessages} from '../personal/sent.server'
import {reminderPreview,createReminder,listReminders,changeReminder} from '../reminders/service'
import {listSchedules,createSchedule,changeSchedule,schedulePreview,scheduleOccurrences,scheduleAudience} from '../scheduled/service'
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
import {previewBulk,sendBulk,resendInvitation} from './bulk-invitations.server'
import {preview} from './preview.server'
import {listSaved,save,deleteSaved,pins,pin,deletePin,messageCollections} from './saved.server'
export async function teamRoute(c:Context,request:Request,input:Record<string,any>):Promise<Response|null>{
 const audit=await auditRoute(c,request);if(audit)return audit
 const url=new URL(request.url),parts=url.pathname.split('/').filter(Boolean),method=request.method
 if(parts.length===4&&parts[1]==='messages'&&parts[3]==='imported-revisions'&&method==='GET')return Response.json(await importedRevisions(c,parts[2]))
 if(parts.length===5&&parts[1]==='conversations'&&parts[3]==='messages'&&parts[4]==='latest-editable'&&method==='GET')return Response.json(await read(c,'latestEditable',parts[2],{thread:url.searchParams.get('thread')}))
 if(parts.length===4&&parts[1]==='conversations'&&parts[3]==='typing'){if(method==='GET')return Response.json(await typing(c,parts[2]));if(method==='POST')return Response.json(await updateTyping(c,parts[2],input))}
 if(url.pathname==='/api/personal/workspace'){if(method==='GET')return Response.json(await personalWorkspace(c));if(method==='POST')return Response.json(await updatePersonalWorkspace(c,input))}
 if(url.pathname==='/api/profile'){if(method==='GET')return Response.json(await readProfile(c,url.searchParams.get('user')??c.uid));if(method==='POST')return Response.json(await writeProfile(c,input))}
 if(url.pathname==='/api/people'&&method==='GET')return Response.json(await listPeople(c,url.searchParams))
 if(url.pathname==='/api/profile/fields'){if(method==='GET')return Response.json(await listFields(c));if(method==='POST')return Response.json(await writeFields(c,input))}
 if(parts.length===4&&parts[1]==='conversations'&&parts[3]==='mark-unread'&&method==='POST')return Response.json(await markUnread(c,parts[2]))
 if(url.pathname==='/api/files'&&method==='GET')return Response.json(await listFiles(c,Object.fromEntries(url.searchParams)))
 if(parts.length===4&&parts[1]==='conversations'&&parts[3]==='files'&&method==='GET')return Response.json(await listFiles(c,{...Object.fromEntries(url.searchParams),conversation:parts[2]}))
 if(url.pathname==='/api/sent'&&method==='GET')return Response.json(await sentMessages(c,url.searchParams.get('after')??''))
 if(parts[1]==='reminders'){
  if(parts.length===3&&parts[2]==='preview'&&method==='POST')return Response.json(await reminderPreview(c,input))
  if(parts.length===2&&method==='POST')return Response.json(await createReminder(c,input))
  if(parts.length===2&&method==='GET')return Response.json(await listReminders(c,url.searchParams.get('after')??''))
  if(parts.length===3&&method==='PATCH')return Response.json(await changeReminder(c,parts[2],input))
 }
 if(parts[1]==='digests'){return Response.json(await digestRoute(c,method,parts,input))}
 if(parts[1]==='scheduled'){
  if(parts.length===4&&parts[3]==='occurrences'&&method==='GET')return Response.json(await scheduleOccurrences(c,parts[2],url.searchParams.get('after')??''))
  if(parts.length===2&&method==='GET')return Response.json(await listSchedules(c,url.searchParams.get('after')??''))
  if(parts.length===3&&parts[2]==='preview'&&method==='POST')return Response.json(schedulePreview(input))
  if(parts.length===3&&method==='PATCH')return Response.json(await changeSchedule(c,parts[2],input))
 }
 if(parts[1]==='conversations'&&parts.length===4&&parts[3]==='scheduled-audience'&&method==='GET')return Response.json(await scheduleAudience(c,parts[2]))
 if(parts[1]==='conversations'&&parts.length===4&&parts[3]==='scheduled'&&method==='POST')return Response.json(await createSchedule(c,parts[2],input))
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
 if(url.pathname==='/api/team/invitations/preview'&&method==='POST')return Response.json(await previewBulk(c,input))
 if(url.pathname==='/api/team/invitations/bulk'&&method==='POST')return Response.json(await sendBulk(c,request,input))
 if(url.pathname==='/api/team/invitations/resend'&&method==='POST')return Response.json(await resendInvitation(c,request,input))
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
