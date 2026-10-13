import { Children } from 'react'
import { HydrationUnit } from '../base/hydration/unit'
import type {ReactNode} from 'react'
import {NookMark} from './NookMark'
import {accentStyle} from './accent'
import './tokens.css'
import './frame.css'

// The quiet page around one card (sign-in, page not found): the mark and wordmark
// lead home, and the card sits in the nook, a rose-wash arch behind it.
export function NookFrame({id, label, children}: {id: string; label: string; children: ReactNode}) {
  return <div className="nook-frame" style={accentStyle}>
    <a className="frame-skip" href={'#' + id} onClick={event => {event.preventDefault(); document.getElementById(id)?.focus()}}>{label}</a>
    <a className="frame-brand" href="/" aria-label="Nook home"><NookMark className="frame-mark"/><span aria-hidden="true">nook</span></a>
    <div className="frame-nook">
      <main id={id} tabIndex={-1} className="frame-card">{Children.map(children, child => <HydrationUnit>{child}</HydrationUnit>)}</main>
    </div>
  </div>
}
