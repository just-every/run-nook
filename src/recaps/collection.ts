import type {Context} from '../platform/storage/context'
import {retrieve,type Range,type Passage} from './range'
// The collection uses the same per-source retrieval door and one global bound.
// Revoked conversations contribute neither content, names nor omission counts.
export async function retrieveCollection(c:Context,ranges:Range[]){
 const passages:Passage[]=[],outcomes:any[]=[],omissions:{name:string;status:string}[]=[];let bytes=0,omitted=0,more=false
 for(const range of ranges){
  if(passages.length===8){more=true;break}
  let current:Awaited<ReturnType<typeof retrieve>>
  try{current=await retrieve(c,range)}catch(error){if([403,404].includes((error as any).status))continue;throw error}
  for(const passage of current.passages){const size=new TextEncoder().encode(passage.text).length;if(passages.length===8||bytes+size>32768){omitted++;continue}passages.push(passage);bytes+=size}
  outcomes.push(...current.outcomes.filter(o=>passages.some(p=>p.message===o.source)));omissions.push(...current.omissions);omitted+=current.omitted;more ||= current.more
 }
 return {passages,outcomes:outcomes.slice(0,100),omissions,omitted,more,bytes}
}
