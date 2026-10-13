import { LicenceFileDrawing } from '../drawings/LicenceFileDrawing'
import { sourceUrl } from '../../brand/links'

export function Free() {
  return (
    <section className="home-section split" id="free" aria-labelledby="free-title">
      <div className="section-copy">
        <h2 id="free-title">Free, and yours to keep.</h2>
        <p className="section-body">Nook is 100% free and open source. It’s MIT licensed, so your team can use it, change it and run it however you like.</p>
        <div className="section-actions"><a className="home-pill" href={sourceUrl}>Get the code</a></div>
      </div>
      <LicenceFileDrawing />
    </section>
  )
}
