import { Avatar } from './marks'

// Nook's real LICENSE file (MIT, 1 KB of plain text) as it looks shared in a channel:
// the message, its file row and a reaction, all real Nook UI.
export function LicenceFileDrawing() {
  return (
    <figure className="nook-drawing" aria-label="Priya shares Nook’s LICENSE file in the launch channel: we can use it, change it and share it.">
      <div className="nook-arch">
        <div className="nook-card licence-card">
          <p className="thread-bar"><span className="thread-dots" aria-hidden="true"><i /><i /><i /></span><span className="thread-channel"><span aria-hidden="true">#</span> launch</span></p>
          <div className="thread-message">
            <Avatar initials="PR" />
            <div>
              <p className="thread-author">Priya</p>
              <p className="thread-body">It’s MIT. We can use it, change it and share it.</p>
              <p className="file-row"><span><strong>LICENSE</strong><small>1 KB · Download</small></span></p>
              <p className="mini-reactions"><span>🙌 4</span></p>
            </div>
          </div>
        </div>
      </div>
    </figure>
  )
}
