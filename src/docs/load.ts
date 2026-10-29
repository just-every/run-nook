import { notFound } from '@tanstack/react-router'
import type { DocsView } from './types'
import { readOpenSession } from './session'

/** Load one of the Markdown pages in docs/site.json, with whether the reader has an open session. */
export async function loadDocsPage(slug: string): Promise<DocsView> {
  const { pages, problem, repository, sections, version } = await import('virtual:nook-docs')
  if (problem) throw new Error(problem)
  const load = Object.hasOwn(pages, slug) ? pages[slug] : undefined
  if (!load) throw notFound()
  return { page: (await load()).default, repository, sections, version, signedIn: await readOpenSession() }
}
