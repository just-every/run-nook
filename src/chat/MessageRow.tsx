import {CollectionActions,SaveFileAction} from './CollectionActions'
import {SlackHistory} from '../imports/SlackHistory'
import {useRef,useState} from 'react'
import type {MouseEvent,ReactNode} from 'react'
import {ErasureDialog} from '../team/erasure/ErasureDialog'
import {ReactionChips,ReactionPicker,useReactions} from '../team/ReactionBar'
import {ImagePreview} from '../team/ImagePreview'
import {useTeamBindings} from '../team/TeamBindings'
import type {Message,Outcome,Person} from './types'
import {Avatar} from './Avatar'
import {IconAsk,IconDecide,IconMore,IconReply} from './icons'
import {OutcomeLines} from './OutcomeLine'
import {useDismiss} from './useDismiss'
type Props={message:Message;user:Person;canErase?:boolean;thread?:boolean;continued?:boolean;outcomes?:Outcome[];onOutcome?:(o:Outcome)=>void;onThread:(m:Message)=>void;onAsk:(m:Message)=>void;onDecision:(m:Message)=>void;onEdit:(m:Message)=>void;onDelete:(m:Message)=>void;onRemove:(id:string)=>void}
const tool=(label:string,icon:ReactNode,onClick:()=>void)=><button type="button" className="icon-button" title={label} onClick={onClick}>{icon}<span className="sr-only">{label}</span></button>
// The less common verbs sit behind one menu. It stays open while Edit or Delete is up so focus can return to the item.
// The menu stays within the viewport, including a narrow thread pane or phone.
function MoreMenu({message,canEdit,canErase,eraseTrigger,onEdit,onDelete,onErase}:{message:Message;canEdit:boolean;canErase:boolean;eraseTrigger:React.RefObject<HTMLButtonElement|null>;onEdit:()=>void;onDelete:()=>void;onErase:()=>void}) {
 const menu=useRef<HTMLDetailsElement>(null),[open,setOpen]=useState(false),[position,setPosition]=useState({top:64,right:16})
 useDismiss(menu)
 return <details className="message-more menu" ref={menu} onToggle={e=>{setOpen(e.currentTarget.open);if(e.currentTarget.open){const box=e.currentTarget.getBoundingClientRect();setPosition({top:Math.max(64,Math.min(box.bottom+6,window.innerHeight-320)),right:Math.max(16,Math.min(window.innerWidth-box.right,window.innerWidth-236))})}}}><summary className="icon-button" title="More" aria-label={'More actions for message by '+message.authorName}><IconMore/></summary><div className="popover inline" style={{'--more-top':position.top+'px','--more-right':position.right+'px'} as React.CSSProperties}>{open&&<CollectionActions message={message}/>} {canEdit&&<><button type="button" onClick={onEdit}>Edit</button><button type="button" onClick={onDelete}>Delete</button></>}{canErase&&<button type="button" className="erase-item" ref={eraseTrigger} onClick={onErase}>Erase message</button>}</div></details>
}
// A tap on the message itself (not a control, not a text selection) focuses it, which opens the tray on touch screens.
const focusRow=(event:MouseEvent<HTMLElement>)=>{
 if((event.target as HTMLElement).closest('a, button, summary, input, textarea, select, label'))return
 const selection=window.getSelection();if(selection&&!selection.isCollapsed)return
 event.currentTarget.focus({preventScroll:true})
}
export function MessageRow({message:m,user,onThread,onAsk,onDecision,onEdit,onDelete,onRemove,thread=false,canErase=false,continued=false,outcomes=[],onOutcome}:Props) {
 const team=useTeamBindings(),[erasing,setErasing]=useState(false),eraseTrigger=useRef<HTMLButtonElement|null>(null)
 const reactions=useReactions(m.id,team.request,team.revision,team.accessEpoch,!m.immutable&&!m.deleted,m.reactions)
 const mine=!m.immutable&&m.author===user.id
 const time=new Date(m.created)
 return <article className={'message reveal-host'+(continued?' continued':'')+(m.deleted?' deleted':'')} id={(thread?'thread-message-':'message-')+m.id} data-message={m.id} data-immutable={m.immutable?'true':undefined} data-sequence={m.sequence} tabIndex={-1} onClick={focusRow}>
  {erasing&&<ErasureDialog kind={m.retainedSource==='native'?'message':m.immutable?'imported-message':'message'} target={m.id} returnFocus={eraseTrigger.current} request={team.request} onClose={()=>setErasing(false)} onChanged={()=>{}}/>}
  {continued?<span className="avatar-gutter" aria-hidden="true"/>:<Avatar person={{id:m.author??m.id,name:m.authorName}}/>}
  <div className="message-content"><div className="message-meta"><strong className={continued?'sr-only':undefined}>{m.authorName}</strong><time className={continued?'reveal':undefined} dateTime={m.created} title={time.toLocaleString([],{dateStyle:'full',timeStyle:'short'})}>{time.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</time>{m.adminOverride&&!m.deleted&&<span className="edited">Admin override</span>}{m.immutable&&<span className="edited">{m.retainedSource?'Retained body · read only':'Imported · read only'}</span>}{m.version>1&&!m.deleted&&!m.retainedSource&&<span className="edited">edited</span>}</div>
   <p className="message-body">{m.deleted?'Message deleted':m.slack?.text??m.body}</p>
   {!m.deleted&&<>
    {(m.urgent||!!m.notified?.length)&&<div className="message-routing">{m.urgent&&<strong>Urgent</strong>}{!!m.notified?.length&&<span>Notified: {m.notified.map(person=>person.name).join(', ')}</span>}{m.urgent&&m.urgentReason&&<span className="message-urgent-reason">{m.urgentReason}</span>}</div>}
    {!thread&&onOutcome&&<OutcomeLines outcomes={outcomes} onOpen={onOutcome}/>}
    {(m.attachments||[]).map(f=><div className="file-row reveal-host" key={f.id}>{f.state==='deleted'?<span className="muted">Attachment removed</span>:<><ImagePreview attachment={f} accessEpoch={team.accessEpoch} onDenied={team.onDenied}/><a href={`/api/attachments/${f.id}/download`} download={f.name}><strong>{f.name}</strong><small>{Math.max(1,Math.round(f.size/1024))} KB · Download</small></a><SaveFileAction conversation={m.conversation} attachment={f.id}/>{!m.immutable&&f.author===user.id&&<button type="button" className="text-button reveal" onClick={()=>onRemove(f.id)}>Remove file</button>}</>}</div>)}
    {m.immutable&&<SlackHistory history={m.slack}/>}
    {!m.immutable&&<ReactionChips reactions={reactions}/>}
   </>}
   {!m.parent&&!thread&&((m.replyCount??0)>0||!!m.deleted)&&<button type="button" className="reply-button text-button" onClick={()=>onThread(m)}><IconReply/>{m.replyCount?`${m.replyCount} ${m.replyCount===1?'reply':'replies'}`:'View thread'}</button>}
  </div>
  {!m.deleted&&<div className="message-tools reveal reveal-tap" role="group" aria-label="Message actions">
   {!m.immutable&&<ReactionPicker reactions={reactions}/>}
   {!m.parent&&!thread&&tool('Open thread',<IconReply/>,()=>onThread(m))}
   {!m.immutable&&<>{tool('Ask someone',<IconAsk/>,()=>onAsk(m))}{tool('Record decision',<IconDecide/>,()=>onDecision(m))}</>}
   <MoreMenu message={m} canEdit={mine} canErase={canErase} eraseTrigger={eraseTrigger} onEdit={()=>onEdit(m)} onDelete={()=>onDelete(m)} onErase={()=>setErasing(true)}/>
  </div>}
 </article>
}
