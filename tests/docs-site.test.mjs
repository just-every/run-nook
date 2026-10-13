import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = fileURLToPath(new URL('..', import.meta.url))
const { readManifest } = await import('../src/docs/build/manifest.ts')
const { buildSite } = await import('../src/docs/build/site.ts')
const { renderPage } = await import('../src/docs/build/render.ts')

test('DOCS-001: the manifest requires a first home page, valid unique slugs and a reason for each excluded source', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'nook-docs-manifest-'))
  try {
    mkdirSync(join(fixture, 'docs'))
    for (const source of ['README.md', 'docs/guide.md', 'NOTES.md']) writeFileSync(join(fixture, source), '# Page\n')
    const page = (slug, source, label = 'Label') => ({ slug, source, label })
    const valid = {
      sections: [{ title: 'Start', pages: [page('', 'README.md'), page('guide', 'docs/guide.md')] }],
      githubOnly: [{ source: 'NOTES.md', reason: 'Maintainer notes' }],
    }
    writeFileSync(join(fixture, 'docs/site.json'), JSON.stringify(valid))
    assert.equal(readManifest(fixture).pages.length, 2)

    const rejects = (changed) => {
      writeFileSync(join(fixture, 'docs/site.json'), JSON.stringify({ ...valid, ...changed }))
      assert.throws(() => readManifest(fixture))
    }
    rejects({ sections: [{ title: 'Start', pages: [page('guide', 'docs/guide.md'), page('', 'README.md')] }] })
    rejects({ sections: [{ title: 'Start', pages: [page('', 'README.md'), page('Guide', 'docs/guide.md')] }] })
    rejects({ sections: [{ title: 'Start', pages: [page('', 'README.md'), page('guide', 'docs/guide.md'), page('guide', 'NOTES.md')] }] })
    rejects({ githubOnly: [{ source: 'NOTES.md', reason: ' ' }] })
    rejects({ githubOnly: [{ source: 'MISSING.md', reason: 'Maintainer notes' }] })
  } finally {
    rmSync(fixture, { recursive: true, force: true })
  }
})
test('DOCS-001: every root and docs Markdown source is published or has a GitHub-only reason', () => {
  const manifest = readManifest(root)
  const listed = new Set([...manifest.pages, ...manifest.githubOnly].map(entry => entry.source))
  const markdown = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--', '*.md'], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .filter(file => /^[^/]+\.md$/.test(file) || /^docs\/.+\.md$/.test(file))
  const missing = markdown.filter(file => !listed.has(file))
  assert.deepEqual(missing, [], `Add ${missing.join(', ')} to docs/site.json as a page or GitHub-only source`)
  assert.equal(listed.size, manifest.pages.length + manifest.githubOnly.length, 'A Markdown source appears only once')
  assert.ok(manifest.githubOnly.every(entry => entry.reason.trim().length > 0))
})

test('DOCS-001: every published page renders with a title, unique headings and no unresolved link or anchor', () => {
  const manifest = readManifest(root)
  const site = buildSite(root)
  assert.deepEqual(site.problems, [])
  assert.equal(site.pages.length, manifest.pages.length)
  for (const page of site.pages) {
    assert.ok(page.title, `${page.source} has a title`)
    assert.ok(page.titleId, `${page.source} has a title anchor`)
    assert.doesNotMatch(page.html, /<h1\b|<script\b/i, `${page.source} has no duplicate title or raw script`)
    assert.equal(new Set(page.ids).size, page.ids.length, `${page.source} heading ids are unique`)
    assert.deepEqual(page.problems, [], page.source)
  }
})

test('DOCS-001: missing pages and headings are build problems, and raw HTML is reported without becoming markup', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'nook-docs-site-'))
  try {
    mkdirSync(join(fixture, 'docs'))
    writeFileSync(join(fixture, 'package.json'), JSON.stringify({ repository: { url: 'https://github.com/just-every/run-nook.git' } }))
    writeFileSync(join(fixture, 'docs/site.json'), JSON.stringify({
      sections: [{ title: 'Guides', pages: [
        { slug: '', source: 'docs/index.md', label: 'Overview' },
        { slug: 'guide', source: 'docs/guide.md', label: 'Guide' },
      ] }],
      githubOnly: [],
    }))
    writeFileSync(join(fixture, 'docs/index.md'), '# Overview\n\n[missing page](guide.md#missing-heading) [missing file](absent.md)\n')
    writeFileSync(join(fixture, 'docs/guide.md'), '# Guide [bad](absent-title.md) [bad anchor](index.md#absent-title)\n\n## Existing heading\n')
    const site = buildSite(fixture)
    assert.equal(site.problems.length, 4)
    assert.ok(site.problems.some(problem => problem.includes('absent.md') && problem.includes('does not exist')))
    assert.ok(site.problems.some(problem => problem.includes('missing-heading') && problem.includes('guide.md')))
    assert.ok(site.problems.some(problem => problem.includes('absent-title.md') && problem.includes('does not exist')))
    assert.ok(site.problems.some(problem => problem.includes('absent-title') && problem.includes('index.md')))

    const rendered = renderPage('# Guide\n\nText <script>alert("not rendered")</script>\n', {
      source: 'docs/guide.md',
      repository: site.repository,
      published: new Map(),
      kind: () => null,
    })
    assert.ok(rendered.problems.some(problem => problem.startsWith('raw HTML <script>')))
    assert.ok(rendered.problems.some(problem => problem.startsWith('raw HTML </script>')))
    assert.doesNotMatch(rendered.html, /<script\b/i)

    const titleHtml = renderPage('# Guide <span>raw</span>\n\nBody\n', {
      source: 'docs/guide.md',
      repository: site.repository,
      published: new Map(),
      kind: () => null,
    })
    assert.ok(titleHtml.problems.some(problem => problem.startsWith('raw HTML <span>')))
    assert.ok(titleHtml.problems.some(problem => problem.startsWith('raw HTML </span>')))
    assert.doesNotMatch(titleHtml.html, /<span\b/i)
  } finally {
    rmSync(fixture, { recursive: true, force: true })
  }
})
