import type {Person} from './types'
import type {TeamRequest} from '../team/types'

export async function quickPeople(request:TeamRequest,signal:AbortSignal){
 const people:Person[]=[],seen=new Set<string>();let after:string|null=null
 do{
  const page:{items:Person[];cursor:string|null}=await request('/api/people?limit=200'+(after?'&after='+encodeURIComponent(after):''),{signal})
  people.push(...page.items.map(({id,name})=>({id,name})))
  after=page.cursor
  if(after&&seen.has(after))throw Error('The people directory could not be fully read. Reopen the switcher.')
  if(after)seen.add(after)
 }while(after)
 return people
}
