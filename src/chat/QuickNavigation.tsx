import {TooltipButton} from './TooltipButton'
import {builtins} from '../commands/catalog'
import {useEffect,useRef,useState} from 'react'
import type {Conversation,LocationState,Person,Screen} from './types'
import type {TeamRequest} from '../team/types'
import {QuickSwitcher} from './QuickSwitcher'
import {recordVisit} from './recent-navigation'
import {containDialogFocus} from './dialog-focus'
import {IconClose,IconSearch} from './icons'

type Props={markAll:()=>void;user:Person;users:Person[];conversations:Conversation[];route:LocationState;request:TeamRequest;signal:AbortSignal;modalOpen:boolean;select:(c:Conversation)=>void;nav:(view:Screen)=>void;open:(conversation:string,focus?:string|null,thread?:string|null)=>Promise<void>;search:()=>void;refresh:()=>Promise<void>;error:(e:unknown)=>void}
export function QuickNavigation(props:Props){
 const {route,conversations,select,nav,request,signal,error}=props,[panel,setPanel]=useState<'switch'|'dm'|'help'|null>(null)
 const [mac,setMac]=useState(false)
 useEffect(()=>setMac(/Mac|iPhone|iPad/.test(navigator.platform)),[])
 useEffect(()=>{if(signal.aborted||route.view!=='chat'||!route.conversation)return;try{recordVisit(props.user.id,{key:'c:'+route.conversation});if(route.thread)recordVisit(props.user.id,{key:'t:'+route.thread,conversation:route.conversation})}catch(e){error(e)}},[props.user.id,route.view,route.conversation,route.thread,signal,error])
 useEffect(()=>{if(signal.aborted)setPanel(null);const abort=()=>setPanel(null);signal.addEventListener('abort',abort);return()=>signal.removeEventListener('abort',abort)},[signal])
 function adjacent(direction:number,unread=false){const items=conversations.filter(c=>!unread||c.unread>0),at=items.findIndex(c=>c.id===route.conversation),next=at<0?(direction>0?items[0]:items.at(-1)):items[(at+direction+items.length)%items.length];if(next)select(next);setPanel(null)}
 async function markRead(){const current=conversations.find(c=>c.id===route.conversation);if(route.view!=='chat'||!current)return;try{await request('/api/conversations/'+encodeURIComponent(current.id)+'/read',{method:'POST',body:JSON.stringify({seq:current.seq}),signal});if(!signal.aborted)await props.refresh()}catch(e){if(!signal.aborted)error(e)}}
 const command=mac?'⌘':'Ctrl ',option=mac?'⌥':'Alt '
 const actions=[{label:'All unreads',keys:command+'Shift A',run:()=>{nav('unreads');setPanel(null)}},{label:'Mark all read (10-second undo)',keys:'Shift Esc',run:()=>{setPanel(null);props.markAll()}},{label:'Jump to a conversation',keys:command+'K',run:()=>setPanel('switch')},{label:'Threads',keys:command+'Shift T',run:()=>{nav('threads');setPanel(null)}},{label:'Direct messages',keys:command+'Shift K',run:()=>setPanel('dm')},{label:'Previous conversation',keys:option+'↑',run:()=>adjacent(-1)},{label:'Next conversation',keys:option+'↓',run:()=>adjacent(1)},{label:'Previous unread conversation',keys:option+'Shift ↑',run:()=>adjacent(-1,true)},{label:'Next unread conversation',keys:option+'Shift ↓',run:()=>adjacent(1,true)},{label:'Back',keys:command+'[',run:()=>{setPanel(null);history.back()}},{label:'Forward',keys:command+']',run:()=>{setPanel(null);history.forward()}},{label:'Search this conversation',keys:command+'F',run:()=>{setPanel(null);props.search()}},{label:'Mark this conversation read',keys:'Esc',run:()=>{setPanel(null);void markRead()}}]
 useEffect(()=>{
  const keydown=(event:KeyboardEvent)=>{
   if(event.isComposing||event.defaultPrevented||props.modalOpen||panel||document.querySelector('dialog[open]'))return
   const modifier=event.metaKey||event.ctrlKey,key=event.key.toLowerCase(),target=event.target as HTMLElement,editing=target.matches('input,textarea,select,[contenteditable=true]')
   if(modifier&&!event.altKey&&key==='k'){event.preventDefault();setPanel(event.shiftKey?'dm':'switch');return}
   if(modifier&&!event.shiftKey&&!event.altKey&&key==='/'){event.preventDefault();setPanel('help');return}
   if(modifier&&event.shiftKey&&key==='a'){event.preventDefault();nav('unreads');return}
   if(key==='escape'&&event.shiftKey&&!editing){event.preventDefault();props.markAll();return}
   if(modifier&&event.shiftKey&&key==='t'){event.preventDefault();nav('threads');return}
   if(modifier&&!event.shiftKey&&key==='f'&&route.view==='chat'){event.preventDefault();props.search();return}
   if(modifier&&(key==='['||key===']')){event.preventDefault();history[key==='['?'back':'forward']();return}
   if(event.altKey&&(key==='arrowup'||key==='arrowdown')){event.preventDefault();adjacent(key==='arrowup'?-1:1,event.shiftKey);return}
   if(key==='escape'&&!event.shiftKey&&!editing&&route.view==='chat'){event.preventDefault();void markRead()}
  }
  document.addEventListener('keydown',keydown);return()=>document.removeEventListener('keydown',keydown)
 })
 return <><TooltipButton className="soft-button quick-nav-trigger" aria-keyshortcuts="Meta+K Control+K" label="Jump to…" onClick={()=>setPanel('switch')}><IconSearch/><span className="quick-nav-label">Jump to…</span></TooltipButton><TooltipButton className="icon-button quick-help" label="Keyboard shortcuts" onClick={()=>setPanel('help')}>?</TooltipButton>{(panel==='switch'||panel==='dm')&&<QuickSwitcher dmOnly={panel==='dm'} onHelp={()=>setPanel('help')} key={props.user.id+':'+signal.aborted} {...props} close={()=>setPanel(null)} person={person=>{const existing=conversations.find(c=>c.kind==='dm'&&c.participants?.length===2&&c.participants.some(p=>p.id===person.id));if(existing){select(existing);return}void request<Conversation>('/api/conversations',{method:'POST',body:JSON.stringify({name:person.name,kind:'dm',participants:[person.id]}),signal}).then(c=>{if(!signal.aborted)void props.refresh().then(()=>select(c))}).catch(error)}} thread={(conversation,root)=>{void props.refresh().then(()=>props.open(conversation,root||null,root||null))}} error={error}/ >}{panel==='help'&&<ShortcutSheet actions={actions} close={()=>setPanel(null)} command={command}/>}</>
}
function ShortcutSheet({actions,close,command}:{actions:{label:string;keys:string;run:()=>void}[];close:()=>void;command:string}){
 const dialog=useRef<HTMLDialogElement>(null)
 useEffect(()=>{const trigger=document.activeElement as HTMLElement;dialog.current?.showModal();return()=>{if(trigger?.isConnected)trigger.focus({preventScroll:true})}},[])
 return <dialog ref={dialog} className="quick-switcher" aria-labelledby="shortcut-title" onKeyDown={containDialogFocus} onCancel={e=>{e.preventDefault();close()}}><div className="dialog-heading"><h2 id="shortcut-title">Keyboard shortcuts</h2><button className="icon-button" aria-label="Close" onClick={close}><IconClose/></button></div><div className="shortcut-list">{actions.map(action=><button key={action.label} onClick={action.run}><span>{action.label}</span><kbd>{action.keys}</kbd></button>)}</div><p className="dialog-note"><kbd>↑</kbd> in an empty composer edits your last message in that conversation or thread. The composer’s Edit last message button does the same.</p><h3>Built-in commands</h3><div className="shortcut-list">{builtins.map(([name,args,description])=><p key={name}><strong>/{name} {args}</strong> · {description}</p>)}</div><p className="dialog-note">{command}/ opens this sheet. Enter sends a message; Shift Enter adds a line. Escape closes a dialog.</p></dialog>
}
