import type {KeyboardEvent} from 'react'

// Keep keyboard cycling inside the modal, including at the browser chrome boundary.
export function containDialogFocus(event:KeyboardEvent<HTMLDialogElement>){
 if(event.key!=='Tab')return
 const controls=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled):not([type="hidden"]),select:not(:disabled),textarea:not(:disabled),[tabindex]')).filter(element=>element.tabIndex>=0&&element.getClientRects().length>0&&getComputedStyle(element).visibility!=='hidden')
 const first=controls[0],last=controls.at(-1)
 if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
 else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
}
