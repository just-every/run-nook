import {useId,useState} from 'react'
import type {Conversation,Person} from '../types'

export type FormatAction='bold'|'italic'|'strike'|'code'|'block'|'quote'|'bullet'|'number'|'link'
export function formatSelection(body:string,start:number,end:number,action:FormatAction){
 const selected=body.slice(start,end)
 const wrap:Partial<Record<FormatAction,[string,string,string]>>={bold:['**','**','bold text'],italic:['_','_','italic text'],strike:['~~','~~','struck text'],code:['`','`','code'],block:['\n```\n','\n```\n','code'],link:['[','](https://)','link text']}
 const spec=wrap[action]
 if(spec){const content=selected||spec[2],text=spec[0]+content+spec[1];return {body:body.slice(0,start)+text+body.slice(end),start:start+spec[0].length,end:start+spec[0].length+content.length}}
 const lineStart=body.lastIndexOf('\n',Math.max(0,start-1))+1,prefix=action==='quote'?'> ':action==='number'?'1. ':'- '
 const text=body.slice(lineStart,end).split('\n').map((line,index)=>(action==='number'?`${index+1}. `:prefix)+line).join('\n')
 return {body:body.slice(0,lineStart)+text+body.slice(end),start:lineStart,end:lineStart+text.length}
}
const emoji=[['😀','Smile'],['👍','Thumbs up'],['❤️','Heart'],['🎉','Celebrate'],['🙏','Thank you'],['👀','Eyes'],['✅','Done'],['🤔','Thinking'],['🌴','Palm tree'],['🚀','Rocket']] as const
export function CompositionTools({disabled,enabled,onToggle,onFormat,onInsert,members,channels,onMention,onDownload,canUndo,onUndo}:{disabled:boolean;enabled:boolean;onToggle:(enabled:boolean)=>void;onFormat:(action:FormatAction)=>void;onInsert:(text:string)=>void;members:Person[];channels:Conversation[];onMention:(person:Person)=>void;onDownload:()=>void;canUndo:boolean;onUndo:()=>void}){
 const [query,setQuery]=useState(''),[open,setOpen]=useState(false),id=useId()
 return <details className="composition-tools" onToggle={e=>setOpen(e.currentTarget.open)}><summary>Format, mention or emoji</summary>{open&&<><div className="composition-toolbar" role="group" aria-label="Text formatting">
  {([['bold','Bold'],['italic','Italic'],['strike','Strikethrough'],['code','Inline code'],['block','Code block'],['quote','Quote'],['bullet','Bulleted list'],['number','Numbered list'],['link','Link']] as const).map(([action,label])=><button key={action} type="button" className="text-button" disabled={disabled} onClick={()=>onFormat(action)}>{label}</button>)}
  <label className="composition-toggle"><input type="checkbox" checked={enabled} onChange={e=>onToggle(e.target.checked)}/>Convert typed formatting</label>
  {canUndo&&<button type="button" className="text-button" disabled={disabled} onClick={onUndo}>Undo formatting</button>}
  <button type="button" className="text-button" onClick={onDownload}>Download text</button>
 </div><div className="composition-pickers"><label htmlFor={id}>Find a mention</label><input id={id} type="search" onKeyDown={e=>{if(e.key==='Enter')e.preventDefault()}} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Person or channel" disabled={disabled}/><div role="group" aria-label="Person mentions">{members.filter(p=>p.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(person=><button className="text-button" type="button" key={person.id} disabled={disabled} onClick={()=>onMention(person)}>@{person.name}</button>)}</div><div role="group" aria-label="Channel mentions">{channels.filter(c=>c.kind!=='dm'&&c.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(channel=><button className="text-button" type="button" key={channel.id} disabled={disabled} onClick={()=>onInsert(`[#${channel.name.replace(/[\[\]\\]/g,'')}](/app?view=chat&conversation=${encodeURIComponent(channel.id)}) `)}>#{channel.name}</button>)}</div></div><div role="group" aria-label="Emoji" className="composition-emoji">{emoji.map(([value,label])=><button type="button" className="icon-button" key={label} data-tooltip={'Insert '+label.toLowerCase()} aria-label={'Insert '+label.toLowerCase()} disabled={disabled} onClick={()=>onInsert(value)}>{value}</button>)}</div></>}</details>
}
