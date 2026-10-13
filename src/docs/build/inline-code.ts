import { createElement } from 'react';
import type { ReactNode } from 'react';

// Inline code never breaks inside a flag, an error code or a name. A short word stays on one line, and so does a short
// phrase such as `pnpm run dev`, kept small enough to fit beside a numbered step on a 320px screen. Anything longer wraps
// at its spaces. A word wraps inside only when it is long, or when it is a path (it has a slash) of 20 characters or
// more such as `/api/calendar/oauth/callback`: then after a slash, a dot or an underscore, or before a query, so the
// punctuation ends a line and no piece too short to stand alone starts or ends one.

const short = 30;
const shortPhrase = 16;
const shortPath = 20;
const pieceMinimum = 4;
const breakPoints = /(?<=\/)(?!\/)|(?<=\.)(?=[^.])|(?<=_)(?=[^_])|(?=[?&])/;

const breaksInside = (word: string) => word.length > short || (word.includes('/') && word.length >= shortPath);

/** A long word's pieces between its break points; a piece too short to stand on a line joins its neighbour. */
function pieces(word: string) {
  if (!breaksInside(word)) return [word];
  const parts: string[] = [];
  for (const part of word.split(breakPoints)) {
    if (parts.length && parts.at(-1)!.length < pieceMinimum) parts[parts.length - 1] += part;
    else parts.push(part);
  }
  if (parts.length > 1 && parts.at(-1)!.length < pieceMinimum) parts.splice(-2, 2, parts.at(-2)! + parts.at(-1)!);
  return parts;
}

export function inlineCode(text: string) {
  const whole = /\s/.test(text) ? text.length <= shortPhrase : !breaksInside(text);
  if (whole) return createElement('code', { className: 'docs-code-line' }, text);
  const children: ReactNode[] = [];
  for (const token of text.split(/(\s+)/)) {
    if (!token) continue;
    if (/^\s/.test(token)) { children.push(token); continue; }
    pieces(token).forEach((piece, index) => {
      if (index) children.push(createElement('wbr', { key: `${children.length}-break` }));
      children.push(createElement('span', { key: children.length }, piece));
    });
  }
  return createElement('code', { className: 'docs-code-words' }, ...children);
}
