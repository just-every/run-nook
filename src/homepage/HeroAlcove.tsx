import './hero-alcove.css'
import { NookAlcove } from './drawings/NookAlcove'

// The hero drawing: the illustrated alcove with two live Nook cards floating in it,
// one moment of one real conversation. The card text is real DOM text, set over the
// art; the art itself is decoration. Every visible string is a real Nook label or
// the example's own content. Nothing here is a control.

export function HeroAlcove() {
  return (
    <figure className="hero-alcove" aria-label="Priya asks in # launch who can book the room for Friday’s demo, and Sam accepts the request.">
      <NookAlcove />
      <div className="alcove-cards">
        <div className="alcove-card alcove-thread">
          <p className="alcove-bar">
            <span className="alcove-dots" aria-hidden="true"><i /><i /><i /></span>
            <span className="alcove-channel"><span aria-hidden="true">#</span> launch</span>
          </p>
          <div className="alcove-message">
            <span className="alcove-avatar" aria-hidden="true">PR</span>
            <div className="alcove-message-text">
              <p className="alcove-author">Priya</p>
              <p className="alcove-body">Can someone book the room for Friday’s demo?</p>
              <p className="alcove-actions">
                <span className="alcove-chip is-chosen">Ask someone</span>
                <span className="alcove-chip">Record decision</span>
              </p>
            </div>
          </div>
        </div>
        <div className="alcove-card alcove-request">
          <p className="alcove-status"><span>Accepted</span></p>
          <p className="alcove-title">Book the room for Friday’s demo</p>
          <p className="alcove-person">Sam</p>
        </div>
      </div>
    </figure>
  )
}
