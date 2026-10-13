// Nook declares its own fonts and its favicon here; Base's Outfit default does not apply.
// Shared by the root renderer, native auth documents and the no-JavaScript first-run document.
// Base's font-response.ts and first-run setup import the names `fontHead` and `fontLinks`, so
// those names stay even though the list now carries every shared head link, not only fonts.
export const fontLinks = [
  { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
  { rel: 'preload', href: '/brand/fonts/InstrumentSans-wght.woff2', as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' },
  { rel: 'preload', href: '/brand/fonts/BricolageGrotesque-opsz-wght.woff2', as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' },
  { rel: 'stylesheet', href: '/fonts/fonts.css' },
] as const

export const fontHead = fontLinks.map(link => `<link ${Object.entries(link).map(([name, value]) => `${name.toLowerCase()}="${value}"`).join(' ')}>`).join('')
