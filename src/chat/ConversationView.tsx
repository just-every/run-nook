import {canEraseChannelMessage} from '../team/erasure/policy'
import {NookMark} from '../brand/NookMark'
import {useEffect,useLayoutEffect,useRef,useState} from 'react'
import type {Conversation,DialogState,LocationState,Message,Outcome,Person,Projection,ReadAcknowledgement} from './types'
import {Composer} from './Composer'
import {MessageRow} from './MessageRow'
import {OutcomeCard} from './OutcomeCard'
import {useReadVisibility} from './useReadVisibility'
import {conversationName} from './Navigation'
import {IconBack,IconBell,IconClose,IconPlus} from './icons'
type Props={user:Person;conversation:Conversation;data:Projection;route:LocationState;privateSignal:AbortSignal;conversationCurrent:()=>boolean;threadCurrent:()=>boolean;navigate:(next:Partial<LocationState>,replace?:boolean)=>void;openDialog:(d:DialogState)=>void;refresh:()=>Promise<void>;beginWrite:()=>()=>void;sendMessage:(input:unknown)=>Promise<void>;onRead:(ack:ReadAcknowledgement)=>Promise<void>;mutate:(path:string,input:unknown,method?:string)=>Promise<unknown>;onError:(e:unknown)=>void;onAction:(o:Outcome,action:string)=>Promise<unknown>;onDiscuss:(o:Outcome)=>void}
export function ConversationView({user,conversation:c,data,route,privateSignal,conversationCurrent,threadCurrent,navigate,openDialog,refresh,beginWrite,sendMessage,onRead,mutate,onError,onAction,onDiscuss}:Props) {
 const log=useRef<HTMLDivElement>(null),threadLog=useRef<HTMLDivElement>(null)
 const showOutcomes=route.panel==='outcomes',[peek,setPeek]=useState<string|null>(null)
 useEffect(()=>{if(!showOutcomes)setPeek(null)},[showOutcomes])
 useEffect(()=>{if(!peek||!showOutcomes)return;const frame=requestAnimationFrame(()=>{const card=document.getElementById('outcome-'+peek);card?.scrollIntoView({block:'start'});card?.focus({preventScroll:true})});return()=>cancelAnimationFrame(frame)},[peek,showOutcomes])
 // A conversation opened at its landing keeps that landing while the panel opens and closes: changing it would reset the window and blank the chat.
 const keepLanding=route.landing?{landing:true}:{}
 const setShowOutcomes=(value:boolean)=>navigate({panel:value?'outcomes':null,...(!value?{focus:null}:{}),...keepLanding})
 const name=conversationName(c,user),roots=data.rootWindow.items.filter(m=>!m.parent),root=data.threadWindow?.root,replies=data.threadWindow?.items||[]
 const activeLog=route.thread?threadLog:log
 const activeWindow=data.threadWindow||data.rootWindow
 const latestWindow=useRef(activeWindow);latestWindow.current=activeWindow
 const atEnd=useRef(false)
 const landingTarget=route.landing?data.rootWindow.target?.id:null
 const isCurrent=threadCurrent
 // The panel is a companion on wide screens, so reading continues behind it; on a phone it replaces the log (mirrors api.ts).
 const reading=!(showOutcomes&&typeof window!=='undefined'&&window.matchMedia('(max-width: 850px)').matches)
 useReadVisibility(activeLog,c.id,activeWindow,user.id,reading,isCurrent,onRead,onError,route.thread?{thread:route.thread,onRead:refresh}:undefined)
 const scrollKey=`nook:scroll:${user.id}:${c.id}:${route.thread||'root'}:${route.thread?route.threadBefore||'latest':route.before||'latest'}:${route.landing?'landing':'default'}`,focusKey=`nook:focus:${user.id}:${c.id}:${route.thread||'root'}:${route.thread?route.threadBefore||'latest':route.before||'latest'}:${route.landing?'landing':'default'}`
 // Parent private-scope layout effects commit before this initialization.
 // A child layout effect would still see the previous navigation scope.
 useEffect(()=>{
  const container=activeLog.current;if(!container||!isCurrent())return
  let target:HTMLElement|null=null
  const targetId=route.landing?landingTarget:route.focus
  if(targetId)target=Array.from(container.querySelectorAll<HTMLElement>('[data-message],[data-outcome]')).find(e=>e.dataset.message===targetId||e.dataset.outcome===targetId)||null
  const saved=sessionStorage.getItem(scrollKey)
  // A reader who was at the newest message returns to the newest message, even
  // when more arrived meanwhile; only a position inside history is kept as pixels.
  const ended=()=>container.scrollHeight-container.clientHeight-container.scrollTop<=40
  if(target){container.scrollTop=target.offsetTop-container.offsetTop-16;target.focus({preventScroll:true})}
  else if(route.landing)container.scrollTop=container.scrollHeight
  else if(saved!==null&&saved!=='end')container.scrollTop=Number(saved)
  else container.scrollTop=container.scrollHeight
  const save=()=>{if(isCurrent()&&container.getBoundingClientRect().height>0)sessionStorage.setItem(scrollKey,ended()?'end':String(container.scrollTop))};save()
  atEnd.current=ended()
  let userScrolled=false
  const scrollingIntent=(event:Event)=>{if(!(event instanceof KeyboardEvent)||['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key))userScrolled=true}
  const freeze=()=>{
   if(!isCurrent())return
   save();atEnd.current=ended()
   const before=route.thread?route.threadBefore:route.before
   if(!before&&userScrolled&&!atEnd.current){
    const last=latestWindow.current.items.at(-1)
    if(last){
     // Freeze the native sequence range while reading. Returned paging cursors
     // remain opaque; no sign/number assumption controls earlier navigation.
     const bound=latestWindow.current.freezeCursor??String(last.sequence+1),nextScope=`${user.id}:${c.id}:${route.thread||'root'}:${bound}:default`
     sessionStorage.setItem('nook:scroll:'+nextScope,String(container.scrollTop))
     const focused=sessionStorage.getItem(focusKey);if(focused)sessionStorage.setItem('nook:focus:'+nextScope,focused)
     navigate(route.thread?{threadBefore:bound,focus:null}:{before:bound,focus:null},true)
    }
   }
  }
  const bookmark=(e:FocusEvent)=>{const el=e.target as HTMLElement;if(isCurrent()&&el.id)sessionStorage.setItem(focusKey,el.id)}
  container.addEventListener('scroll',freeze);container.addEventListener('focusin',bookmark)
  for(const type of ['wheel','touchmove','pointerdown','keydown'])container.addEventListener(type,scrollingIntent,{passive:true})
  return ()=>{save();container.removeEventListener('scroll',freeze);container.removeEventListener('focusin',bookmark);for(const type of ['wheel','touchmove','pointerdown','keydown'])container.removeEventListener(type,scrollingIntent)}
 },[c.id,route.thread,route.focus,route.landing,landingTarget,showOutcomes,scrollKey,focusKey,isCurrent])
 useLayoutEffect(()=>{const container=activeLog.current;if(container&&atEnd.current&&!route.focus&&!(route.thread?route.threadBefore:route.before))container.scrollTop=container.scrollHeight},[activeWindow])
 useEffect(()=>{
  if(!route.thread||!conversationCurrent()||!log.current)return
  const saved=sessionStorage.getItem(`nook:scroll:${user.id}:${c.id}:root:${route.before||'latest'}:default`)
  log.current.scrollTop=route.before&&saved!==null&&saved!=='end'?Number(saved):log.current.scrollHeight
 },[c.id,route.thread,route.before,conversationCurrent])
 useEffect(()=>{
  const target=data.rootWindow.target
  if(target?.parent&&(!route.thread||route.landing&&(route.thread!==target.root||route.focus!==target.id)))navigate({thread:target.root,focus:target.id,landing:route.landing},true)
  else if(route.landing&&route.thread&&!target?.parent)navigate({thread:null,focus:null,landing:true},true)
 },[route.thread,route.focus,route.landing,data.rootWindow.target,navigate])
 useEffect(()=>{if(route.focus&&data.outcomes.some(o=>o.id===route.focus)){if(route.panel!=='outcomes')navigate({panel:'outcomes'},true);requestAnimationFrame(()=>{const card=document.getElementById('outcome-'+route.focus);card?.scrollIntoView({block:'start'});card?.focus({preventScroll:true})})}},[route.focus,data.outcomes])
 const sent=async()=>{if(!isCurrent())return;requestAnimationFrame(()=>{const container=activeLog.current;if(isCurrent()&&container)container.scrollTop=container.scrollHeight})}
 const latest=(inThread=false)=>{
  const current=inThread?threadCurrent:conversationCurrent
  if(!current())return
  const container=(inThread?threadLog:log).current
  if(container&&!(inThread?route.threadBefore:route.before))container.scrollTop=container.scrollHeight
  sessionStorage.removeItem(`nook:scroll:${user.id}:${c.id}:${inThread?route.thread:'root'}:latest:default`)
  navigate({...(inThread?{threadBefore:null,focus:null}:route.thread?{before:null}:{before:null,focus:null}),landing:false})
 }
 const thread=(m:Message)=>{navigate({thread:m.id,focus:m.id,panel:null,threadBefore:null})}
 const back=()=>{const id=route.thread;navigate({thread:null,focus:id,panel:null,threadBefore:null,before:null})}
 const stitched=(m:Message)=>data.outcomes.filter(o=>o.source===m.id)
 // A row continues the previous author's run when the same person wrote it within five minutes and nothing sits between them.
 const continues=(m:Message,before:Message|undefined,dividerBetween=false,inThread=false)=>Boolean(before&&!dividerBetween&&!m.deleted&&!before.deleted&&m.author===before.author&&m.authorName===before.authorName&&!!m.immutable===!!before.immutable&&Math.abs(new Date(m.created).getTime()-new Date(before.created).getTime())<=300000&&(inThread||!stitched(before).length))
 // A stitch line opens the panel on its item without changing the URL's message window, so the conversation stays mounted.
 const openOutcome=(o:Outcome)=>{setPeek(o.id);navigate({panel:'outcomes',...keepLanding})}
 const row=(m:Message,inThread=false,before?:Message,dividerBetween=false)=><MessageRow canErase={canEraseChannelMessage(c.kind,user.mode,user.role)} key={(inThread?'thread-':'')+m.id} message={m} user={user} thread={inThread} continued={continues(m,before,dividerBetween,inThread)} outcomes={inThread?undefined:stitched(m)} onOutcome={inThread?undefined:openOutcome} onThread={thread} onAsk={m=>openDialog({kind:'outcome',source:m.id,outcomeKind:'commitment'})} onDecision={m=>openDialog({kind:'outcome',source:m.id,outcomeKind:'decision'})} onEdit={message=>openDialog({kind:'edit',message})} onDelete={message=>openDialog({kind:'delete',message})} onRemove={id=>{void mutate(`attachments/${id}`,{delete:true},'PATCH').catch(()=>{})}}/>
 const waiting=(o:Outcome)=>o.assignee===user.id&&(o.status==='proposed'||o.status==='accepted')
 const finished=(o:Outcome)=>o.status==='reported-complete'||o.status==='cancelled'
 const groups=[
  {title:'Waiting on you',items:data.outcomes.filter(waiting)},
  {title:'Open',items:data.outcomes.filter(o=>!waiting(o)&&!finished(o)&&o.status!=='recorded')},
  {title:'Decided',items:data.outcomes.filter(o=>o.status==='recorded')},
 ]
 const closed=data.outcomes.filter(finished)
 const card=(o:Outcome,compact=false)=><OutcomeCard key={o.id} outcome={o} user={user} onAction={onAction} onDiscuss={onDiscuss} onRevise={outcome=>openDialog({kind:'revise',outcome})} compact={compact}/>
 const outcomesPanel=<>
  <div className="panel-bar">
   {route.thread&&<button className="soft-button" onClick={()=>navigate({panel:null})}>Back to thread</button>}
   <h2>Decisions & requests</h2>
   <button className="panel-close icon-button" title="Back to messages" onClick={()=>setShowOutcomes(false)}><span className="icon-close"><IconClose/></span><span className="icon-chevron"><IconBack/></span><span className="sr-only">Back to messages</span></button>
   <div className="panel-actions"><button className="soft-button" onClick={()=>openDialog({kind:'outcome',source:null,outcomeKind:'decision'})}><IconPlus/>Record decision</button><button className="soft-button" onClick={()=>openDialog({kind:'outcome',source:null,outcomeKind:'commitment'})}><IconPlus/>Ask someone</button></div>
  </div>
  <div className="panel-scroll">
   {groups.map(g=>g.items.length>0&&<section key={g.title}><h3 className="panel-group">{g.title}</h3>{g.items.map(o=>card(o))}</section>)}
   {closed.length>0&&<details className="panel-closed" open={closed.some(o=>o.id===(route.focus||peek))||undefined}><summary>Closed ({closed.length})</summary>{closed.map(o=>card(o))}</details>}
   {!data.outcomes.length&&<p className="empty-state">No decisions or requests yet.</p>}
  </div>
 </>
 const followed=data.preferences.threads.includes(root?.id||'')
 const showLatest=Boolean(data.rootWindow.hasNewer||route.before||route.focus&&route.focus!==route.thread&&!data.outcomes.some(o=>o.id===route.focus)||route.landing&&data.rootWindow.target)
 const showLatestReplies=Boolean(data.threadWindow?.hasNewer||route.threadBefore||route.landing&&data.rootWindow.target?.parent)
 return <div className={'body-grid'+(route.thread?' has-thread':'')+(showOutcomes?' showing-outcomes':'')}>
  <section className="chat" aria-label={name}>
   <div className="log-frame">
    <div className="message-log" ref={log} aria-label="Conversation messages" role="region" tabIndex={0}>
     <div className="history-controls">{data.rootWindow.hasMore&&data.rootWindow.cursor&&<button className="text-button" onClick={()=>navigate({before:data.rootWindow.cursor,focus:null})}>Load earlier messages</button>}</div>
     {roots.map((m,index)=>{const divider=m.sequence>c.readSeq&&(index===0||roots[index-1].sequence<=c.readSeq)&&c.unread>0;return <div className="message-group" key={m.id}>{divider&&<div className="new-divider">New messages</div>}{row(m,false,roots[index-1],divider)}</div>})}
     {!roots.length&&<div className="empty-state"><NookMark/><h2>Start the conversation</h2><p>{c.kind==='dm'?`Say hello to ${name}.`:`Say something to #${name}.`}</p></div>}
    </div>
    {showLatest&&<button className="jump-latest soft-button" onClick={()=>latest()}>Latest messages</button>}
   </div>
   {c.archived?<p className="archived-notice">This channel is archived. Its history is available; a manager can restore it from Details.</p>:<Composer key={user.id+':'+c.id+':root'} user={user} conversation={c.id} name={name} parent={null} members={data.members} privateSignal={privateSignal} viewCurrent={conversationCurrent} beginWrite={beginWrite} sendMessage={sendMessage} onSent={sent} onError={onError}/>}
  </section>
  <aside className="decisions" id="decisions-panel" aria-label={route.thread?'Thread':'Decisions and requests'}>
   {route.thread&&root&&!showOutcomes?<>
    <div className="panel-bar thread-bar"><button className="icon-button" title="Back" onClick={back}><IconBack/><span className="sr-only">Back</span></button><h2>Thread</h2>{(!root.immutable||Boolean(root.provenance))&&<button className="soft-button" onClick={()=>void mutate(`messages/${root.id}/follow`,{follow:!followed}).catch(()=>{})}><IconBell/>{followed?'Unfollow thread':'Follow thread'}</button>}</div>
    <div className="log-frame">
     <div className="message-log thread-log" ref={threadLog} role="region" aria-label="Thread messages" tabIndex={0}>
      <div className="history-controls">{data.threadWindow?.hasMore&&data.threadWindow.cursor&&<button className="text-button" onClick={()=>navigate({threadBefore:data.threadWindow!.cursor,focus:null})}>Load earlier replies</button>}</div>
      {row(root,true)}<hr className="thread-sep"/>{replies.map((m,index)=>row(m,true,replies[index-1]))}
      {data.outcomes.filter(o=>o.source===root.id).map(o=>card(o,true))}
     </div>
     {showLatestReplies&&<button className="jump-latest soft-button" onClick={()=>latest(true)}>Latest replies</button>}
    </div>
    {!c.archived&&!root.deleted&&(!root.immutable||Boolean(root.provenance))&&<Composer key={user.id+':'+c.id+':'+root.id} user={user} conversation={c.id} name={name} parent={root.id} members={data.members} privateSignal={privateSignal} viewCurrent={threadCurrent} beginWrite={beginWrite} sendMessage={sendMessage} onSent={sent} onError={onError}/>}
   </>:outcomesPanel}
  </aside>
 </div>
}
