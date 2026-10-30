import '../closing.css'
import { demoUrl, sourceUrl } from '../../brand/links'
import { WelcomeStreet } from '../drawings/WelcomeStreet'

export function GetStarted({variant = 'instance'}: {variant?: 'instance' | 'site'}) {
  return (
    <section className="home-section closing" id="get-started" aria-labelledby="get-started-title">
      <div className="nook-drawing closing-street">
        <WelcomeStreet />
      </div>
      <h2 id="get-started-title">Make room for your team.</h2>
      <div className="home-actions">
        <a className="home-pill" href={variant === 'site' ? '/run' : sourceUrl}>{variant === 'site' ? 'Run Nook' : 'Get the code'}</a>
        {variant === 'site' && <a className="home-link" href={demoUrl}>Try the demo</a>}
        <a className="home-link" href="/docs">Read the docs</a>
      </div>
      <p className="home-free">Open source, MIT licensed.</p>
    </section>
  )
}
