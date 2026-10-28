import { readManifest } from '../docs/build/manifest'
import { pathKind, readRepository } from '../docs/build/site'
import { renderPage } from '../docs/build/render'
import type { SeedContract } from '../base/seed-contract.mjs'

/** Keep the shared clause parser/page, and publish the standard's surrounding source sections. */
export function withContractContext(page: string, source: string, contract: SeedContract): string {
  const section = (heading: string) => {
    const start = source.indexOf(`\n## ${heading}\n`)
    if (start < 0) return ''
    const end = source.indexOf('\n## ', start + 1)
    return source.slice(start, end < 0 ? undefined : end).trim()
  }
  const agentStart = source.indexOf('\n### Agent surface\n')
  const agentEnd = source.indexOf('\n#### ', agentStart + 1)
  const agent = agentStart < 0 ? '' : source.slice(agentStart, agentEnd).trim()
  const published = source.slice(source.indexOf('\n## Published clauses\n'), source.indexOf('\n### ', source.indexOf('\n## Published clauses\n')))
  const tierOf = (id: string, text: string) => {
    const meta = published.split('\n').find(line => line.startsWith(`- \`${id}\`:`)) ?? text
    return /\*Tier:\* (Core|Agent surface|Later)/.exec(meta)?.[1]
  }
  const tierRows = ['Core', 'Agent surface', 'Later'].map(tier => {
    const clauses = contract.clauses.filter(clause => tierOf(clause.id, clause.text) === tier)
    return `| ${tier} | ${clauses.filter(clause => clause.status === 'done').length} | ${clauses.length} |`
  })
  const markdown = [
    '# Contract scope and field proof',
    '## Progress by tier',
    '| Tier | Done | Total |\n| --- | ---: | ---: |\n' + tierRows.join('\n') + `\n| Full target | ${contract.counts.done} | ${contract.counts.total} |`,
    section('Door rules'), section('Shared duties (Base)'), agent,
    section('Field proof register'), section('Boundaries'), section('Homepage claims'),
  ].filter(Boolean).join('\n\n')
  const root = process.cwd(), manifest = readManifest(root)
  const rendered = renderPage(markdown, {
    source: 'CONTRACT.md', repository: readRepository(root), kind: pathKind(root),
    published: new Map(manifest.pages.map(entry => [entry.source, entry.href])),
  })
  if (rendered.problems.length) throw new Error(rendered.problems.join('\n'))
  const context = '<details class="card contract-context"><summary>Contract scope, agent jobs and field proof</summary>' + rendered.html + '</details>'
  const style = '<style>.contract-context{margin:24px 0;padding:24px;min-width:0}.contract-context summary{cursor:pointer;font-weight:600}.contract-context h2{margin-top:28px}.contract-context h3{margin-top:24px}.contract-context .docs-table{overflow:auto;max-width:100%;margin:16px 0}.contract-context table{display:table;border-collapse:collapse;width:100%;min-width:36rem}.contract-context thead{display:table-header-group;position:static;width:auto;height:auto;overflow:visible;clip:auto}.contract-context tbody{display:table-row-group}.contract-context tr{display:table-row}.contract-context th,.contract-context td{display:table-cell;text-align:left;vertical-align:top;padding:10px;border-bottom:1px solid var(--site-line);min-width:100px}.contract-context p,.contract-context li{line-height:1.6}.contract-context code{overflow-wrap:anywhere}</style>'
  return page.replace('</head>', style + '</head>').replace('<div class="layout">', context + '<div class="layout">')
}
