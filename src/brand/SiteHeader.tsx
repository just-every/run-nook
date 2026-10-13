import { NookMark } from './NookMark'
import { sourceUrl } from './links'

// `current` marks the section the visitor is in (the docs mark Docs).
export function SiteHeader({current}: {current?: 'docs'}) {
  return (
    <header className="site-header">
      <a className="site-brand" href="/" aria-label="Nook">
        <NookMark className="site-brand-mark" />
        <span className="site-brand-word" aria-hidden="true">nook</span>
      </a>
      <nav className="site-nav" aria-label="Primary navigation">
        <a href="/docs" aria-current={current === 'docs' ? 'page' : undefined}>Docs</a>
        <a href={sourceUrl}>Source</a>
        <a className="site-signin" href="/signin">Sign in</a>
      </nav>
    </header>
  )
}
