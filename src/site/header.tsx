import { renderToStaticMarkup } from 'react-dom/server'
import { SiteHeader } from '../brand/SiteHeader'
import tokens from '../brand/tokens.css?raw'
import chrome from '../brand/site-chrome.css?raw'

// The run site's Run, Contract and not-found pages come from Base's static document builders, which draw their own
// header. Every site page wears the homepage header instead: SiteHeader rendered as it is, with the stylesheets it is
// drawn from (tokens and site-chrome, every rule scoped to `.nook-site`). Only the `.nook-site` root's own settings
// (the homepage root's page width, ink, face and focus ring) are repeated here.
const root = '.nook-site{--page-w:clamp(1440px,82vw,2000px);color:var(--brand-ink);font-family:var(--brand-font-text);-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}'
  + '.nook-site,.nook-site *{box-sizing:border-box}.nook-site :focus-visible{outline:3px solid var(--brand-berry);outline-offset:3px;border-radius:6px}'

const baseHeader = /<header class="bar">[\s\S]*?<\/header>/

/** One Base page with its header swapped for the homepage's, and `extraCss` (the page's own overrides) after its styles. */
export function withSiteHeader(html: string, current?: 'contract', extraCss = ''): string {
  if (!baseHeader.test(html) || !html.includes('</head>')) throw new Error('A run site page no longer has the header this build replaces.')
  const header = renderToStaticMarkup(<div className="nook-site"><SiteHeader variant="site" current={current} /></div>)
  return html.replace(baseHeader, () => header).replace('</head>', () => `<style>${tokens}${chrome}${root}${extraCss}</style></head>`)
}
