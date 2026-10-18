import {useEffect,useId,useRef,useState} from 'react'
import type {Conversation,Person} from './types'
import type {TeamRequest} from '../team/types'
import {conversationName} from './Navigation'
import {containDialogFocus} from './dialog-focus'
import {IconClose} from './icons'
import {quickPeople} from './quick-people'
import {recentVisits,recordVisit,type RecentVisit} from './recent-navigation'
import {followedThreads,visitedThreads,type QuickThread} from './quick-threads'
import '../app-style/quick-navigation.css'

type Choice={conversation?:string;key:string;name:string;detail:string;unread:number;run:()=>void}
type Props={user:Person;conversations:Conversation[];users:Person[];request:TeamRequest;signal:AbortSignal;dmOnly?:boolean;onHelp:()=>void;close:()=>void;select:(conversation:Conversation)=>void;person:(person:Person)=>void;thread:(conversation:string,root:string)=>void;error:(error:unknown)=>void}
function match(name:string,query:string){
 const value=name.toLocaleLowerCase(),needle=query.toLocaleLowerCase().replace(/^[#@]/,'').trim()
 if(!needle)return 0
 const exact=value.indexOf(needle);if(exact>=0)return exact
 let at=-1,cost=30
 for(const character of needle){const next=value.indexOf(character,at+1);if(next<0)return null;cost+=next-at;at=next}
 return cost
}
export function QuickSwitcher({user,request,signal,dmOnly,onHelp,close,select,person,thread,error}:Props){
 const dialog=useRef<HTMLDialogElement>(null),id=useId(),[query,setQuery]=useState(''),[active,setActive]=useState(0),[channels,setChannels]=useState<{id:string;name:string;archived?:number}[]>([]),[threads,setThreads]=useState<QuickThread[]>([]),[available,setAvailable]=useState<Conversation[]>([]),[people,setPeople]=useState<Person[]>([]),[recent,setRecent]=useState<RecentVisit[]>([]),[loading,setLoading]=useState(true)
 useEffect(()=>{const trigger=document.activeElement as HTMLElement;dialog.current?.showModal();return()=>{if(trigger?.isConnected)trigger.focus({preventScroll:true})}},[])
 useEffect(()=>{let cancelled=false;const controller=new AbortController(),abort=()=>controller.abort();signal.addEventListener('abort',abort);if(signal.aborted)abort();const current=()=>!cancelled&&!controller.signal.aborted
  void(async()=>{
   const visits=recentVisits(user.id)
   const loadChannels=async()=>{const items:{id:string;name:string;archived?:number}[]=[];if(user.mode==='guest')return items;let after:string|null=null;do{const page:{items:typeof items;cursor:string|null}=await request('/api/channels'+(after?'?after='+encodeURIComponent(after):''),{signal:controller.signal});items.push(...page.items);after=page.cursor}while(after);return items}
   const [publicChannels,followed,allowed,currentPeople]=await Promise.all([loadChannels(),followedThreads(request,controller.signal),request<Conversation[]>('/api/conversations',{signal:controller.signal}),user.mode==='guest'?Promise.resolve([]):quickPeople(request,controller.signal)])
   const visited=await visitedThreads(visits,allowed,controller.signal)
   if(current()){
    const merged=new Map(followed.map(item=>[item.root.id,item]));for(const item of visited)merged.set(item.root.id,{...merged.get(item.root.id),...item,unread:merged.get(item.root.id)?.unread??0})
    setRecent(visits);setAvailable(allowed);setPeople(currentPeople);setChannels(publicChannels);setThreads([...merged.values()])
   }
  })().catch(e=>{if(current())error(e)}).finally(()=>{if(current())setLoading(false)})
  return()=>{cancelled=true;controller.abort();signal.removeEventListener('abort',abort)}
 },[request,signal,user.id,user.mode,error])
 const choices:Choice[]=[...available.map(c=>({key:'c:'+c.id,name:conversationName(c,user),detail:c.kind==='dm'?'Direct message':c.kind==='private'?'Private channel':'Channel',unread:c.unread,run:()=>select(c)})),...people.filter(p=>p.id!==user.id&&p.active!==0&&user.mode!=='guest').map(p=>({key:'p:'+p.id,name:p.name,detail:'Message person',unread:0,run:()=>person(p)})),...channels.filter(c=>!available.some(own=>own.id===c.id)).map(c=>({key:'j:'+c.id,name:c.name,detail:c.archived?'Archived public channel · join to read full history':'Public channel · join to read full history',unread:0,run:()=>{void request('/api/channels/'+encodeURIComponent(c.id)+'/join',{method:'POST',body:'{}',signal}).then(()=>{if(!signal.aborted)thread(c.id,'')}).catch(error)}})),...threads.filter(t=>available.some(c=>c.id===t.root.conversation)).map(t=>({key:'t:'+t.root.id,conversation:t.root.conversation,name:conversationName(available.find(c=>c.id===t.root.conversation)!,user)+' · '+(t.root.deleted?'Message deleted':Array.from(t.root.body).slice(0,100).join('')),detail:t.visited?'Recent thread':'Followed thread',unread:t.unread,run:()=>thread(t.root.conversation,t.root.id)}))]
 const recentKeys=recent.map(visit=>visit.key)
 const results=choices.filter(choice=>!dmOnly||choice.detail==='Direct message'||choice.key.startsWith('p:')).map(choice=>({choice,score:match(choice.name,query)})).filter((item):item is {choice:Choice;score:number}=>item.score!==null).sort((a,b)=>a.score-b.score||(b.choice.unread>0?1:0)-(a.choice.unread>0?1:0)||(recentKeys.includes(a.choice.key)?recentKeys.indexOf(a.choice.key):Number.MAX_SAFE_INTEGER)-(recentKeys.includes(b.choice.key)?recentKeys.indexOf(b.choice.key):Number.MAX_SAFE_INTEGER)||a.choice.name.localeCompare(b.choice.name)).slice(0,40)
 const index=Math.min(active,Math.max(0,results.length-1))
 const choose=(choice:Choice)=>{try{if(!choice.key.startsWith('j:'))recordVisit(user.id,{key:choice.key,conversation:choice.conversation})}catch(e){error(e)}close();choice.run()}
 useEffect(()=>{document.getElementById(id+'-result-'+index)?.scrollIntoView({block:'nearest'})},[index,id])
 return <dialog ref={dialog} className="quick-switcher" aria-labelledby={id+'-title'} onKeyDown={containDialogFocus} onCancel={e=>{e.preventDefault();close()}}><div className="dialog-heading"><h2 id={id+'-title'}>Jump to a conversation</h2><button className="icon-button" aria-label="Close" onClick={close}><IconClose/></button></div><label className="field"><span className="sr-only">Find a conversation or person</span><input autoFocus role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls={id+'-results'} aria-activedescendant={results.length?id+'-result-'+index:undefined} value={query} placeholder="Channel, person or recent thread" onChange={e=>{setQuery(e.target.value);setActive(0)}} onKeyDown={e=>{if(e.nativeEvent.isComposing)return;if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setActive((index+(e.key==='ArrowDown'?1:-1)+results.length)%Math.max(1,results.length))}if(e.key==='Enter'&&results[index]){e.preventDefault();choose(results[index].choice)}}}/></label><p className="sr-only" role="status">{results.length} results{loading?' · loading public channels and recent threads':''}</p><div id={id+'-results'} role="listbox" aria-label="Conversations and people" className="quick-results">{results.map(({choice},i)=><button key={choice.key} type="button" role="option" id={id+'-result-'+i} aria-selected={i===index} onMouseMove={()=>setActive(i)} onClick={()=>choose(choice)}><span>{choice.name}<small>{choice.detail}</small></span>{choice.unread>0&&<span className="count">{choice.unread} unread</span>}</button>)}{!results.length&&<p className="muted">{loading?'Loading…':'No matching conversations or people.'}</p>}</div><p className="dialog-note">↑ ↓ to choose · Enter to open · Esc to close</p><button type="button" className="text-button" onClick={onHelp}>Keyboard shortcuts</button></dialog>
}
