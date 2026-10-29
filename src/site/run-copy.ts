// Base's Run page opens its sub line and meta description with "100% free and
// open source." Free is a footnote for Nook (owner, 28 Oct): the licence stays in
// the page's facts footer, and the lead says only what the page does. Base copies
// are byte-exact, so the lead is trimmed here; a Base refresh that changes these
// strings fails the build instead of silently shipping "free" again.
const LEADS = [
  '100% free and open source. Two lines, and',
  ' 100% free and open source.',
]

export function withoutLeadingFree(html: string): string {
  const [sub, meta] = LEADS
  if (!html.includes(sub) || !html.includes(meta)) throw new Error('Base Run page copy changed: update src/site/run-copy.ts')
  return html.replace(sub, 'Two lines in your terminal, and').replace(meta, '')
}
