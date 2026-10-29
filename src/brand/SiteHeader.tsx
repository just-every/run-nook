import { NookMark } from './NookMark'
import { sourceUrl } from './links'

// `current` marks the section the visitor is in (the docs mark Docs, the contract page marks Contract). The run site
// also links /contract, which an installation does not serve.
export function SiteHeader({current, variant = 'instance'}: {current?: 'docs' | 'contract'; variant?: 'instance' | 'site'}) {
  return (
    <header className="site-header">
      <a className="site-brand" href="/" aria-label="Nook">
        <NookMark className="site-brand-mark" />
        <span className="site-brand-word" aria-hidden="true">nook</span>
      </a>
      <nav className="site-nav" aria-label="Primary navigation">
        <a href="/docs" aria-current={current === 'docs' ? 'page' : undefined}>Docs</a>
        {variant === 'site' && <a href="/contract" aria-current={current === 'contract' ? 'page' : undefined}>Contract</a>}
        <a href={sourceUrl}>Source</a>
        {variant === 'instance' && <a className="site-signin" href="/signin">Sign in</a>}
      </nav>
    </header>
  )
}
