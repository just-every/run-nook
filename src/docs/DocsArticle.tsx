import { HydrationUnit } from '../base/hydration/unit'
import { DocsTocCompact } from './DocsToc'
import type { DocsPageData } from './types'

/** The page title and Markdown body, rendered from the checked build artifact. */
export function DocsArticle({ page, section }: { page: DocsPageData; section: string }) {
  return <>
    <HydrationUnit><header className="docs-page-head">
      <p className="docs-eyebrow">{section}</p>
      <h1 id={page.titleId} className="docs-title">{page.title}</h1>
    </header></HydrationUnit>
    <HydrationUnit><DocsTocCompact toc={page.toc} /></HydrationUnit>
    <HydrationUnit><div className="docs-prose" dangerouslySetInnerHTML={{ __html: page.html }} /></HydrationUnit>
  </>
}
