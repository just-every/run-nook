import {useState} from 'react'
import type {Person} from './types'
import {Avatar} from './Avatar'

type Props={users:Person[];user:Person;busy:boolean;feedback:React.ReactNode;create:(participants:string[])=>void}
export function NewMessage({users,user,busy,feedback,create}:Props){
 const [query,setQuery]=useState(''),[group,setGroup]=useState(false),[selected,setSelected]=useState<string[]>([])
 const people=users.filter(p=>p.id!==user.id&&p.active!==0&&p.mode!=='guest'),matches=people.filter(p=>p.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
 return <>
  <button className="text-button" disabled={busy} onClick={()=>{setGroup(!group);setQuery('');setSelected([])}}>{group?'Message one person':'Start a group message'}</button>
  <label className="field">Find a teammate<input autoFocus value={query} onChange={e=>setQuery(e.target.value)} disabled={busy}/></label>
  {group?<form onSubmit={event=>{event.preventDefault();if(selected.length>=2&&!busy)create(selected)}}>
   <fieldset><legend>Choose teammates · {selected.length} selected</legend><div className="check-grid">{matches.map(p=><label className="check" key={p.id}><input type="checkbox" checked={selected.includes(p.id)} disabled={busy||selected.length>=49&&!selected.includes(p.id)} onChange={event=>setSelected(current=>event.target.checked?[...current,p.id]:current.filter(id=>id!==p.id))}/>{p.name}</label>)}</div></fieldset>
   {!matches.length&&<p className="dialog-note">No matching teammates.</p>}
   <p className="dialog-note">Choose at least two teammates. Only you and the people selected can read this conversation. Its participants stay fixed.</p>
   {feedback}<button className="send" disabled={busy||selected.length<2}>Start group message</button>
  </form>:<><div className="people-picker">{matches.map(p=><button key={p.id} disabled={busy} onClick={()=>create([p.id])}><Avatar person={p} size={28}/><span>{p.name}</span></button>)}</div>{!matches.length&&<p className="dialog-note">No matching teammates.</p>}{feedback}</>}
 </>
}
