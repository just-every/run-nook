import {useEffect,useId,useLayoutEffect,useRef,useState,type ButtonHTMLAttributes} from 'react'
import {createPortal} from 'react-dom'
import './tooltip.css'

// A single event surface also supports summary, file labels and disabled buttons,
// without inserting wrappers into the header or message tray layout.
export function TooltipSurface(){
 const id=useId(),tip=useRef<HTMLSpanElement>(null)
 const [active,setActive]=useState<HTMLElement|null>(null),[position,setPosition]=useState({left:8,top:8})
 useEffect(()=>{
  let timer:ReturnType<typeof setTimeout>|undefined,shown:HTMLElement|null=null,touch=false
  const descriptionTarget=(element:HTMLElement)=>element instanceof HTMLLabelElement?element.control??element:element
  const hide=()=>{clearTimeout(timer);if(shown){const target=descriptionTarget(shown),values=(target.getAttribute('aria-describedby')??'').split(' ').filter(value=>value&&value!==id);if(values.length)target.setAttribute('aria-describedby',values.join(' '));else target.removeAttribute('aria-describedby')}shown=null;setActive(null)}
  const trigger=(event:Event)=>event.target instanceof Element?event.target.closest<HTMLElement>('[data-tooltip]'):null
  const show=(element:HTMLElement)=>{hide();if(!element.isConnected)return;shown=element;const target=descriptionTarget(element),values=(target.getAttribute('aria-describedby')??'').split(' ').filter(Boolean);target.setAttribute('aria-describedby',[...values,id].join(' '));setActive(element)}
  const enter=(event:PointerEvent)=>{if(event.pointerType==='touch')return;const element=trigger(event);if(!element||element.contains(event.relatedTarget as Node))return;hide();timer=setTimeout(()=>show(element),300)}
  const leave=(event:PointerEvent)=>{const element=trigger(event);if(element&&!element.contains(event.relatedTarget as Node))hide()}
  const focus=(event:FocusEvent)=>{const element=trigger(event);if(element&&!touch)show(element)}
  const down=(event:PointerEvent)=>{touch=event.pointerType==='touch';hide();const element=trigger(event);if(touch&&element)timer=setTimeout(()=>show(element),300)}
  const up=()=>{if(touch)hide()}
  const context=(event:MouseEvent)=>{if(touch&&shown)event.preventDefault()}
  const key=(event:KeyboardEvent)=>{touch=false;if(event.key==='Escape')hide()}
  const scroll=()=>hide()
  document.addEventListener('pointerover',enter,true);document.addEventListener('pointerout',leave,true);document.addEventListener('focusin',focus,true);document.addEventListener('focusout',hide,true);document.addEventListener('pointerdown',down,true);document.addEventListener('pointerup',up,true);document.addEventListener('pointercancel',up,true);document.addEventListener('contextmenu',context,true);document.addEventListener('keydown',key,true);window.addEventListener('scroll',scroll,true);window.addEventListener('resize',hide)
  return()=>{hide();document.removeEventListener('pointerover',enter,true);document.removeEventListener('pointerout',leave,true);document.removeEventListener('focusin',focus,true);document.removeEventListener('focusout',hide,true);document.removeEventListener('pointerdown',down,true);document.removeEventListener('pointerup',up,true);document.removeEventListener('pointercancel',up,true);document.removeEventListener('contextmenu',context,true);document.removeEventListener('keydown',key,true);window.removeEventListener('scroll',scroll,true);window.removeEventListener('resize',hide)}
 },[id])
 // The tip follows its control while it is shown: a dialog that grows as its content loads, or settles from its entrance, moves the control.
 useLayoutEffect(()=>{
  if(!active)return
  let frame=0
  const place=()=>{
   const box=tip.current?.getBoundingClientRect()
   if(box&&active.isConnected){
    const rect=active.getBoundingClientRect(),margin=8,above=rect.top-box.height-margin>=margin
    const left=Math.max(margin,Math.min(innerWidth-box.width-margin,rect.left+(rect.width-box.width)/2)),top=above?rect.top-box.height-margin:rect.bottom+margin
    setPosition(old=>old.left===left&&old.top===top?old:{left,top})
   }
   frame=requestAnimationFrame(place)
  }
  place();return()=>cancelAnimationFrame(frame)
 },[active])
 if(!active)return null
 // A dialog is in the top layer: its tooltip must live there too.
 return createPortal(<span ref={tip} id={id} role="tooltip" className="action-tooltip" style={position}>{active.dataset.tooltip}</span>,active.closest('dialog')??active.closest('.nook-app')??document.body)
}
export function TooltipButton({label,children,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{label:string}){
 return <button {...props} title={undefined} type={props.type??'button'} aria-label={label} data-tooltip={label}>{children}</button>
}
