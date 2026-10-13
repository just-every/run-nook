import { createFileRoute } from '@tanstack/react-router'
import { DocsPage } from '../docs/DocsPage'
import { docsHead } from '../docs/head'
import { loadDocsPage } from '../docs/load'

/** DOCS-001: each published guide slug resolves to its build-rendered Markdown page. */
export const Route = createFileRoute('/docs/$slug')({
  loader: ({ params }) => loadDocsPage(params.slug),
  head: ({ loaderData }) => docsHead(loaderData?.page),
  component: DocsArticlePage,
})

function DocsArticlePage() {
  return <DocsPage {...Route.useLoaderData()} />
}
