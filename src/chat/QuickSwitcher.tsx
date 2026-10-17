import {useEffect,useId,useRef,useState} from 'react'
import type {Conversation,Person} from './types'
import type {TeamRequest} from '../team/types'
import {conversationName} from './Navigation'
import {containDialogFocus} from './dialog-focus'
import {IconClose} from './icons'
import '../app-style/quick-navigation.css'

type Choice={key:string;name:string;detail:string;unread:number;run:()=>void}
type Props={user:Person;conversations:Conversation[];users:Person[];request:TeamRequest;signal:AbortSignal;dmOnly?:boolean;onHelp:()=>void;close:()=>void;select:(conversation:Conversation)=>void;person:(person:Person)=>void;thread:(conversation:string,root:string)=>void;error:(error:unknown)=>void}
function match(name:string,query:string){
 const value=name.toLocaleLowerCase(),needle=query.toLocaleLowerCase().replace(/^[#@]/,'').trim()
 if(!needle)return 0
 const exact=value.indexOf(needle);if(exact>=0)return exact
 let at=-1,cost=30
 for(const character of needle){const next=value.indexOf(character,at+1);if(next<0)return null;cost+=next-at;at=next}
 return cost
}
export function QuickSwitcher({user,conversations,users,request,signal,dmOnly,onHelp,close,select,person,thread,error}:Props){
 const dialog=useRef<HTMLDialogElement>(null),id=useId(),[query,setQuery]=useState(''),[active,setActive]=useState(0),[channels,setChannels]=useState<{id:string;name:string}[]>([]),[threads,setThreads]=useState<{root:{id:string;conversation:string};conversation:{name:string}}[]>([]),[loading,setLoading]=useState(true)
 useEffect(()=>{const trigger=document.activeElement as HTMLElement;dialog.current?.showModal();return()=>{if(trigger?.isConnected)trigger.focus({preventScroll:true})}},[])
 useEffect(()=>{let cancelled=false;const current=()=>!cancelled&&!signal.aborted
  void(async()=>{
   const publicChannels:{id:string;name:string}[]=[]
   if(user.mode!=='guest'){let after:string|null=null;do{const page:{items:{id:string;name:string}[];cursor:string|null}=await request('/api/channels'+(after?'?after='+encodeURIComponent(after):''),{signal});if(!current())return;publicChannels.push(...page.items);after=page.cursor}while(after)}
   const followed=await request<{items:typeof threads}>('/api/threads?limit=30',{signal});if(current()){setChannels(publicChannels);setThreads(followed.items)}
  })().catch(e=>{if(current())error(e)}).finally(()=>{if(current())setLoading(false)})
  return()=>{cancelled=true}
 },[request,signal,user.mode,error])
 const choices:Choice[]=[...conversations.map(c=>({key:'c:'+c.id,name:conversationName(c,user),detail:c.kind==='dm'?'Direct message':c.kind==='private'?'Private channel':'Channel',unread:c.unread,run:()=>select(c)})),...users.filter(p=>p.id!==user.id&&p.active!==0&&user.mode!=='guest').map(p=>({key:'p:'+p.id,name:p.name,detail:'Message person',unread:0,run:()=>person(p)})),...channels.filter(c=>!conversations.some(own=>own.id===c.id)).map(c=>({key:'j:'+c.id,name:c.name,detail:'Public channel · join to read full history',unread:0,run:()=>{void request('/api/channels/'+encodeURIComponent(c.id)+'/join',{method:'POST',body:'{}',signal}).then(()=>{if(!signal.aborted)thread(c.id,'')}).catch(error)}})),...threads.filter(t=>conversations.some(c=>c.id===t.root.conversation)).map(t=>({key:'t:'+t.root.id,name:conversationName(conversations.find(c=>c.id===t.root.conversation)!,user),detail:'Followed thread',unread:0,run:()=>thread(t.root.conversation,t.root.id)}))]
 const recent=JSON.parse(sessionStorage.getItem('nook:recent:'+user.id)||'[]') as string[]
 const results=choices.filter(choice=>!dmOnly||choice.detail==='Direct message'||choice.key.startsWith('p:')).map(choice=>({choice,score:match(choice.name,query)})).filter((item):item is {choice:Choice;score:number}=>item.score!==null).sort((a,b)=>a.score-b.score||(b.choice.unread>0?1:0)-(a.choice.unread>0?1:0)||(recent.includes(a.choice.key)?recent.indexOf(a.choice.key):100)-(recent.includes(b.choice.key)?recent.indexOf(b.choice.key):100)||a.choice.name.localeCompare(b.choice.name)).slice(0,40)
 const index=Math.min(active,Math.max(0,results.length-1))
 const choose=(choice:Choice)=>{sessionStorage.setItem('nook:recent:'+user.id,JSON.stringify([choice.key,...recent.filter(key=>key!==choice.key)].slice(0,30)));close();choice.run()}
 useEffect(()=>{document.getElementById(id+'-result-'+index)?.scrollIntoView({block:'nearest'})},[index,id])
 return <dialog ref={dialog} className="quick-switcher" aria-labelledby={id+'-title'} onKeyDown={containDialogFocus} onCancel={e=>{e.preventDefault();close()}}><div className="dialog-heading"><h2 id={id+'-title'}>Jump to a conversation</h2><button className="icon-button" aria-label="Close" onClick={close}><IconClose/></button></div><label className="field"><span className="sr-only">Find a conversation or person</span><input autoFocus role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls={id+'-results'} aria-activedescendant={results.length?id+'-result-'+index:undefined} value={query} placeholder="Channel, person or followed thread" onChange={e=>{setQuery(e.target.value);setActive(0)}} onKeyDown={e=>{if(e.nativeEvent.isComposing)return;if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setActive((index+(e.key==='ArrowDown'?1:-1)+results.length)%Math.max(1,results.length))}if(e.key==='Enter'&&results[index]){e.preventDefault();choose(results[index].choice)}}}/></label><p className="sr-only" role="status">{results.length} results{loading?' · loading public channels and threads':''}</p><div id={id+'-results'} role="listbox" aria-label="Conversations and people" className="quick-results">{results.map(({choice},i)=><button key={choice.key} type="button" role="option" id={id+'-result-'+i} aria-selected={i===index} onMouseMove={()=>setActive(i)} onClick={()=>choose(choice)}><span>{choice.name}<small>{choice.detail}</small></span>{choice.unread>0&&<span className="count">{choice.unread} unread</span>}</button>)}{!results.length&&<p className="muted">{loading?'Loading…':'No matching conversations or people.'}</p>}</div><p className="dialog-note">↑ ↓ to choose · Enter to open · Esc to close</p><button type="button" className="text-button" onClick={onHelp}>Keyboard shortcuts</button></dialog>
}
