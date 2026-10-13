import branding from './branding.json'
import {pageThemeHref} from './brand/page-theme.mjs'
// Nook's setup design (public/brand/pages.css, built on the tokens in public/rer-theme.css), as Base's native pages link it.
export const theme = { href: pageThemeHref, productName: branding.name } as const
