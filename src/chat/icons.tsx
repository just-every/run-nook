import type {ReactNode} from 'react'
// Line icons for the app: 20x20, 1.6px stroke in currentColor, sized by CSS. Decorative: the control that holds one carries the name.
function Icon({children}:{children:ReactNode}) {
 return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{children}</svg>
}
export const IconReply=()=><Icon><path d="M8 5 3.5 9.5 8 14"/><path d="M3.5 9.5H12a4.5 4.5 0 0 1 4.5 4.5v1"/></Icon>
export const IconAsk=()=><Icon><circle cx="8" cy="6.5" r="3"/><path d="M2.5 16c.4-3 2.6-4.6 5.5-4.6 1.1 0 2 .2 2.8.7"/><path d="M15 11v5M12.5 13.5h5"/></Icon>
export const IconDecide=()=><Icon><path d="M10 2.5 17.5 10 10 17.5 2.5 10Z"/><path d="m7 10 2.2 2.2L13.2 8"/></Icon>
export const IconReact=()=><Icon><circle cx="9" cy="10" r="6.5"/><path d="M6.5 11.6c.6 1 1.5 1.5 2.5 1.5s1.9-.5 2.5-1.5"/><path d="M7 8.3h.01M11 8.3h.01"/><path d="M15.5 2.5v4M13.5 4.5h4"/></Icon>
export const IconMore=()=><Icon><path d="M4.5 10h.01M10 10h.01M15.5 10h.01" strokeWidth="2.6"/></Icon>
export const IconClose=()=><Icon><path d="m5 5 10 10M15 5 5 15"/></Icon>
export const IconBack=()=><Icon><path d="m12 4.5-5.5 5.5L12 15.5"/></Icon>
export const IconForward=()=><Icon><path d="m8 4.5 5.5 5.5L8 15.5"/></Icon>
export const IconAttach=()=><Icon><path d="m15.8 9.4-5.6 5.6a3.6 3.6 0 0 1-5.1-5.1l6-6a2.4 2.4 0 0 1 3.4 3.4l-6 6a1.2 1.2 0 0 1-1.7-1.7l5.4-5.4"/></Icon>
export const IconMention=()=><Icon><circle cx="10" cy="10" r="3"/><path d="M13 7v4.2a2 2 0 0 0 4 0V10a7 7 0 1 0-2.8 5.6"/></Icon>
export const IconBell=()=><Icon><path d="M5 8a5 5 0 0 1 10 0c0 4 1.5 5 1.5 5h-13S5 12 5 8Z"/><path d="M8.3 16.2a1.9 1.9 0 0 0 3.4 0"/></Icon>
export const IconPlus=()=><Icon><path d="M10 4.5v11M4.5 10h11"/></Icon>
export const IconPeople=()=><Icon><circle cx="7.5" cy="7" r="2.8"/><path d="M2.5 16c.4-2.8 2.4-4.4 5-4.4s4.6 1.6 5 4.4"/><circle cx="14" cy="7.6" r="2.2"/><path d="M14.5 11.6c1.7.2 2.7 1.5 3 3.6"/></Icon>
export const IconSearch=()=><Icon><circle cx="9" cy="9" r="5.5"/><path d="m13.2 13.2 3.8 3.8"/></Icon>
