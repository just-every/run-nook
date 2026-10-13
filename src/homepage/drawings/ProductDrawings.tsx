import { Avatar } from './marks'

// Four small drawings of the everyday chat, one real screen part each.

export function ChannelsDrawing() {
  return (
    <div className="nook-card product-card channels-card">
      <p className="sidebar-heading">Channels</p>
      <p className="sidebar-row is-selected"><span className="sidebar-hash" aria-hidden="true">#</span>launch<span className="sidebar-count" aria-label="3 unread">3</span></p>
      <p className="sidebar-row"><span className="sidebar-hash" aria-hidden="true">#</span>design</p>
      <p className="sidebar-heading">Direct messages</p>
      <p className="sidebar-row"><Avatar initials="PR" />Priya</p>
    </div>
  )
}

export function ThreadsDrawing() {
  return (
    <div className="nook-card product-card threads-card">
      <div className="mini-message">
        <Avatar initials="PR" />
        <div>
          <p className="mini-author">Priya</p>
          <p className="mini-body">Who has the slides?</p>
          <p className="mini-reactions"><span>👍 2</span><span>🎉 1</span></p>
        </div>
      </div>
      <div className="mini-message mini-reply">
        <Avatar initials="SA" tone="wash" />
        <div>
          <p className="mini-author">Sam</p>
          <p className="mini-body">In the launch doc.</p>
        </div>
      </div>
    </div>
  )
}

export function FilesDrawing() {
  return (
    <div className="nook-card product-card files-card">
      <div className="mini-message">
        <Avatar initials="SA" tone="wash" />
        <div>
          <p className="mini-author">Sam</p>
          <p className="mini-body">Here’s the plan.</p>
        </div>
      </div>
      <p className="file-row"><span className="file-badge" aria-hidden="true">PDF</span><span><strong>demo-plan.pdf</strong><small>84 KB · Download</small></span></p>
    </div>
  )
}

export function SearchDrawing() {
  return (
    <div className="nook-card product-card search-card">
      <p className="search-label">Search conversations</p>
      <p className="search-field">room</p>
      <div className="search-result">
        <p className="mini-author">Priya</p>
        <p className="mini-body">Can someone book the room for Friday’s demo?</p>
        <span className="mark-chip">Open in conversation</span>
      </div>
    </div>
  )
}
