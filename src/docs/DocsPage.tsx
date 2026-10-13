import { DocsSiteVariant } from './DocsSiteVariant'
import { HydrationUnit } from '../base/hydration/unit'
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
export function DocsPage({ page, sections, repository, variant = 'instance' }: DocsView & {variant?: 'instance' | 'site'}) {
  const order = sections.flatMap(section => section.pages.map(entry => ({ ...entry, section: section.title })))
  const index = order.findIndex(entry => entry.slug === page.slug)
  const current = order[index]
  if (!current) throw new Error(`Docs page "${page.slug}" is missing from its navigation`)
  return <DocsSiteVariant value={variant === 'site'}><div className="nook-docs nook-site">
    <a className="docs-skip" href="#docs-content">Skip to documentation</a>
    <HydrationUnit><SiteHeader current="docs" variant={variant} /></HydrationUnit>
    <div className="docs-shell">
      <HydrationUnit><DocsSidebar sections={sections} current={page.slug} /></HydrationUnit>
      <main id="docs-content" tabIndex={-1} className="docs-main">
        <HydrationUnit><DocsMenu sections={sections} current={page.slug} label={current.label} /></HydrationUnit>
        <DocsArticle page={page} section={current.section} />
        <DocsPager previous={order[index - 1]} next={order[index + 1]} editUrl={`${repository.url}/edit/${repository.branch}/${page.source}`} />
      </main>
      <HydrationUnit><DocsToc toc={page.toc} /></HydrationUnit>
    </div>
    <HydrationUnit><SiteFooter variant={variant} /></HydrationUnit>
  </div></DocsSiteVariant>
}
