// Small marks shared by the homepage drawings. All are decoration for sighted
// visitors; the drawing's own text and figure label carry the meaning.

export function Avatar({initials, tone = 'rose'}: {initials: string; tone?: 'rose' | 'berry' | 'wash'}) {
  return <span className={'mark-avatar avatar-' + tone} aria-hidden="true">{initials}</span>
}
