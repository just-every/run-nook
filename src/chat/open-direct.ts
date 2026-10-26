import type {Conversation,Person} from './types'
import type {TeamRequest} from '../team/types'
export async function openDirect(person:Pick<Person,'id'|'name'>,{conversations,request,signal,refresh,select}:{conversations:Conversation[];request:TeamRequest;signal:AbortSignal;refresh:()=>Promise<void>;select:(conversation:Conversation)=>void}){
 if(signal.aborted)return
 const existing=conversations.find(c=>c.kind==='dm'&&c.participants?.length===2&&c.participants.some(p=>p.id===person.id))
 if(existing){select(existing);return}
 const conversation=await request<Conversation>('/api/conversations',{method:'POST',body:JSON.stringify({name:person.name,kind:'dm',participants:[person.id]}),signal})
 if(signal.aborted)return
 await refresh()
 if(!signal.aborted)select(conversation)
}
