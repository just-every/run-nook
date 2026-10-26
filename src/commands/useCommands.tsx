import {commandIntent} from './intents'
import {useEffect,useRef,useState} from 'react'
import type {Conversation,Person} from '../chat/types'
import {builtinNames} from './catalog'
import {profileTimeZone} from '../profiles/time-zone'
import {parseReminder} from '../reminders/parse.mjs'
import {ApiError} from '../chat/api'
type Prompt={title:string;text:string;confirm?:()=>Promise<void>;confirmLabel?:string}
type Props={user:Person;conversations:Conversation[];current:Conversation|undefined;open:(id:string)=>Promise<void>;refresh:()=>Promise<void>;remind:(phrase:string,saved:()=>void)=>void;left:()=>void;onError:(error:unknown)=>void;signal:AbortSignal}
export function useCommands(p:Props){
 const [prompt,setPrompt]=useState<Prompt|null>(null),[busy,setBusy]=useState(false),literal=useRef('')
 useEffect(()=>{const clear=()=>{setPrompt(null);setBusy(false);literal.current=''};p.signal.addEventListener('abort',clear,{once:true});if(p.signal.aborted)clear();return()=>p.signal.removeEventListener('abort',clear)},[p.signal])
 const call=async<T,>(path:string,body?:unknown,method=body===undefined?'GET':'POST'):Promise<T>=>{
  const response=await fetch('/api/'+path,{method,signal:p.signal,credentials:'same-origin',cache:'no-store',...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})})
  const value=await response.json() as T & {error?:string}
  if(!response.ok){const error=new ApiError(response.status,value.error||'The command could not be completed.');if(response.status===401)p.onError(error);throw error}
  return value
 }
 const person=async(name:string)=>{
  const id=name.replace(/^@/,''),value=id.toLocaleLowerCase()
  try{return (await call<{profile:Person}>('profile?user='+encodeURIComponent(id))).profile}catch(error){if(!(error instanceof ApiError)||error.status!==404)throw error}
  const found:Person[]=[];let after=''
  do{
   const page=await call<{items:Person[];hasMore:boolean;cursor:string|null}>('people?q='+encodeURIComponent(id)+'&limit=200&after='+encodeURIComponent(after))
   found.push(...page.items.filter(user=>user.name.toLocaleLowerCase()===value))
   if(found.length>1||!page.hasMore)break
   after=page.cursor??'';if(!after)throw Error('People search could not be completed.')
  }while(true)
  if(found.length!==1)throw Error('Choose one current person by exact name or ID. Put a name containing spaces in quotes.')
  return found[0]
 }
 const room=(name?:string)=>{if(!name){if(!p.current)throw Error('Open a conversation first.');return p.current}const id=name.replace(/^#/,''),value=id.toLocaleLowerCase(),found=p.conversations.filter(c=>c.id===id||c.name.toLocaleLowerCase()===value);if(found.length!==1)throw Error('Choose one available channel by exact name or ID.');return found[0]}
 const confirm=(title:string,text:string,action:()=>Promise<unknown>,saved:()=>void)=>setPrompt({title,text,confirm:async()=>{await action();if(!p.signal.aborted){saved();await p.refresh();setPrompt(null)}}})
 async function run(body:string,saved:()=>void):Promise<boolean>{
  if(!body.startsWith('/'))return false
  if(literal.current===body){literal.current='';return false}
  if(busy)return true
  const match=/^\/([^\s]+)\s*([\s\S]*)$/.exec(body);if(!match)return false
  const name=match[1].toLowerCase(),args=match[2].trim()
  if(!builtinNames.has(name)){setPrompt({title:'Unknown command',text:`/${name} is not a built-in command. Nothing was posted.`,confirmLabel:'Send as a message',confirm:async()=>{literal.current=body;setPrompt(null);Array.from(document.querySelectorAll<HTMLTextAreaElement>('.composer textarea')).find(field=>field.value===body)?.form?.requestSubmit()}});return true}
  try{
   if(name==='remind'){p.remind(body,saved);return true}
   if(name==='shrug')return false // Composer adds the shrug before saving the send intent.
   if(name==='huddle'||name==='gif'){setPrompt({title:name==='huddle'?'Calls are unavailable':'GIF search is unavailable',text:name==='huddle'?'This installation has no calling service. No call was created.':'This installation has no GIF provider. No message was posted.'});return true}
   if(name==='who'){const c=room(),members=await call<Person[]>(`conversations/${c.id}/members`);if(!p.signal.aborted){setPrompt({title:'Conversation members',text:members.map(x=>x.name).join(', ')});saved()}return true}
   if(name==='collapse'||name==='expand'){const c=room();localStorage.setItem(`nook:previews:${location.origin}:${p.user.id}:${c.id}`,name==='collapse'?'hidden':'shown');window.dispatchEvent(new Event('nook:previews'));saved();return true}
   if(name==='away'||name==='active'){confirm('Change availability',name==='away'?'Set yourself away?':'Set yourself active?',()=>call('broadcast/presence',{page:'availability-command',visible:document.visibilityState==='visible',zone:Intl.DateTimeFormat().resolvedOptions().timeZone,away:name==='away'}),saved);return true}
   if(name==='mute'){const c=room(),old=await call<{muted:boolean}>(`conversations/${c.id}/preferences`);confirm('Conversation notifications',`${old.muted?'Unmute':'Mute'} ${c.name}?`,()=>call(`conversations/${c.id}/preferences`,{muted:!old.muted},'PATCH'),saved);return true}
   if(name==='dnd'){
    const time=/^\d+\s+(minute|hour|day)s?$/i.test(args)?'in '+args:args,profile=await call<{profile:Person}>('profile'),zone=profileTimeZone(profile.profile)
    const parsed=parseReminder('me '+time+' to pause notifications',zone),due=parsed.due
    confirm('Pause notifications','Pause until '+new Date(due).toLocaleString([],{timeZone:zone})+' ('+zone+')?',()=>call('settings',{dndUntil:due},'PATCH'),saved);return true
   }
   if(name==='status'){
    const emoji=/^(:[^: ]+:|[^\p{L}\p{N}\s]+)\s*/u.exec(args),text=emoji?args.slice(emoji[0].length):args
    confirm('Set status',args||'Clear your status?',()=>call('profile',{status:args?{emoji:({'palm_tree':'🌴','smile':'😀','calendar':'📅','house':'🏠'} as Record<string,string>)[emoji?.[1].replaceAll(':','')??'']??emoji?.[1]??'',text,clearAfter:'never'}:null}),saved);return true
   }
   if(['topic','rename','leave'].includes(name)){
    const c=room(),details=await call<{version:number;canManage:boolean;canLeave:boolean;leaveReason:string|null}>(`channels/${c.id}/details`)
    if(name==='leave'){if(!details.canLeave)throw Error(details.leaveReason??'You cannot leave this conversation.');confirm('Leave channel','Leave #'+c.name+'?',async()=>{await call(`channels/${c.id}/leave`,{version:details.version});saved();p.left()},saved);return true}
    if(!details.canManage)throw Error('Only the channel manager or a current owner or admin can change this channel.')
    if(!args&&name==='rename')throw Error('Enter the new channel name.')
    confirm(name==='topic'?'Change topic':'Rename channel',args,()=>call(`channels/${c.id}`,{version:details.version,[name==='topic'?'topic':'name']:name==='rename'?args.replace(/^#/,''):args},'PATCH'),saved);return true
   }
   const target=/^("[^"]+"|\S+)(?:\s+([\s\S]*))?$/.exec(args);if(!target)throw Error('Choose @person and optional text or #channel.')
   const who=await person(target[1].replace(/^"|"$/g,'')),rest=target[2]?.trim()??''
   if(name==='invite'){const c=room(rest);confirm('Invite to channel',`Add ${who.name} to #${c.name}? They will see its full history.`,()=>call(`conversations/${c.id}/members`,{user:who.id}),saved);return true}
   if(name==='msg'||name==='dm'){
    const intent=await commandIntent(p.user.id,body)
    confirm(rest?'Send direct message':'Open direct message',`${who.name}${rest?': '+rest:''}`,async()=>{
     const current=await call<{conversations:Conversation[]}>('workspace'),existing=current.conversations.find(c=>c.kind==='dm'&&c.participants?.length===2&&c.participants.some(user=>user.id===who.id))
     const c=intent.value.conversation?current.conversations.find(c=>c.id===intent.value.conversation):existing??await call<Conversation>('conversations',{name:who.name,kind:'dm',participants:[who.id]})
     if(!c)throw Error('The saved direct conversation is unavailable. Nothing was sent.')
     intent.setConversation(c.id)
     if(rest)await call(`conversations/${c.id}/messages`,{body:rest,intent:intent.value.intent})
     intent.complete();saved();await p.refresh();await p.open(c.id)
    },saved);return true
   }
  }catch(error){if(!p.signal.aborted)setPrompt({title:'Command was not run',text:error instanceof Error?error.message:'The command could not be completed.'})}
  return true
 }
 const notice=prompt&&!p.signal.aborted?<section className="notice-error command-result" aria-label="Command result"><div><strong>{prompt.title}</strong><p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{prompt.text}</p>{prompt.confirm&&<button className="soft-button" disabled={busy} onClick={()=>{setBusy(true);void prompt.confirm!().catch(error=>{if(!p.signal.aborted)setPrompt({title:'Command was not run',text:error instanceof Error?error.message:'Please try again.'})}).finally(()=>setBusy(false))}}>{busy?'Working…':prompt.confirmLabel??'Confirm'}</button>}<button className="text-button" disabled={busy} onClick={()=>setPrompt(null)}>Close</button></div></section>:null
 return {run,notice}
}
