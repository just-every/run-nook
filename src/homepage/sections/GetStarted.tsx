import '../closing.css'
import { sourceUrl } from '../../brand/links'
import { WelcomeStreet } from '../drawings/WelcomeStreet'

export function GetStarted() {
  return (
    <section className="home-section closing" id="get-started" aria-labelledby="get-started-title">
      <div className="nook-drawing closing-street">
        <WelcomeStreet />
      </div>
      <h2 id="get-started-title">Make room for your team.</h2>
      <div className="home-actions">
        <a className="home-pill" href={sourceUrl}>Get the code</a>
        <a className="home-link" href="/docs">Read the docs</a>
      </div>
      <p className="home-free">100% free and open source.</p>
    </section>
  )
}
