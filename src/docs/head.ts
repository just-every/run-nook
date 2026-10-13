import type { DocsPageData } from './types'

/** Search and browser title for a published guide page. */
export function docsHead(page: DocsPageData | undefined) {
  if (!page) return {}
  return {
    meta: [
      { title: page.slug ? `${page.title} · Nook docs` : 'Nook docs' },
      { name: 'description', content: page.description },
    ],
  }
}
