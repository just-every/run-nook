import {useEffect,useRef,useState} from 'react'
import type {Reaction,TeamRequest} from './types'
import {IconReact} from '../chat/icons'
import {useDismiss} from '../chat/useDismiss'
const choices=['👍','❤️','🎉','👀','✅','🙌']
const names=(row?:Reaction)=>row?.actors.map(a=>a.name).join(', ')
// The conversation supplies fresh summaries; mutation and actor continuation
// retain their own authorized doors.
export function useReactions(message:string,request:TeamRequest,refresh:number|string,accessEpoch:number|string,enabled=true,snapshot?:Reaction[]){
 const scope=useRef(0),writes=useRef(0),toggling=useRef(0),missed=useRef(false)
 const [rows,setRows]=useState<Reaction[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[reload,setReload]=useState(0)
 // Another message or access epoch starts empty. A live refresh keeps the shown rows until the new ones land, so chips
 // never blink out. A refresh that overlapped a toggle may predate it: it is dropped and fetched again once toggles end.
 useEffect(()=>{scope.current++;toggling.current=0;missed.current=false;setRows([]);setBusy(false);setError('')},[message,accessEpoch,enabled])
 useEffect(()=>{if(!enabled)return;const current=scope.current,issued=writes.current,quiet=!toggling.current,controller=new AbortController();const result=snapshot&&reload===0?Promise.resolve(snapshot):request<Reaction[]>(`/api/messages/${encodeURIComponent(message)}/reactions`,{signal:controller.signal});result.then(value=>{if(controller.signal.aborted||current!==scope.current)return;if(quiet&&issued===writes.current&&!toggling.current)setRows(value);else missed.current=true}).catch(e=>{if(!controller.signal.aborted&&current===scope.current)setError(e.message)});return()=>controller.abort()},[message,refresh,accessEpoch,request,enabled,reload,snapshot])
 const toggle=async(emoji:string)=>{const current=scope.current;writes.current++;toggling.current++;setBusy(true);setError('');try{const next=await request<Reaction[]>(`/api/messages/${encodeURIComponent(message)}/reactions`,{method:'POST',body:JSON.stringify({emoji,add:!rows.find(r=>r.emoji===emoji)?.mine})});if(current===scope.current)setRows(next)}catch(e){if(current===scope.current)setError((e as Error).message)}finally{if(current===scope.current&&--toggling.current===0){setBusy(false);if(missed.current){missed.current=false;setReload(n=>n+1)}}}}
 async function more(row:Reaction){const current=scope.current;try{const page=await request<{actors:Reaction['actors'];cursor:string|null}>(`/api/messages/${encodeURIComponent(message)}/reaction-actors?emoji=${encodeURIComponent(row.emoji)}&after=${encodeURIComponent(row.cursor!)}`);if(current===scope.current)setRows(items=>items.map(r=>r.emoji===row.emoji?{...r,actors:[...r.actors,...page.actors],cursor:page.cursor}:r))}catch(e){if(current===scope.current)setError((e as Error).message)}}
 return {rows,busy,error,toggle,more}
}
export type Reactions=ReturnType<typeof useReactions>
const attrs=(reactions:Reactions,emoji:string,row?:Reaction)=>({type:'button' as const,disabled:reactions.busy,'aria-pressed':row?.mine??false,'aria-label':`${row?.mine?'Remove':'Add'} ${emoji} reaction`,'data-tooltip':`${row?.mine?'Remove':'Add'} ${emoji} reaction`,onClick:()=>void reactions.toggle(emoji)})
const counted=(reactions:Reactions)=>choices.flatMap(emoji=>{const row=reactions.rows.find(r=>r.emoji===emoji);return row&&row.count>0?[row]:[]})
// Emoji that someone used appear here as count chips; "Who reacted" ends the row.
export function ReactionChips({reactions}:{reactions:Reactions}){
 const used=counted(reactions),error=reactions.error&&<small role="status">{reactions.error}</small>
 if(!used.length)return <>{error}</>
 return <div className="reaction-chips" aria-label="Message reactions">{used.map(row=><button key={row.emoji} {...attrs(reactions,row.emoji,row)}>{row.emoji}<span>{row.count}</span></button>)}<details className="reveal"><summary>Who reacted</summary>{used.map(row=><p key={row.emoji}>{row.emoji} {names(row)}{row.cursor&&<button onClick={()=>void reactions.more(row)}>More people</button>}</p>)}</details>{error}</div>
}
// The tray's reaction controls: a quick 👍 while nobody used it, and a menu with the other emoji nobody used yet.
export function ReactionPicker({reactions}:{reactions:Reactions}){
 const menu=useRef<HTMLDetailsElement>(null)
 useDismiss(menu)
 const used=new Set(counted(reactions).map(r=>r.emoji)),others=choices.filter(e=>e!=='👍'&&!used.has(e))
 const pick=(emoji:string)=>{void reactions.toggle(emoji);if(menu.current){menu.current.open=false;menu.current.querySelector<HTMLElement>('summary')?.focus()}}
 return <>
  {!used.has('👍')&&<button className="icon-button" {...attrs(reactions,'👍')}>👍</button>}
  {others.length>0&&<details className="react-menu menu" ref={menu}><summary className="icon-button" data-tooltip="Add reaction" aria-label="Add reaction"><IconReact/><span className="sr-only">Add reaction</span></summary><div className="popover strip end">{others.map(emoji=>{const props=attrs(reactions,emoji);return <button key={emoji} {...props} onClick={()=>pick(emoji)}>{emoji}</button>})}</div></details>}
 </>
}
