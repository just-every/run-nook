import {useRef} from 'react'
import type {Person} from './types'
import {Avatar} from './Avatar'
import {useDismiss} from './useDismiss'
// The owner block at the foot of the rail opens a small menu: the profile page, and Sign out. Enter or Space opens it,
// Escape closes it and returns focus to the block.
export function ProfileMenu({user,selected,onProfile,onSignOut}:{user:Person;selected:boolean;onProfile:()=>void;onSignOut:()=>void}) {
 const menu=useRef<HTMLDetailsElement>(null)
 useDismiss(menu)
 const choose=(action:()=>void)=>{if(menu.current)menu.current.open=false;action()}
 return <details className="menu profile-menu" ref={menu}><summary className={'profile'+(selected?' selected':'')}><Avatar person={user} size={28}/><span>{user.name}{user.status&&<small style={{display:'block',overflowWrap:'anywhere'}}>{user.status.emoji} {user.status.text}</small>}</span><span className="sr-only">Your profile and sign out</span></summary><div className="popover up"><button type="button" onClick={()=>choose(onProfile)}>Your profile</button><button type="button" onClick={()=>choose(onSignOut)}>Sign out</button></div></details>
}
