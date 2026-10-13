import { MoveInDrawing } from '../drawings/MoveInDrawing'

const steps = [
  ['Install it.', 'A few commands, or the guided installer.'],
  ['Bring your Slack history.', 'Public channels come in, read only.'],
  ['Invite your team.', 'Choose the channels each person sees.'],
]

export function MoveIn() {
  return (
    <section className="home-section split" id="move-in" aria-labelledby="move-in-title">
      <div className="section-copy">
        <h2 id="move-in-title">Try it beside Slack</h2>
        <p className="section-body">Keep Slack running while your team tries Nook.</p>
        <ol className="movein-steps">
          {steps.map(([lead, line], index) => (
            <li key={lead}><span className="mark-num" aria-hidden="true">{index + 1}</span><span><strong>{lead}</strong> {line}</span></li>
          ))}
        </ol>
        <a className="home-link" href="/docs/moving-in-from-slack">Read the moving-in guide</a>
      </div>
      <MoveInDrawing />
    </section>
  )
}
