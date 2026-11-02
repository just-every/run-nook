import type {Screen} from './types'
// Attention and Search each host the views that used to be rail rows. A segment is an existing view value, so no URL form is new.
export type Host='attention'|'search'
export const hosts:Record<Host,{title:string;label:string;segments:{label:string;view:Screen;views:Screen[]}[]}>={
 attention:{title:'Attention',label:'Attention sections',segments:[
  {label:'Needs you',view:'attention',views:['attention']},
  {label:'Reminders',view:'reminders',views:['reminders']},
  {label:'Drafts & sent',view:'drafts',views:['drafts','scheduled']},
 ]},
 search:{title:'Search',label:'Search sections',segments:[
  {label:'Messages',view:'search',views:['search']},
  {label:'Files',view:'files',views:['files']},
  {label:'People',view:'people',views:['people']},
  {label:'Saved',view:'saved',views:['saved']},
 ]},
}
export function hostOf(view:Screen):Host|null{return (Object.keys(hosts) as Host[]).find(host=>hosts[host].segments.some(s=>s.views.includes(view)))??null}
