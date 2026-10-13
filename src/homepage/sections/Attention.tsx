import '../attention.css'
import { QuietHourglass } from '../drawings/QuietHourglass'

// "Only what needs you." The copy on the left; on the right a quiet hourglass with the
// real What needs you list set over it (title, the quiet-time chip, a request and a
// mention, the way AttentionView lays them out). The figure holds no controls.
export function Attention() {
  return (
    <section className="home-section attention" id="attention" aria-labelledby="attention-title">
      <div className="section-copy">
        <h2 id="attention-title">Only what needs you.</h2>
        <p className="section-body">Requests for you, mentions and replies you follow wait in one list. Need to focus? Go quiet for an hour.</p>
      </div>
      <figure className="nook-drawing attention-figure" aria-label="Nook’s What needs you list, quiet for one hour: a request for you in launch, awaiting your agreement, and a mention in design.">
        <div className="attention-art"><QuietHourglass /></div>
        <div className="attention-card">
          <div className="attention-head">
            <p className="attention-title">What needs you</p>
            <span className="attention-chip">Quiet for one hour</span>
          </div>
          <div className="attention-row">
            <span className="attention-glyph is-rose">#</span>
            <p className="attention-name">launch</p>
            <p className="attention-reason">A request for you</p>
            <p className="attention-text">Send the demo invite</p>
            <span className="attention-status">Awaiting agreement</span>
            <span className="attention-accept">Accept</span>
          </div>
          <div className="attention-row is-mention">
            <span className="attention-glyph is-sage">#</span>
            <p className="attention-name">design</p>
            <p className="attention-reason">You were mentioned</p>
            <p className="attention-text">Can you check the new logo?</p>
          </div>
        </div>
      </figure>
    </section>
  )
}
