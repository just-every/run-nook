import {draftKey,readDraft,type Draft,type DraftScope} from '../chat/drafts'
export type LocalDraft={scope:DraftScope;draft:Draft}
export function localDrafts(user:string,conversations:Set<string>):LocalDraft[]{
 const prefix=draftKey({user,conversation:'',parent:null}).slice(0,-1),items:LocalDraft[]=[]
 for(const key of Object.keys(localStorage).sort()){
  if(!key.startsWith(prefix))continue
  const parts=key.slice(prefix.length).split(':')
  if(parts.length!==2)continue
  const scope={user,conversation:decodeURIComponent(parts[0]),parent:decodeURIComponent(parts[1])||null}
  // The current workspace snapshot is a visibility bound. Never decode or show
  // content from a removed conversation or another installation/account.
  if(!conversations.has(scope.conversation))continue
  const draft=readDraft(scope)
  if(draft.body.trim()||draft.files.length||draft.pending||draft.upload)items.push({scope,draft})
 }
 return items
}
