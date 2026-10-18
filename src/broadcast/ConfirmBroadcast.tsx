import {useEffect,useId,useRef} from 'react'
import {containDialogFocus} from '../chat/dialog-focus'
export type BroadcastPreview={kind:'channel'|'here'|'everyone';recipients:number;quiet:number;otherZones:number}
export function ConfirmBroadcast({preview,onConfirm,onCancel}:{preview:BroadcastPreview;onConfirm:()=>void;onCancel:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),id=useId()
 useEffect(()=>{const origin=document.activeElement as HTMLElement|null;dialog.current?.showModal();return()=>{if(origin?.isConnected)origin.focus({preventScroll:true})}},[])
 return <dialog ref={dialog} aria-labelledby={id} onKeyDown={containDialogFocus} onCancel={event=>{event.preventDefault();onCancel()}}><div className="dialog-heading"><h2 id={id}>Notify {preview.recipients} people?</h2></div><p>@{preview.kind} will notify {preview.recipients} people. {preview.otherZones} are in other time zones; {preview.quiet} are in quiet time.</p><p className="dialog-note">Quiet time defers this broadcast. Muted conversations and people who ignore broadcasts are excluded. Recipients are resolved when you send.</p><div className="dialog-actions"><button type="button" className="soft-button" autoFocus onClick={onCancel}>Keep editing</button><button type="button" className="send" onClick={onConfirm}>Send broadcast</button></div></dialog>
}
