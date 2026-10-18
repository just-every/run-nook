import {TeamBindings,useTeamRequest} from './team/TeamBindings'
import {TeamPanel} from './team/TeamPanel'
import {ChannelBrowser} from './team/ChannelBrowser'
import {PushControl} from './team/PushControl'
import {usePush} from './push/client'
import {clearPushNotices} from './push/notices'
import {EmailControl} from './team/EmailControl'
import {useTitleBadge} from './team/useTitleBadge'
import {ApiError} from './chat/api'
import './team/team.css'
import {useCallback,useEffect,useState} from 'react'
import {accentStyle} from './brand/accent'
import {NookFrame} from './brand/NookFrame'
import {NookMark} from './brand/NookMark'
import './brand/tokens.css'
import './app-style/tokens.css'
import './app-style/shell.css'
import './app-style/conversation.css'
import './app-style/outcomes.css'
import './app-style/pages.css'
import './app-style/controls.css'
import './brand/controls.css'
import './imports/imports.css'
import './app-style/reveal.css'
import './app-style/phone.css'
import type {Conversation,DialogState,InitialWorkspace,Outcome,Screen} from './chat/types'
import {useLocation} from './chat/location'
import {useWorkspace} from './chat/useWorkspace'
import {Sidebar,MobileTabs,ChatActions,ConversationList,conversationName} from './chat/Navigation'
import {IconBack,IconClose,IconForward,IconPlus} from './chat/icons'
import {ConversationView} from './chat/ConversationView'
import {AttentionView} from './chat/AttentionView'
import {ScheduledView} from './scheduled/ScheduledView'
import {AllUnreads} from './chat/AllUnreads'
import {useUnreadActions} from './chat/useUnreadActions'
import {ThreadsView} from './chat/ThreadsView'
import {SearchView} from './chat/SearchView'
import {SavedView} from './chat/SavedView'
import {Dialogs} from './chat/Dialogs'
import {Avatar} from './chat/Avatar'
import {messageWindow} from './chat/api'
import {useViewFocus} from './chat/useViewFocus'
import {LiveMessageNotice} from './chat/LiveMessageNotice'
import {QuickNavigation} from './chat/QuickNavigation'
import {NotificationExceptions} from './chat/ConversationNotifications'
import {clearUserDrafts} from './chat/drafts'
export function ChatScreen({initial}:{initial?:InitialWorkspace}) {
 // /app's server loader supplies only an authenticated, currently authorized workspace.
 // The separate sign-in route owns authentication; no client registration path exists.
 if(!initial)return <NookFrame id="auth" label="Skip to sign in"><h1>Nook</h1><p className="frame-lead">Sign in to your workspace.</p><div className="frame-actions"><a className="frame-primary" href="/signin">Go to sign in</a></div></NookFrame>
 return <Workspace initial={initial}/>
}
function Workspace({initial}:{initial:InitialWorkspace}) {
 const {route,navigate}=useLocation(initial.route),w=useWorkspace(initial,route,navigate),[dialog,setDialog]=useState<DialogState|null>(null)
 const [showUnreads,setShowUnreads]=useState(true)
 useEffect(()=>{setShowUnreads(localStorage.getItem('nook:unreads:'+w.user.id)!=='hidden')},[w.user.id])
 const c=w.conversations.find(c=>c.id===route.conversation),title=route.view==='chat'&&c?conversationName(c,w.user):({scheduled:'Scheduled messages',unreads:'All unreads',channels:'Channels',attention:'Attention',threads:'Threads',search:'Search',saved:'Saved',you:'You',team:'Team',chat:'Conversation'}[route.view])
 useEffect(()=>{if(c?.convertedTo&&(route.thread||route.focus))navigate({conversation:c.convertedTo})},[c?.convertedTo,route.thread,route.focus])
 useViewFocus(w.user.id,route,route.view!=='chat'||Boolean(w.data),w.privateSignal)
 useEffect(()=>{if(dialog&&w.user.mode==='guest'&&['new-message','new-channel'].includes(dialog.kind))setDialog(null)},[dialog,w.user.mode])
 useEffect(()=>{if(dialog&&['schedule','details','pins','notifications','edit','delete','outcome','revise'].includes(dialog.kind)&&route.conversation&&!c)setDialog(null)},[c,dialog,route.conversation])
 // Teammate admission does not advance a conversation's live frontier. Fetch
 // the current authorized roster whenever a people picker opens.
 useEffect(()=>{if(dialog&&['new-message','new-channel','details'].includes(dialog.kind))void w.refresh()},[dialog?.kind,w.refresh])
 const select=(c:Conversation)=>{navigate({view:'chat',conversation:c.id,thread:null,focus:null,panel:null,before:null,threadBefore:null});setDialog(null)}
 const nav=(view:Screen)=>{navigate({view,thread:null,focus:null,panel:null,before:null,threadBefore:null});setDialog(null)}
 const open=async(conversation:string,focus?:string|null,thread?:string|null)=>{
  try{
   let parent=thread||null
   if(focus&&!parent){const context=await messageWindow(conversation,{around:focus});parent=context.target?.root||null}
   navigate({view:'chat',conversation,thread:parent,focus:focus||null,panel:null,before:null,threadBefore:null});setDialog(null)
  }catch(e){w.onError(e)}
 }
 const request=useTeamRequest(w.accessEpoch,w.onError),onDenied=useCallback(()=>w.onError(new ApiError(403,'Conversation access changed')),[w.onError])
 const unreadActions=useUnreadActions(w.privateSignal,w.refresh,w.onError)
 const push=usePush(w.user.id,request,w.snapshot,w.privateSignal)
 useTitleBadge(w.user.id,w.attention.items.length+(w.attention.reminders?.items.length??0),w.attentionLoaded&&w.connected,`${title} · Nook`)
 const canCreate=w.user.mode==='member',canManage=canCreate&&['owner','admin'].includes(w.user.role??'')
 const discuss=(o:Outcome)=>{if(o.source)void open(o.conversation,o.source);else navigate({view:'chat',conversation:o.conversation,thread:null,focus:o.id,panel:'outcomes',before:null,threadBefore:null})}
 const action=(o:Outcome,action:string)=>w.mutate(`outcomes/${o.id}`,{version:o.version,action},'PATCH')
 const newMessage=()=>setDialog({kind:'new-message'}),newChannel=()=>setDialog({kind:'new-channel'})
 const caption=w.user.mode==='guest'?'Guest with selected channels':w.user.role==='owner'?'Owner':w.user.role==='admin'?'Admin':'Member'
 const teamPanel=<TeamPanel key={w.accessEpoch} request={request} channels={w.conversations} role={w.user.role!} userId={w.user.id} localDevelopment={initial.localDevelopment}/>
 return <TeamBindings.Provider value={{request,accessEpoch:w.accessEpoch,revision:w.data?.frontier??w.revision,onDenied}}><div className="nook-app" style={accentStyle} data-live-connected={w.connected}><a className="skip-link" href="#primary" onClick={e=>{e.preventDefault();document.getElementById('primary')?.focus()}}>Skip to conversation</a><div className="sr-only" role="status" aria-live="polite">{w.loading?'Loading conversation':''}</div>{route.view==='chat'&&<LiveMessageNotice key={w.user.id+':'+w.accessEpoch+':'+route.conversation+':'+route.thread} projection={w.data}/>}
  <div className="app"><Sidebar showUnreads={showUnreads} canCreate={canCreate} user={w.user} conversations={w.conversations} route={route} attentionCount={(w.attention.items.length+(w.attention.reminders?.items.length??0))} onNavigate={nav} onSelect={select} onNewMessage={newMessage} onNewChannel={newChannel}/>
   <main className="workspace" id="primary" tabIndex={-1}><header className="header"><div className="heading">
     {route.view==='chat'&&<button className="mobile-back icon-button" title="Channels" onClick={()=>nav('channels')}><IconBack/><span className="sr-only">Channels</span></button>}
     {(route.view==='team'||route.view==='saved')&&<button className="page-back icon-button" title="You" onClick={()=>nav('you')}><IconBack/><span className="sr-only">You</span></button>}
     <h1>{route.view==='chat'&&c&&c.kind!=='dm'&&<span className="title-prefix" aria-hidden="true">#</span>}{title}</h1>{route.view==='chat'&&c?.archived&&<span className="title-tag archived-tag">Archived</span>}{route.view==='chat'&&w.data?.preferences.muted&&<span className="title-tag">Muted</span>}</div>
    <div className="header-actions"><QuickNavigation markAll={unreadActions.mark} user={w.user} users={w.users} conversations={w.conversations} route={route} request={request} signal={w.privateSignal} modalOpen={Boolean(dialog)} select={select} nav={nav} open={open} refresh={w.refresh} error={w.onError} search={()=>navigate({view:'search',q:c?'in:#'+c.id:'',thread:null,focus:null,panel:null,before:null,threadBefore:null})}/>
     {route.view==='chat'&&c&&<ChatActions onSchedule={!c.archived&&!c.convertedTo?()=>setDialog({kind:'schedule'}):undefined} user={w.user} data={w.data} route={route} navigate={navigate} onDetails={()=>setDialog({kind:'details'})} onNotifications={()=>setDialog({kind:'notifications'})} onPins={c.kind!=='dm'?()=>setDialog({kind:'pins'}):undefined} onPreference={input=>void w.mutate(`conversations/${c.id}/preferences`,input,'PATCH').catch(()=>{})}/>}
     {route.view==='channels'&&canCreate&&<><button className="soft-button" onClick={newMessage}><IconPlus/>New message</button><button className="soft-button" onClick={newChannel}><IconPlus/>Create channel</button></>}
    </div></header>
    {unreadActions.notice}
    {w.error&&<div className="notice-error" role="alert"><span>{w.error==='Internal error'?'Something went wrong on our side. Nothing you wrote was lost.':w.error}</span><button className="icon-button" title="Dismiss" onClick={()=>w.setError('')}><IconClose/><span className="sr-only">Dismiss</span></button></div>}
    {route.view==='chat'&&(c&&w.data?<ConversationView key={w.user.id+':'+w.accessEpoch} privateSignal={w.privateSignal} conversationCurrent={w.conversationCurrent} threadCurrent={w.threadCurrent} user={w.user} conversation={c} data={w.data} route={route} navigate={navigate} openDialog={setDialog} refresh={w.refresh} beginWrite={w.beginWrite} sendMessage={w.sendMessage} onRead={w.onRead} mutate={w.mutate} onError={w.onError} onAction={action} onDiscuss={discuss}/>:<div className="empty-state"><NookMark/>{w.loading||(c&&!w.error)?<p>Loading conversation…</p>:<>{!w.error&&<p>Choose an available conversation.</p>}<button className="soft-button" onClick={()=>nav('channels')}>Browse channels</button></>}</div>)}
    {route.view==='channels'&&<section className={'page-content channels-page'+(canCreate?' has-directory':'')}><div className="page-column">{canManage&&<div className="channel-invite"><button className="soft-button" onClick={()=>nav('team')}>Invite teammates</button><p>Give someone access to your team’s channels.</p></div>}<ConversationList conversations={w.conversations} user={w.user} current={null} onSelect={select}/>{!w.conversations.length&&<div className="empty-state"><NookMark/><h3>A little room for your team</h3><p>{canCreate?'Create a channel or message a teammate to get started.':'Your invited channels will appear here.'}</p></div>}{canCreate&&<ChannelBrowser key={w.accessEpoch} request={request} initial={w.snapshot?.channelPage} onJoined={id=>{void w.refresh().then(()=>open(id))}}/>}</div></section>}
    {route.view==='attention'&&<AttentionView attention={w.attention} user={w.user} conversations={w.conversations} onOpen={(id,focus,thread)=>void open(id,focus,thread)} onAction={action} onDiscuss={discuss} onRevise={outcome=>{navigate({conversation:outcome.conversation});setDialog({kind:'revise',outcome})}} mutate={w.mutate}/>}
    {route.view==='scheduled'&&<ScheduledView key={w.accessEpoch} revision={w.revision} privateSignal={w.privateSignal} onError={w.onError} onOpen={(id,message,thread)=>void open(id,message,thread)} refresh={w.refresh}/>}
    {route.view==='unreads'&&<AllUnreads key={w.accessEpoch} user={w.user} conversations={w.conversations} revision={w.revision} privateSignal={w.privateSignal} onOpen={(id,message,thread)=>void open(id,message,thread)} onError={w.onError} mark={unreadActions.mark} busy={unreadActions.busy}/>}
    {route.view==='threads'&&<ThreadsView key={w.accessEpoch} user={w.user} conversations={w.conversations} revision={w.revision} privateSignal={w.privateSignal} refresh={w.refresh} beginWrite={w.beginWrite} onOpen={(id,focus,thread)=>void open(id,focus,thread)} onError={w.onError}/>}
    {route.view==='saved'&&<SavedView key={w.accessEpoch} user={w.user} conversations={w.conversations} revision={w.revision} privateSignal={w.privateSignal} onOpen={(id,focus,thread)=>void open(id,focus,thread)} onError={w.onError}/>}
    {route.view==='search'&&<SearchView key={w.accessEpoch} users={w.users} privateSignal={w.privateSignal} conversations={w.conversations} user={w.user} query={route.q} revision={w.revision} onQuery={q=>navigate({q})} onOpen={(id,focus,thread)=>void open(id,focus,thread)} onError={w.onError}/>}
    {route.view==='you'&&<section className="page-content profile-page"><div className="page-column"><button className="profile-link" onClick={()=>nav('scheduled')}>Scheduled messages<IconForward/></button><button className="profile-link" onClick={()=>nav('unreads')}>All unreads<IconForward/></button><label className="check"><input type="checkbox" checked={showUnreads} onChange={e=>{setShowUnreads(e.target.checked);localStorage.setItem('nook:unreads:'+w.user.id,e.target.checked?'shown':'hidden')}}/>Show All unreads in the sidebar</label><div className="profile-head"><Avatar person={w.user} size={48}/><div><h2>{w.user.name}</h2><p>{caption}</p></div></div><div className="profile-row"><button className="profile-link" onClick={()=>nav('saved')}>Saved<IconForward/></button></div><NotificationExceptions privateSignal={w.privateSignal} revision={w.revision} onOpen={id=>{navigate({view:'chat',conversation:id,thread:null,focus:null,panel:null,before:null,threadBefore:null});setDialog({kind:'notifications'})}} onError={w.onError}/><PushControl push={push}/><EmailControl key={w.accessEpoch} request={request} initial={w.snapshot?.notify} localDevelopment={initial.localDevelopment}/>{canManage&&<div className="profile-row"><button className="profile-link" onClick={()=>nav('team')}>Team<IconForward/></button></div>}{w.user.role==='owner'&&<div className="profile-row"><a className="profile-link" href="/imports">Import Slack history<IconForward/></a></div>}<div className="profile-row"><button className="soft-button" onClick={()=>{void (async()=>{await clearPushNotices();if(push.enabled)await push.disable().catch(()=>{});return w.mutate('logout',{})})().then(()=>{w.clearPrivate();clearUserDrafts(w.user.id);sessionStorage.clear();location.assign('/signin')}).catch(()=>{})}}>Sign out</button></div></div></section>}
    {route.view==='team'&&(canManage?<section className="page-content team-page"><div className="page-column">{teamPanel}</div></section>:<div className="empty-state"><p>Only owners and admins manage the team.</p><button className="soft-button" onClick={()=>nav('you')}>Back to You</button></div>)}
   </main><MobileTabs view={route.view} attentionCount={(w.attention.items.length+(w.attention.reminders?.items.length??0))} onNavigate={nav}/>
  </div>
  {dialog&&((canCreate&&['new-message','new-channel'].includes(dialog.kind))||Boolean(c&&w.data))&&<Dialogs key={w.accessEpoch+':'+dialog.kind+':'+c?.id} privateSignal={w.privateSignal} revision={w.revision} onOpen={(id,focus,thread)=>void open(id,focus,thread)} onError={w.onError} dialog={dialog} close={()=>setDialog(null)} user={w.user} users={w.users} conversation={c} data={w.data} mutate={w.mutate} refresh={w.refresh} onLeft={()=>{w.clearPrivate();navigate({view:'channels',conversation:null,thread:null,focus:null,panel:null,before:null,threadBefore:null});setDialog(null)}} onCreated={select}/>}
 </div></TeamBindings.Provider>
}
