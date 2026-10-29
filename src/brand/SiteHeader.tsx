import { NookMark } from './NookMark'
import { sourceUrl } from './links'

// `current` marks the section the visitor is in (the docs mark Docs). `signedIn` swaps Sign in for the way into the
// workspace. The run site also links /contract, which an installation does not serve.
export function SiteHeader({current, variant = 'instance', signedIn = false}: {current?: 'docs'; variant?: 'instance' | 'site'; signedIn?: boolean}) {
  return (
    <header className="site-header">
      <a className="site-brand" href="/" aria-label="Nook">
        <NookMark className="site-brand-mark" />
        <span className="site-brand-word" aria-hidden="true">nook</span>
      </a>
      <nav className="site-nav" aria-label="Primary navigation">
        <a href="/docs" aria-current={current === 'docs' ? 'page' : undefined}>Docs</a>
        {variant === 'site' && <a href="/contract">Contract</a>}
        <a href={sourceUrl}>Source</a>
        {variant === 'instance' && (signedIn ? <a className="site-signin" href="/app">Open Nook</a> : <a className="site-signin" href="/signin">Sign in</a>)}
      </nav>
    </header>
  )
}
