import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { contractPageHtml } from '../base/contract-page'
import { runPageHtml, siteNotFoundHtml, type SiteBuild, type SiteContext } from '../base/run-site'
import { fontLinks } from '../base/font-head'
import { productIdentity } from '../brand/product'

// A run site identifies the product; it never loads this installation's branding.
const identity = { ...productIdentity, deployment: productIdentity.product }
import { Homepage } from '../homepage/Homepage'
import { DocsPage } from '../docs/DocsPage'
import { pages, repository, sections, version } from 'virtual:nook-docs'
import { run } from './run'
import { withSiteHeader } from './header'

// Contract text under 13px (H11): the clause kind tags (12.5px from 761px up) and the phone eyebrow (12px).
const contractText = '@media(min-width:761px){.kind{font-size:13px}}@media(max-width:760px){.eyebrow{font-size:13px}}'

export async function sitePages({ styles, contract }: SiteContext): Promise<SiteBuild> {
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
      { path: '/run', html: withSiteHeader(runPageHtml(identity, run, contract)) },
      ...(contract ? [{ path: '/contract', html: withSiteHeader(contractPageHtml(identity, run, contract), 'contract', contractText) }] : []),
      ...docs,
      { path: '/404', html: withSiteHeader(siteNotFoundHtml(identity, run, contract)) },
    ],
    assets: ['rer-theme.css', 'fonts/fonts.css', 'brand/fonts', 'brand/mark.svg', 'brand/band.svg', 'favicon.svg'],
  }
}
