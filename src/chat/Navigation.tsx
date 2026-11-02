import './phone-conversation.css'
import {useAiAvailability} from '../ai-search/availability'
import {useId,useRef} from 'react'
import type {Conversation,LocationState,Person,Preferences,Projection,Screen} from './types'
import {Avatar} from './Avatar'
import {IconForward,IconMore,IconPlus} from './icons'
import {useDismiss} from './useDismiss'
import {NookMark} from '../brand/NookMark'
import {hostOf} from './hosts'
export function conversationName(c:Conversation,user:Person){return c.kind==='dm'&&c.participants?c.participants.filter(p=>p.id!==user.id).map(p=>p.name).join(', ')||c.name:c.name}
// In this icon control the portraits are decoration, rather than its text label.
// Match Avatar's palette and initials without adding those letters to the button's visible label.
function MemberPortrait({person}:{person:Person}){
 const words=person.name.trim().split(/[\s_-]+/),initials=(words.length>1?words.slice(-2).map(w=>w[0]).join(''):words[0].slice(0,2)).toUpperCase()
 const colors=[['#f6e6e0','#7a3a3f'],['#f3e7da','#6a4a24'],['#efe4e6','#664054'],['#ece6df','#51443d'],['#f1e4dc','#5e3b30']]
 let hash=0;for(const char of person.id)hash=(hash*31+char.charCodeAt(0))|0
 const [background,color]=colors[Math.abs(hash)%colors.length]
 return <span className="avatar header-member-portrait" aria-hidden="true" data-initials={initials} style={{background,color,width:24,height:24}}/>
}
// The one current item, a function of route.view alone: the rail and the bar both read it, so each shows exactly one.
// Hosted views light their host; All unreads and a conversation light a list item at 1440 and the Channels tab at 390.
export type Current='attention'|'threads'|'search'|'channels'|'unreads'|'chat'|'you'
export function currentItem(view:Screen):Current{const host=hostOf(view);return host?host:view==='team'?'you':view as Current}
const tabOf=(current:Current)=>current==='unreads'||current==='chat'?'channels':current
type Create={channel:()=>void;dm:()=>void}
type Entry={current:boolean;open:()=>void}
// The rail and the Channels page share this list. Each group heading carries its one "+" (always shown, with the shared tooltip);
// the rail also makes the Channels heading the link to Browse public channels, and both show the conditional All unreads head row.
export function ConversationList({conversations,user,current,onSelect,onCreate,unreads,channels}:{conversations:Conversation[];user:Person;current:string|null;onSelect:(c:Conversation)=>void;onCreate?:Create;unreads?:Entry;channels?:Entry}) {
 const sections=[...new Set(conversations.map(c=>c.section).filter((s):s is string=>Boolean(s)))],unread=conversations.reduce((sum,c)=>sum+c.unread,0),groups=[
  ...sections.map(section=>({key:'section:'+section,title:section,items:conversations.filter(c=>c.section===section),add:undefined as (()=>void)|undefined,label:''})),
  {key:'channels',title:'Channels',items:conversations.filter(c=>!c.section&&c.kind!=='dm'),add:onCreate?.channel,label:'Create channel'},
  {key:'dms',title:'Direct messages',items:conversations.filter(c=>!c.section&&c.kind==='dm'),add:onCreate?.dm,label:'New message'},
 ]
 return <>{unreads&&<button className={'unreads-row'+(unreads.current?' selected':'')} aria-current={unreads.current?'page':undefined} onClick={unreads.open}><span>All unreads{unread>0&&' · '+unread}</span><IconForward/></button>}{groups.filter(group=>group.items.length||group.add).map(({key,title,items,add,label})=>{const link=key==='channels'?channels:undefined;return <div className="conversation-group" key={key}><div className={'group-heading'+(link?.current?' selected':'')}>{link?<h2><button className="group-link" aria-current={link.current?'page':undefined} onClick={link.open}>{title}</button></h2>:<h2>{title}</h2>}{add&&<button className="icon-button" data-tooltip={label} aria-label={label} onClick={add}><IconPlus/><span className="sr-only">{label}</span></button>}</div>{items.sort((a,b)=>(a.position??0)-(b.position??0)||a.id.localeCompare(b.id)).map(c=><button key={c.id} className={'conversation-link'+(c.id===current?' selected':'')+(c.unread>0?' unread':'')} aria-current={c.id===current?'page':undefined} onClick={()=>onSelect(c)}>{c.kind==='dm'?<Avatar person={c.participants?.find(p=>p.id!==user.id)||{id:c.id,name:conversationName(c,user)}} size={22}/>:<span className="channel-prefix" aria-hidden="true">#</span>}<span>{conversationName(c,user)}</span>{c.unread>0&&<span className="count" aria-label={`${c.unread} unread`}>{c.unread}</span>}</button>)}</div>})}</>
}
export function Sidebar({workspaces,user,conversations,route,attentionCount,onNavigate,onSelect,onNewMessage,onNewChannel,canCreate=true,showUnreads=true}:{workspaces?:import('react').ReactNode;showUnreads?:boolean;user:Person;canCreate?:boolean;conversations:Conversation[];route:LocationState;attentionCount:number;onNavigate:(v:Screen)=>void;onSelect:(c:Conversation)=>void;onNewMessage:()=>void;onNewChannel:()=>void}) {
 // A conversation that is not in the list (view=chat with no conversation, or one you cannot open) offers Browse channels, so Channels is current.
 const shown=currentItem(route.view),now=shown==='chat'&&!conversations.some(c=>c.id===route.conversation)?'channels':shown
 return <aside className="sidebar"><a className="workspace-brand" href="/" aria-label="Nook home"><span className="nook-wordmark"><NookMark/><span data-rer-name aria-hidden="true">Nook</span></span></a>{workspaces}<nav className="workspace-nav" aria-label="Workspace">{(['attention','threads','search'] as const).map(v=><button key={v} className={now===v?'selected':''} aria-current={now===v?'page':undefined} onClick={()=>onNavigate(v)}>{v==='attention'?'Attention':v==='threads'?'Threads':'Search'}{v==='attention'&&attentionCount>0&&<span className="count">{attentionCount}</span>}</button>)}</nav><div className="sidebar-conversations"><ConversationList conversations={conversations} user={user} current={now==='chat'?route.conversation:null} onSelect={onSelect} onCreate={canCreate?{channel:onNewChannel,dm:onNewMessage}:undefined} unreads={showUnreads?{current:now==='unreads',open:()=>onNavigate('unreads')}:undefined} channels={{current:now==='channels',open:()=>onNavigate('channels')}}/></div><button className={'profile'+(now==='you'?' selected':'')} aria-current={now==='you'?'page':undefined} onClick={()=>onNavigate('you')}><Avatar person={user} size={28}/><span>{user.name}{user.status&&<small style={{display:'block',overflowWrap:'anywhere'}}>{user.status.emoji} {user.status.text}</small>}</span><span className="sr-only">Your profile</span></button></aside>
}
export function MobileTabs({view,attentionCount,onNavigate}:{view:Screen;attentionCount:number;onNavigate:(v:Screen)=>void}) {
 const now=tabOf(currentItem(view))
 return <nav className="mobile-tabs" aria-label="Workspace">{(['attention','threads','channels','search','you'] as const).map(v=>{const label=v==='you'?'You':v[0].toUpperCase()+v.slice(1);return <button key={v} aria-current={v===now?'page':undefined} onClick={()=>onNavigate(v)}><span className="mobile-tab-label" data-label={label}>{label}</span>{v==='attention'&&attentionCount>0&&<span className="count">{attentionCount}</span>}</button>})}</nav>
}
// The chat view's header actions: the Decisions & requests toggle, the one Details door (the member avatars), and the options menu.
function ConversationMenu({onRecap,preferences,onPreference,onPins,onBookmarks,onPoll,onNotifications,onSchedule,onUnread,onOutcomes,onDetails,open,waiting}:{onRecap?:()=>void;onOutcomes:()=>void;onDetails:()=>void;open:number;waiting:boolean;onUnread?:()=>void;onSchedule?:()=>void;preferences:Preferences;onPins?:()=>void;onBookmarks?:()=>void;onPoll?:()=>void;onNotifications?:()=>void;onPreference:(input:{followed:boolean}|{muted:boolean})=>void}) {
 const {state:ai}=useAiAvailability(),menu=useRef<HTMLDetailsElement>(null),waitingId=useId()
 useDismiss(menu)
 const choose=(input:{followed:boolean}|{muted:boolean})=>{if(menu.current)menu.current.open=false;onPreference(input)}
 return <details className="conversation-menu menu" ref={menu}><summary className="icon-button" data-tooltip="Conversation options" aria-label="Conversation options" aria-describedby={waiting?waitingId:undefined}><IconMore/>{waiting&&<><span className="needs-you-dot phone-conversation-entry" aria-hidden="true"/><span id={waitingId} className="sr-only">Waiting on you</span></>}<span className="sr-only">Conversation options</span></summary><div className="popover end"><button className="phone-conversation-entry" onClick={()=>{if(menu.current)menu.current.open=false;onOutcomes()}}>Decisions &amp; requests{open>0&&<span className="header-count">{open} open</span>}{waiting&&<><span className="needs-you-dot" aria-hidden="true"/><span className="sr-only">, waiting on you</span></>}</button><button className="phone-conversation-entry" onClick={()=>{if(menu.current)menu.current.open=false;onDetails()}}>Members and details</button>{onRecap&&(ai==='ready'||ai==='capped')&&<button className="recap-menu-item" onClick={()=>{if(menu.current)menu.current.open=false;onRecap()}}>Recap conversation</button>}{onUnread&&<button onClick={()=>{if(menu.current)menu.current.open=false;onUnread()}}>Mark unread</button>}{onSchedule&&<button onClick={()=>{if(menu.current)menu.current.open=false;onSchedule()}}>Schedule message</button>}{onNotifications&&<button onClick={()=>{if(menu.current)menu.current.open=false;onNotifications()}}>Notification settings</button>}{onPins&&<button onClick={()=>{if(menu.current)menu.current.open=false;onPins()}}>Pinned messages</button>}{onPoll&&<button onClick={()=>{if(menu.current)menu.current.open=false;onPoll()}}>Create poll</button>}{onBookmarks&&<button onClick={()=>{if(menu.current)menu.current.open=false;onBookmarks()}}>Channel bookmarks</button>}<button onClick={()=>choose({followed:!preferences.followed})}>{preferences.followed?'Unfollow conversation':'Follow conversation'}</button><button onClick={()=>choose({muted:!preferences.muted})}>{preferences.muted?'Unmute conversation':'Mute conversation'}</button></div></details>
}
export function ChatActions({onRecap,user,data,route,navigate,onDetails,onPreference,onPins,onBookmarks,onPoll,onNotifications,onSchedule,onUnread}:{onRecap?:()=>void;onUnread?:()=>void;onSchedule?:()=>void;onBookmarks?:()=>void;onPoll?:()=>void;user:Person;data:Projection|null;route:LocationState;navigate:(next:Partial<LocationState>)=>void;onDetails:()=>void;onPins?:()=>void;onNotifications?:()=>void;onPreference:(input:{followed:boolean}|{muted:boolean})=>void}) {
 const outcomes=data?.outcomes||[],members=data?.members||[]
 const open=outcomes.filter(o=>o.status!=='cancelled'&&o.status!=='reported-complete').length
 const waiting=outcomes.some(o=>o.assignee===user.id&&(o.status==='proposed'||o.status==='accepted'))
 const showing=route.panel==='outcomes'
 return <>
  <button className="decisions-toggle soft-button" aria-expanded={showing} aria-controls={data?'decisions-panel':undefined} onClick={()=>navigate({panel:showing?null:'outcomes',landing:route.landing,...(showing?{focus:null}:{})})}><span className="decisions-label">Decisions &amp; requests</span>{open>0&&<><span className="header-count" aria-hidden="true">{open}</span><span className="sr-only">, {open} open</span></>}{waiting&&<><span className="needs-you-dot" aria-hidden="true"/><span className="sr-only">, waiting on you</span></>}</button>
  <button className="header-members" data-tooltip="Members and details" aria-label="Members and details" onClick={onDetails}>{members.slice(0,3).map(p=><MemberPortrait key={p.id} person={p}/>)}{members.length>3&&<span className="members-more" aria-hidden="true" data-count={members.length-3}/>}<span className="sr-only">Details</span></button>
  {data&&<ConversationMenu onRecap={onRecap} open={open} waiting={waiting} onDetails={onDetails} onOutcomes={()=>navigate({panel:showing?null:'outcomes',landing:route.landing,...(showing?{focus:null}:{})})} onUnread={onUnread} onSchedule={onSchedule} preferences={data.preferences} onPreference={onPreference} onPins={onPins} onBookmarks={onBookmarks} onPoll={onPoll} onNotifications={onNotifications}/>}
 </>
}
