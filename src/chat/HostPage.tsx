import './host-strip.css'
import type {ReactNode} from 'react'
import type {LocationState,Screen} from './types'
import {hosts,hostOf} from './hosts'
// One segmented strip under the header, the same at both widths. The selected segment is page-level (aria-pressed),
// never a rail or bar item. Tapping the lit segment returns to that segment's own root; the search query never carries over.
export function HostPage({view,onNavigate,children}:{view:Screen;onNavigate:(view:Screen,extra?:Partial<LocationState>)=>void;children:ReactNode}){
 const host=hostOf(view)
 if(!host)return <>{children}</>
 const {label,segments}=hosts[host]
 return <div className="host-page"><div className="host-strip-row"><nav className="host-strip" aria-label={label}>{segments.map(s=><button key={s.view} aria-pressed={s.views.includes(view)} onClick={()=>onNavigate(s.view,{q:''})}>{s.label}</button>)}</nav></div>{children}</div>
}
