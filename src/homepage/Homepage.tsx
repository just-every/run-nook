import '../brand/tokens.css'
import '../brand/site-chrome.css'
import './homepage.css'
import './sections.css'
import './drawings.css'
import { Hero } from './Hero'
import { SiteFooter } from '../brand/SiteFooter'
import { SiteHeader } from '../brand/SiteHeader'
import { Attention } from './sections/Attention'
import { Free } from './sections/Free'
import { GetStarted } from './sections/GetStarted'
import { MoveIn } from './sections/MoveIn'
import { Product } from './sections/Product'
import { useRevealOnce } from './useRevealOnce'

function focusMain() {
  window.requestAnimationFrame(() => document.getElementById('main-content')?.focus({ preventScroll: true }))
}

export function Homepage({variant = 'instance'}: {variant?: 'instance' | 'site'}) {
  useRevealOnce('.nook-home', '.home-section .nook-drawing')
  return (
    <div className="nook-home nook-site">
      <a className="home-skip-link" href="#main-content" onClick={focusMain}>Skip to content</a>
      <SiteHeader variant={variant} />
      <main className="home-main" id="main-content" tabIndex={-1}>
        <Hero variant={variant} />
        <Free variant={variant} />
        <Attention />
        <Product />
        <MoveIn />
        <GetStarted variant={variant} />
      </main>
      <SiteFooter variant={variant} />
    </div>
  )
}
