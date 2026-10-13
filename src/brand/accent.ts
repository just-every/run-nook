import type {CSSProperties} from 'react'
import branding from '../branding.json'
import {migrateAccent} from './accent-colour.mjs'

// The installer's brand colour (berry by default) is the accent for the one chosen
// action, unread counts and focus wherever Nook draws its own UI. Its text colour
// follows WCAG relative luminance so any colour the owner picks stays readable.
const luminance = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0)

const accent = migrateAccent(branding.primaryColor)

export const accentStyle = {
  '--brand-accent': accent,
  '--brand-accent-text': luminance(accent) > 0.179 ? '#2a1d21' : '#ffffff',
} as CSSProperties
