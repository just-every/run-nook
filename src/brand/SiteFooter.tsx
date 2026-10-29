import { NookMark } from './NookMark'
import { sourceUrl } from './links'

export function SiteFooter({variant = 'instance', signedIn = false}: {variant?: 'instance' | 'site'; signedIn?: boolean}) {
  return (
    <footer className="site-footer">
      <div className="site-footer-brand">
        <a className="footer-brand" href="/" aria-label="Nook home">
          <NookMark className="site-brand-mark" />
          <span className="site-brand-word" aria-hidden="true">nook</span>
        </a>
        <p>Room for your team.</p>
      </div>
      <nav className="site-footer-nav" aria-label="Footer">
        <a href="/docs">Docs</a>
        <a href={sourceUrl}>Source</a>
        {variant === 'instance' && (signedIn ? <a href="/app">Open Nook</a> : <a href="/signin">Sign in</a>)}
        <span className="footer-licence">MIT licensed</span>
      </nav>
    </footer>
  )
}
