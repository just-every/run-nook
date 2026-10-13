import type { EditionIdentity } from '../base/identity'

export const productIdentity: Omit<EditionIdentity, 'deployment'> = {
  product: 'Nook',
  purpose: '{deployment}’s conversations, decisions and commitments, in one private workspace.',
  tagline: 'Talk it through. Get it done.',
  signInPath: '/signin',
  runSite: 'https://run-nook.com',
  installedHome: 'lobby',
  theme: '/rer-theme.css',
  mark: '/brand/mark.svg',
  band: '/brand/band.svg',
  fonts: '/fonts/fonts.css',
}
