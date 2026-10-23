import {useEffect,useState} from 'react'
import {api} from '../chat/api'
import {useTeamBindings} from './TeamBindings'
import type {Bookmark,BookmarkState} from './bookmarks-types'
import './bookmarks.css'
// A strip of the channel's bookmarks, shown only once it has some. A link opens in a new tab and is never fetched by Nook;
// a file opens through the ordinary file door, which checks the reader's current access.
function Item({item}:{item:Bookmark}){
 if(item.kind==='link')return <a className="bookmark" href={item.url} target="_blank" rel="noopener noreferrer nofollow">{item.title}</a>
 if(item.kind==='file')return item.file?.available?<a className="bookmark" href={`/api/attachments/${item.file.id}/download`} download={item.file.name}>{item.title}</a>:<span className="bookmark muted">{item.title} · file unavailable</span>
 return null
}
export function BookmarksBar({conversation}:{conversation:string}){
 const team=useTeamBindings(),[state,setState]=useState<BookmarkState|null>(null)
 useEffect(()=>{let live=true;setState(null);void api<BookmarkState>(`channels/${encodeURIComponent(conversation)}/bookmarks`).then(next=>{if(live)setState(next)}).catch(()=>{if(live)setState(null)});return()=>{live=false}},[conversation,team.revision,team.accessEpoch])
 if(!state?.items.length)return null
 const top=state.items.filter(i=>!i.parent)
 return <nav className="bookmarks-bar" aria-label="Channel bookmarks"><ul>{top.map(item=><li key={item.id}>{item.kind==='folder'
  ?<details className="bookmark-folder menu"><summary className="bookmark">{item.title} ({state.items.filter(i=>i.parent===item.id).length})</summary><ul className="popover inline">{state.items.filter(i=>i.parent===item.id).map(child=><li key={child.id}><Item item={child}/></li>)}</ul></details>
  :<Item item={item}/>}</li>)}</ul></nav>
}
