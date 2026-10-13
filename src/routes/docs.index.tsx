import { createFileRoute } from '@tanstack/react-router'
import { DocsPage } from '../docs/DocsPage'
import { docsHead } from '../docs/head'
import { loadDocsPage } from '../docs/load'

/** DOCS-001: the public docs home is rendered from docs/overview.md at build time. */
export const Route = createFileRoute('/docs/')({
  loader: () => loadDocsPage(''),
  head: ({ loaderData }) => docsHead(loaderData?.page),
  component: DocsHome,
})

function DocsHome() {
  return <DocsPage {...Route.useLoaderData()} />
}
