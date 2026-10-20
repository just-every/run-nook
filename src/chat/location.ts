import {useEffect,useState} from 'react'
import type {LocationState,Screen} from './types'
const views:Screen[]=['people','files','drafts','chat','reminders','scheduled','unreads','attention','threads','channels','search','you','team','saved']
export function readLocation(search=location.search):LocationState {
 const p=new URLSearchParams(search),view=p.get('view') as Screen
 const selected=views.includes(view)?view:p.has('conversation')?'chat':'channels',conversation=p.get('conversation'),thread=p.get('thread'),focus=p.get('focus'),panel=p.get('panel')==='outcomes'?'outcomes':p.get('panel')==='notes'?'notes':null,before=p.get('before'),threadBefore=p.get('threadBefore')
 return {view:selected,conversation,thread,focus,panel,before,threadBefore,q:p.get('q')||'',landing:selected==='chat'&&Boolean(conversation)&&!thread&&!focus&&!panel&&!before&&!threadBefore}
}
export function useLocation(initial?:LocationState) {
 const [route,setRoute]=useState<LocationState>(initial??{view:'channels',conversation:null,thread:null,focus:null,panel:null,before:null,threadBefore:null,q:'',landing:false})
 useEffect(()=>{const update=()=>setRoute(readLocation());update();window.addEventListener('popstate',update);return ()=>window.removeEventListener('popstate',update)},[])
 function navigate(next:Partial<LocationState>,replace=false) {
  const state={...route,...next},selecting=state.view==='chat'&&Boolean(state.conversation)&&(route.view!=='chat'||state.conversation!==route.conversation),positionKeys=['thread','focus','panel','before','threadBefore'] as const,positionSpecified=positionKeys.some(key=>Object.prototype.hasOwnProperty.call(next,key)),explicitPosition=Boolean(state.thread||state.focus||Boolean(state.panel)||state.before||state.threadBefore)
  state.landing=typeof next.landing==='boolean'?next.landing:selecting?!explicitPosition:positionSpecified?false:route.landing&&state.view==='chat'
  const p=new URLSearchParams();p.set('view',state.view)
  for(const key of ['conversation','thread','focus','panel','before','threadBefore','q'] as const)if(state[key])p.set(key,state[key]!)
  setRoute(state);history[replace?'replaceState':'pushState'](null,'','/app?'+p)
 }
 return {route,navigate}
}
