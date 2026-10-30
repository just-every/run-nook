// Free is a footnote for Nook (owner, 28 Oct). Base's chooser now puts that
// lead in the self-host badge; the source/licence facts remain in its footer.
// Keep the Base copy exact and fail if the badge changes on a later refresh.
const FREE_BADGE = '<span class="badge">100% free</span>'

export function withoutLeadingFree(html: string): string {
  if (!html.includes(FREE_BADGE)) throw new Error('Base Run page copy changed: update src/site/run-copy.ts')
  return html.replace(FREE_BADGE, '')
}
