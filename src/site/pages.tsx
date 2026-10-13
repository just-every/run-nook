import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { runPageHtml, siteNotFoundHtml, type SiteBuild, type SiteContext } from '../base/run-site'
import { fontLinks } from '../base/font-head'
import { productIdentity } from '../brand/product'

// A run site identifies the product; it never loads this installation's branding.
const identity = { ...productIdentity, deployment: productIdentity.product }
import { Homepage } from '../homepage/Homepage'
import { DocsPage } from '../docs/DocsPage'
import { pages, repository, sections, version } from 'virtual:nook-docs'
import { run } from './run'

export async function sitePages({ styles }: SiteContext): Promise<SiteBuild> {
  const document = (title: string, description: string, body: ReactElement) => '<!doctype html>' + renderToStaticMarkup(
    <html lang="en"><head><meta charSet="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{title}</title><meta name="description" content={description} />
      {fontLinks.map(link => <link key={link.href} {...link} />)}
      {styles.map(href => <link key={href} rel="stylesheet" href={href} />)}
    </head><body>{body}</body></html>)
  const docs = await Promise.all(Object.entries(pages).map(async ([slug, load]) => {
    const page = (await load()).default
    return { path: slug ? `/docs/${slug}` : '/docs', html: document(slug ? `${page.title} · Nook docs` : 'Nook docs', page.description,
      <DocsPage page={page} sections={sections} repository={repository} version={version} variant="site" />) }
  }))
  return {
    pages: [
      { path: '/', html: document('Nook — Talk it through. Get it done.', '100% free, open source alternative to Slack and Microsoft Teams. Turn a message into a decision or a request. Everyone can see who’s on it.', <Homepage variant="site" />) },
      { path: '/run', html: runPageHtml(identity, run) },
      ...docs,
      { path: '/404', html: siteNotFoundHtml(identity, run) },
    ],
    assets: ['rer-theme.css', 'fonts/fonts.css', 'brand/fonts', 'brand/mark.svg', 'brand/band.svg', 'favicon.svg'],
  }
}
