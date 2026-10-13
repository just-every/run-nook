import type { ReactNode } from 'react'
import { ChannelsDrawing, FilesDrawing, SearchDrawing, ThreadsDrawing } from '../drawings/ProductDrawings'

const parts: { title: string; line: string; drawing: ReactNode; label: string }[] = [
  { title: 'Channels', line: 'Public, private and direct.', drawing: <ChannelsDrawing />, label: 'The sidebar: the launch channel with 3 unread, design, and a direct message with Priya.' },
  { title: 'Threads', line: 'Replies stay with their message.', drawing: <ThreadsDrawing />, label: 'Priya asks who has the slides, with reactions, and Sam replies in the thread.' },
  { title: 'Files', line: 'Attach images, PDFs and text files.', drawing: <FilesDrawing />, label: 'Sam shares demo-plan.pdf, 84 KB, ready to download.' },
  { title: 'Search', line: 'Find any message you can read.', drawing: <SearchDrawing />, label: 'A search for room finds Priya’s message, with Open in conversation.' },
]

export function Product() {
  return (
    <section className="home-section centred" id="product" aria-labelledby="product-title">
      <h2 id="product-title">The rest of your team chat</h2>
      <ol className="product-parts">
        {parts.map((part, index) => (
          <li key={part.title}>
            <figure className="nook-drawing" aria-label={part.label}>
              <div className="nook-arch">{part.drawing}</div>
            </figure>
            <h3><span className="mark-num" aria-hidden="true">{index + 1}</span>{part.title}</h3>
            <p>{part.line}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
