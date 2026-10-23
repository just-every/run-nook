import {useEffect,useId,useRef,useState,type ButtonHTMLAttributes} from 'react'
import './tooltip.css'

// One tooltip behaviour for icon controls, including controls in modal dialogs.
export function TooltipButton({label,children,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{label:string}){
 const id=useId(),button=useRef<HTMLButtonElement>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null)
 const [point,setPoint]=useState<{left:number;top:number;above:boolean}|null>(null)
 const hide=()=>{if(timer.current)clearTimeout(timer.current);timer.current=null;setPoint(null)}
 const show=()=>{const rect=button.current?.getBoundingClientRect();if(rect)setPoint({left:Math.max(8,Math.min(innerWidth-248,rect.left+rect.width/2-120)),top:rect.top>=48?rect.top-10:rect.bottom+10,above:rect.top>=48})}
 const later=()=>{hide();timer.current=setTimeout(show,300)}
 useEffect(()=>{const dismiss=(event:Event)=>{if(event.type==='scroll'||(event as KeyboardEvent).key==='Escape')hide()};window.addEventListener('scroll',dismiss,true);window.addEventListener('keydown',dismiss);return()=>{if(timer.current)clearTimeout(timer.current);window.removeEventListener('scroll',dismiss,true);window.removeEventListener('keydown',dismiss)}},[])
 return <span className="tooltip-control"><button {...props} type={props.type??'button'} ref={button} aria-label={label} aria-describedby={point?id:undefined} onPointerEnter={event=>{if(event.pointerType!=='touch')later()}} onPointerLeave={hide} onFocus={show} onBlur={hide} onPointerDown={event=>{if(event.pointerType==='touch')later()}} onPointerUp={event=>{if(event.pointerType==='touch')hide()}} onPointerCancel={hide} onContextMenu={event=>{if(point)event.preventDefault()}}>{children}</button>{point&&<span id={id} role="tooltip" className="action-tooltip" style={{left:point.left,top:point.top,transform:point.above?'translateY(-100%)':undefined}}>{label}</span>}</span>
}
