import './hero.css'
import { HeroAlcove } from './HeroAlcove'
import { sourceUrl } from '../brand/links'

export function Hero({variant = 'instance'}: {variant?: 'instance' | 'site'}) {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-copy">
        <h1 id="hero-title">Talk it through. Get it done.</h1>
        <p className="hero-sub">Turn a message into a decision or a request. Everyone can see who’s on it.</p>
        <div className="hero-actions">
          <a className="hero-primary" href={variant === 'site' ? '/run' : sourceUrl}>{variant === 'site' ? 'Run Nook' : 'Get the code'}</a>
          <a className="hero-secondary" href="/docs">Read the docs</a>
        </div>
        <p className="hero-free"><span className="hero-free-part">100% free, open source alternative</span> <span className="hero-free-part">to <strong>Slack</strong> and <strong>Microsoft Teams</strong></span></p>
      </div>
      <HeroAlcove />
    </section>
  )
}
