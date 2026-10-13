import {useEffect,useState} from 'react'
import type {Projection} from './types'

// Replay identifies new native messages, including arrivals outside the loaded
// history window. Opening history and read acknowledgements announce nothing.
export function LiveMessageNotice({projection}:{projection:Projection|null}){
 const [notice,setNotice]=useState<{frontier:number;text:string}|null>(null)
 useEffect(()=>{
  if(projection?.newMessageCount)setNotice({frontier:projection.frontier,text:`${projection.newMessageCount} new ${projection.newMessageCount===1?'message':'messages'} in this conversation.`})
 },[projection?.frontier,projection?.newMessageCount])
 return <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{notice&&<span key={notice.frontier}>{notice.text}</span>}</div>
}
