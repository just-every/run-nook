import { Avatar } from './marks'

// A channel after a Slack import: imported history stays read only, with no
// message actions, and new Nook messages carry Ask someone and Record decision.
export function MoveInDrawing() {
  return (
    <figure className="nook-drawing" aria-label="The launch channel after moving in from Slack: Maya’s imported message is read only, and Priya welcomes everyone in Nook.">
      <div className="nook-arch">
        <div className="nook-card movein-card">
          <p className="thread-bar"><span className="thread-dots" aria-hidden="true"><i /><i /><i /></span><span className="thread-channel"><span aria-hidden="true">#</span> launch</span></p>
          <div className="thread-message">
            <Avatar initials="MA" tone="wash" />
            <div>
              <p className="thread-author">Maya<span className="imported-tag">Imported · read only</span></p>
              <p className="thread-body">Kickoff notes are in the shared doc.</p>
            </div>
          </div>
          <div className="thread-message">
            <Avatar initials="PR" />
            <div>
              <p className="thread-author">Priya</p>
              <p className="thread-body">Welcome to Nook, everyone!</p>
            </div>
          </div>
          <p className="thread-actions">
            <span className="mark-chip">Ask someone</span>
            <span className="mark-chip">Record decision</span>
          </p>
        </div>
      </div>
    </figure>
  )
}
