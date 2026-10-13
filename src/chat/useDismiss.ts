import {useEffect} from 'react'
import type {RefObject} from 'react'
// Dismisses a <details> menu: Escape inside it closes it and returns focus to its summary; a press outside closes it,
// except while a dialog is open (the dialog was opened from the menu and hands focus back to the item inside it).
// It never closes on focusout. The outside-press listener exists only while the menu is open (or opening).
// `settled` names the state the menu acts on (a message's version, an outcome's version and status). When it changes,
// the item's work is done: the menu closes as soon as no dialog is open, and focus inside it moves to its summary.
export function useDismiss(ref:RefObject<HTMLDetailsElement|null>,settled?:unknown) {
 useEffect(()=>{
  const menu=ref.current;if(!menu)return
  const key=(event:KeyboardEvent)=>{if(event.key!=='Escape'||!menu.open)return;event.stopPropagation();menu.open=false;menu.querySelector<HTMLElement>('summary')?.focus()}
  const press=(event:PointerEvent)=>{if(!menu.open||(event.target instanceof Node&&menu.contains(event.target))||document.querySelector('dialog[open]'))return;menu.open=false}
  let listening=false
  const listen=()=>{if(!listening){document.addEventListener('pointerdown',press,true);listening=true}}
  const sync=()=>{if(menu.open)listen();else if(listening){document.removeEventListener('pointerdown',press,true);listening=false}}
  // The toggle event comes a task after the summary's click, so a press on the summary starts listening at once.
  const arm=(event:PointerEvent)=>{if(event.target instanceof Element&&event.target.closest('summary')?.parentElement===menu)listen()}
  menu.addEventListener('keydown',key);menu.addEventListener('toggle',sync);menu.addEventListener('pointerdown',arm);sync()
  return ()=>{menu.removeEventListener('keydown',key);menu.removeEventListener('toggle',sync);menu.removeEventListener('pointerdown',arm);if(listening)document.removeEventListener('pointerdown',press,true)}
 },[ref])
 useEffect(()=>{
  const menu=ref.current;if(!menu?.open)return
  const close=()=>{const inside=menu.contains(document.activeElement);menu.open=false;if(inside)menu.querySelector<HTMLElement>('summary')?.focus({preventScroll:true})}
  if(!document.querySelector('dialog[open]')){close();return}
  // The dialog that did the work is still up: close once it hands focus back.
  const after=()=>{if(document.querySelector('dialog[open]'))return;document.removeEventListener('focusin',after,true);close()}
  document.addEventListener('focusin',after,true)
  return ()=>document.removeEventListener('focusin',after,true)
 },[ref,settled])
}
