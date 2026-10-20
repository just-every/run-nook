import type {Context} from './context'
import {read} from './read'

export async function conversationProjection(c:Context,q:URLSearchParams){
 const id=q.get('conversation')!,landing=q.get('landing')==='1'
 const thread=q.get('thread'),focus=q.get('focus'),before=q.get('before'),threadBefore=q.get('threadBefore')
 const explicit=!landing&&Boolean(thread||focus||Boolean(q.get('panel'))||before||threadBefore)
 const retained=landing&&!explicit?q.get('target'):null
 const options=before?{before}:explicit&&focus&&!thread&&q.get('panel')!=='outcomes'?{around:focus}:retained?{around:retained}:landing&&q.get('mobile')==='1'?{firstUnread:true}:{}
 const [rootWindow,outcomes,members,roster,preferences]=await Promise.all([
  read(c,'historyWindow',id,{limit:50,...options}),read(c,'outcomes',id),
  read(c,'members',id),read(c,'roster',id),read(c,'preferences',id),
 ])
 const selectedThread=landing?rootWindow.target?.parent?rootWindow.target.root:null:thread
 const threadWindow=selectedThread?await read(c,'historyWindow',id,{limit:50,thread:selectedThread,before:threadBefore,around:threadBefore?null:landing?rootWindow.target?.id:focus}):null
 return {conversation:id,rootWindow,threadWindow,outcomes,members,roster,preferences,frontier:Math.min(rootWindow.frontier,threadWindow?.frontier??rootWindow.frontier),newMessageCount:0}
}
