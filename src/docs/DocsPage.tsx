import { SiteFooter } from '../brand/SiteFooter'
import { SiteHeader } from '../brand/SiteHeader'
import { DocsMenu } from './DocsMenu'
import { DocsPager } from './DocsPager'
import { DocsSidebar } from './DocsSidebar'
import { DocsToc } from './DocsToc'
import { DocsArticle } from './DocsArticle'
import type { DocsView } from './types'
import '../brand/tokens.css'
import '../brand/site-chrome.css'
import './docs.css'

/** Public Nook guides rendered from checked Markdown at build time, inside the homepage's header and footer. */
export function DocsPage({ page, sections, repository }: DocsView) {
  const order = sections.flatMap(section => section.pages.map(entry => ({ ...entry, section: section.title })))
  const index = order.findIndex(entry => entry.slug === page.slug)
  const current = order[index]
  if (!current) throw new Error(`Docs page "${page.slug}" is missing from its navigation`)
  return <div className="nook-docs nook-site">
    <a className="docs-skip" href="#docs-content">Skip to documentation</a>
    <SiteHeader current="docs" />
    <div className="docs-shell">
      <DocsSidebar sections={sections} current={page.slug} />
      <main id="docs-content" tabIndex={-1} className="docs-main">
        <DocsMenu sections={sections} current={page.slug} label={current.label} />
        <DocsArticle page={page} section={current.section} />
        <DocsPager previous={order[index - 1]} next={order[index + 1]} editUrl={`${repository.url}/edit/${repository.branch}/${page.source}`} />
      </main>
      <DocsToc toc={page.toc} />
    </div>
    <SiteFooter />
  </div>
}
