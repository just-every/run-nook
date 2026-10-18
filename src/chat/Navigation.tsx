import {useRef} from 'react'
import type {Conversation,LocationState,Person,Preferences,Projection,Screen} from './types'
import {Avatar} from './Avatar'
import {IconMore,IconPlus} from './icons'
import {useDismiss} from './useDismiss'
import {NookMark} from '../brand/NookMark'
export function conversationName(c:Conversation,user:Person){return c.kind==='dm'&&c.participants?c.participants.filter(p=>p.id!==user.id).map(p=>p.name).join(', ')||c.name:c.name}
type Create={channel:()=>void;dm:()=>void}
// The rail passes onCreate: each group heading then carries a "+" that appears on hover or focus (and is always there for keyboards).
export function ConversationList({conversations,user,current,onSelect,onCreate}:{conversations:Conversation[];user:Person;current:string|null;onSelect:(c:Conversation)=>void;onCreate?:Create}) {
 return <>{(['channel','dm'] as const).map(kind=>{
  const items=conversations.filter(c=>kind==='dm'?c.kind==='dm':c.kind!=='dm'),add=kind==='dm'?onCreate?.dm:onCreate?.channel,label=kind==='dm'?'New message':'Create channel'
  if(!items.length&&!add)return null
  return <div className="conversation-group reveal-host" key={kind}><div className="group-heading"><h2>{kind==='dm'?'Direct messages':'Channels'}</h2>{add&&<button className="icon-button reveal" title={label} onClick={add}><IconPlus/><span className="sr-only">{label}</span></button>}</div>{items.map(c=><button key={c.id} className={'conversation-link'+(c.id===current?' selected':'')+(c.unread>0?' unread':'')} onClick={()=>onSelect(c)}>{c.kind==='dm'?<Avatar person={c.participants?.find(p=>p.id!==user.id)||{id:c.id,name:conversationName(c,user)}} size={22}/>:<span className="channel-prefix" aria-hidden="true">#</span>}<span>{conversationName(c,user)}</span>{c.unread>0&&<span className="count" aria-label={`${c.unread} unread`}>{c.unread}</span>}</button>)}</div>
 })}</>
}
export function Sidebar({user,conversations,route,attentionCount,onNavigate,onSelect,onNewMessage,onNewChannel,canCreate=true,showUnreads=true}:{showUnreads?:boolean;user:Person;canCreate?:boolean;conversations:Conversation[];route:LocationState;attentionCount:number;onNavigate:(v:Screen)=>void;onSelect:(c:Conversation)=>void;onNewMessage:()=>void;onNewChannel:()=>void}) {
 return <aside className="sidebar"><a className="workspace-brand" href="/" aria-label="Nook home"><span className="nook-wordmark"><NookMark/><span data-rer-name aria-hidden="true">Nook</span></span></a><nav className="workspace-nav" aria-label="Workspace">{(['drafts','reminders','scheduled','unreads','attention','threads','channels','search','saved'] as const).filter(v=>v!=='unreads'||showUnreads).map(v=><button key={v} className={route.view===v?'selected':''} onClick={()=>onNavigate(v)}>{v==='drafts'?'Drafts & sent':v==='reminders'?'Reminders':v==='scheduled'?'Scheduled':v==='unreads'?'All unreads':v==='attention'?'Attention':v==='threads'?'Threads':v==='channels'?'Channels':v==='saved'?'Saved':'Search'}{v==='attention'&&attentionCount>0&&<span className="count">{attentionCount}</span>}</button>)}</nav>{user.mode==='member'&&['owner','admin'].includes(user.role??'')&&<div className="workspace-nav"><button onClick={()=>onNavigate('team')}>Invite teammates</button></div>}<div className="sidebar-conversations"><ConversationList conversations={conversations} user={user} current={route.view==='chat'?route.conversation:null} onSelect={onSelect} onCreate={canCreate?{channel:onNewChannel,dm:onNewMessage}:undefined}/></div><button className={'profile'+(route.view==='you'||route.view==='team'?' selected':'')} onClick={()=>onNavigate('you')}><Avatar person={user} size={28}/><span>{user.name}</span><span className="sr-only">Your profile</span></button></aside>
}
export function MobileTabs({view,attentionCount,onNavigate}:{view:Screen;attentionCount:number;onNavigate:(v:Screen)=>void}) {
 return <nav className="mobile-tabs" aria-label="Workspace">{(['attention','threads','channels','search','you'] as const).map(v=><button key={v} aria-current={v===view||(v==='you'&&['team','saved','unreads','scheduled','reminders','drafts'].includes(view))?'page':undefined} onClick={()=>onNavigate(v)}>{v==='you'?'You':v[0].toUpperCase()+v.slice(1)}{v==='attention'&&attentionCount>0&&<span className="count">{attentionCount}</span>}</button>)}</nav>
}
// The chat view's header actions: the Decisions & requests toggle, the one Details door (the member avatars), and the options menu.
function ConversationMenu({preferences,onPreference,onPins,onNotifications,onSchedule}:{onSchedule?:()=>void;preferences:Preferences;onPins?:()=>void;onNotifications?:()=>void;onPreference:(input:{followed:boolean}|{muted:boolean})=>void}) {
 const menu=useRef<HTMLDetailsElement>(null)
 useDismiss(menu)
 const choose=(input:{followed:boolean}|{muted:boolean})=>{if(menu.current)menu.current.open=false;onPreference(input)}
 return <details className="conversation-menu menu" ref={menu}><summary className="icon-button" title="Conversation options"><IconMore/><span className="sr-only">Conversation options</span></summary><div className="popover end">{onSchedule&&<button onClick={()=>{if(menu.current)menu.current.open=false;onSchedule()}}>Schedule message</button>}{onNotifications&&<button onClick={()=>{if(menu.current)menu.current.open=false;onNotifications()}}>Notification settings</button>}{onPins&&<button onClick={()=>{if(menu.current)menu.current.open=false;onPins()}}>Pinned messages</button>}<button onClick={()=>choose({followed:!preferences.followed})}>{preferences.followed?'Unfollow conversation':'Follow conversation'}</button><button onClick={()=>choose({muted:!preferences.muted})}>{preferences.muted?'Unmute conversation':'Mute conversation'}</button></div></details>
}
export function ChatActions({user,data,route,navigate,onDetails,onPreference,onPins,onNotifications,onSchedule}:{onSchedule?:()=>void;user:Person;data:Projection|null;route:LocationState;navigate:(next:Partial<LocationState>)=>void;onDetails:()=>void;onPins?:()=>void;onNotifications?:()=>void;onPreference:(input:{followed:boolean}|{muted:boolean})=>void}) {
 const outcomes=data?.outcomes||[],members=data?.members||[]
 const open=outcomes.filter(o=>o.status!=='cancelled'&&o.status!=='reported-complete').length
 const waiting=outcomes.some(o=>o.assignee===user.id&&(o.status==='proposed'||o.status==='accepted'))
 const showing=route.panel==='outcomes'
 return <>
  <button className="decisions-toggle soft-button" aria-expanded={showing} aria-controls={data?'decisions-panel':undefined} onClick={()=>navigate({panel:showing?null:'outcomes',landing:route.landing,...(showing?{focus:null}:{})})}><span className="decisions-label">Decisions &amp; requests</span>{open>0&&<><span className="header-count" aria-hidden="true">{open}</span><span className="sr-only">, {open} open</span></>}{waiting&&<><span className="needs-you-dot" aria-hidden="true"/><span className="sr-only">, waiting on you</span></>}</button>
  <button className="header-members" title="Members and details" onClick={onDetails}>{members.slice(0,3).map(p=><Avatar key={p.id} person={p} size={24}/>)}{members.length>3&&<span className="members-more" aria-hidden="true">+{members.length-3}</span>}<span className="sr-only">Details</span></button>
  {data&&<ConversationMenu onSchedule={onSchedule} preferences={data.preferences} onPreference={onPreference} onPins={onPins} onNotifications={onNotifications}/>}
 </>
}
